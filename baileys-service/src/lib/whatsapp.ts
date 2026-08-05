import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pinoModule from 'pino';
import {
  useSupabaseAuthState,
  clearSupabaseAuthState,
  upsertConversation,
  saveMessage,
  isConversationPaused,
  pauseConversation,
  supabase,
} from './supabase.js';
import { askAgent } from './agent.js';
import { enqueueIncoming, initDebounce, sweepOrphans } from './debounce.js';

// pino's CJS default-import under NodeNext resolves to a namespace; unwrap .default at runtime
const pino: any = (pinoModule as any).default ?? pinoModule;
const logger = pino({ level: 'silent' });

// IDs of messages the agent sent — used to ignore echoes (a fromMe message
// NOT in this set = the human replied from their phone).
const agentSentIds = new Set<string>();

let qrCode: string | null = null;
let connected = false;
let sock: ReturnType<typeof makeWASocket> | null = null;

export const getQR = () => qrCode;
export const isConnected = () => connected;
export const getSock = () => sock;

/**
 * Résout le JID d'envoi pour un numéro stocké ("+336…" ou "+<lid>").
 * 1. Lookup officiel onWhatsApp (contacts normaux).
 * 2. Fallback LID (privacy mode) : si une conversation existe déjà avec ce
 *    "numéro", sendMessage(<digits>@lid) fonctionne même si onWhatsApp échoue.
 */
export async function resolveJid(phone: string): Promise<string | null> {
  if (!sock || !connected) return null;
  const digits = phone.replace('+', '');
  try {
    const exists = await sock.onWhatsApp(digits);
    const match = exists?.find((e) => e.exists);
    if (match?.jid) return match.jid;
  } catch { /* lookup indisponible → fallback */ }

  const { data: conv } = await supabase
    .from('wa_conversations')
    .select('id')
    .eq('customer_phone', phone)
    .maybeSingle();
  return conv ? `${digits}@lid` : null;
}

/** Simule la frappe humaine avant un envoi (indicateur + délai proportionnel). */
async function typeThenSend(jid: string, text: string): Promise<string | undefined> {
  const baseMs = parseInt(process.env.AGENT_REPLY_DELAY_MS ?? '8000', 10);
  const perCharMs = parseInt(process.env.AGENT_REPLY_PER_CHAR_MS ?? '25', 10);
  const maxMs = parseInt(process.env.AGENT_REPLY_DELAY_MAX_MS ?? '15000', 10);
  const jitterMs = Math.floor(Math.random() * 2000);
  const delayMs = Math.min(maxMs, baseMs + text.length * perCharMs + jitterMs);

  try { await sock!.sendPresenceUpdate('composing', jid); } catch {}
  await new Promise((r) => setTimeout(r, delayMs));
  try { await sock!.sendPresenceUpdate('paused', jid); } catch {}

  const sent = await sock!.sendMessage(jid, { text });
  if (sent?.key?.id) agentSentIds.add(sent.key.id);
  return sent?.key?.id ?? undefined;
}

/**
 * Envoi "agent" (relances, message final d'escalade) : signé agent en base,
 * ne met PAS la conversation en pause. Utilisé par POST /send-agent.
 */
export async function sendAsAgent(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  if (!sock || !connected) return { ok: false, error: 'WhatsApp non connecté' };
  const jid = await resolveJid(phone);
  if (!jid) return { ok: false, error: `Numéro ${phone} introuvable sur WhatsApp` };
  const msgId = await typeThenSend(jid, message);
  const conv = await upsertConversation(phone);
  if (conv) await saveMessage(conv.id, true, message, false, msgId);
  return { ok: true };
}

/**
 * Envoi brut (notification au gérant) : pas de persistance dans les
 * conversations clients, pas de simulation de frappe. POST /notify.
 */
export async function sendRaw(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  if (!sock || !connected) return { ok: false, error: 'WhatsApp non connecté' };
  const jid = await resolveJid(phone);
  if (!jid) return { ok: false, error: `Numéro ${phone} introuvable sur WhatsApp` };
  const sent = await sock.sendMessage(jid, { text: message });
  if (sent?.key?.id) agentSentIds.add(sent.key.id);
  return { ok: true };
}

/** Pipeline de réponse : appelé par le debounce une fois la fenêtre écoulée. */
async function respondToCustomer(phone: string, jid: string | null, text: string): Promise<void> {
  // La pause se vérifie au moment du flush (elle a pu être posée pendant la
  // fenêtre de debounce, p. ex. par une réponse humaine).
  const paused = await isConversationPaused(phone);
  if (paused) {
    console.log(`⏸️  ${phone} en pause — pas de réponse agent`);
    return;
  }

  const reply = await askAgent(text, phone);
  if (!reply.trim()) return;

  const sendJid = jid ?? (await resolveJid(phone));
  if (!sendJid) {
    console.error(`[whatsapp] JID introuvable pour ${phone} — réponse perdue`);
    return;
  }

  const msgId = await typeThenSend(sendJid, reply);
  const conv = await upsertConversation(phone);
  if (conv) await saveMessage(conv.id, true, reply, false, msgId);
  console.log(`🤖 Apolline → ${phone}: ${reply.slice(0, 80)}…`);
}

export async function connectToWhatsApp(): Promise<void> {
  initDebounce(respondToCustomer);

  const { state, saveCreds } = await useSupabaseAuthState();
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: true,
    browser: ['Apolline Concierge', 'Chrome', '3.0'],
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrCode = qr;
      connected = false;
      console.log('📱 QR Code prêt — scannez depuis /qr');
    }
    if (connection === 'close') {
      connected = false;
      qrCode = null;
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(`🔌 Connexion fermée (code ${code}) — loggedOut: ${loggedOut}`);
      if (loggedOut) {
        // L'humain a déconnecté l'appareil lié dans WhatsApp. Les credentials
        // sont invalides — on les efface et on relance pour générer un nouveau QR.
        console.log('🧹 Session WhatsApp invalidée → nettoyage auth Supabase + nouveau QR');
        clearSupabaseAuthState()
          .catch((e) => console.error('[whatsapp] clearAuthState:', e))
          .finally(() => setTimeout(() => connectToWhatsApp(), 2_000));
      } else {
        setTimeout(() => connectToWhatsApp(), 5_000);
      }
    }
    if (connection === 'open') {
      connected = true;
      qrCode = null;
      console.log('✅ WhatsApp connecté !');
      // Messages restés en buffer pendant un restart Railway.
      void sweepOrphans();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue;

      const jid = msg.key.remoteJid ?? '';
      if (isJidBroadcast(jid)) continue;
      if (jid.endsWith('@g.us')) continue; // ignore groups

      // WhatsApp donne soit "<phone>@s.whatsapp.net" (contact normal), soit
      // "<lid>@lid" (privacy mode). On strip les deux pour un identifiant clean.
      const customerPhone = '+' + jid.replace(/@(s\.whatsapp\.net|lid)$/, '');
      const msgId = msg.key.id ?? '';
      const body =
        msg.message.conversation ??
        msg.message.extendedTextMessage?.text ??
        msg.message.ephemeralMessage?.message?.extendedTextMessage?.text ??
        '';

      if (!body.trim()) continue;

      // Message envoyé depuis le téléphone du gérant (fromMe)
      if (msg.key.fromMe) {
        if (agentSentIds.has(msgId)) {
          agentSentIds.delete(msgId);
          continue; // écho d'un envoi de l'agent — ignore
        }
        // Reprise humaine depuis le téléphone → pause de l'agent 24h
        console.log(`👤 Réponse humaine vers ${customerPhone} → pause 24h`);
        const conv = await upsertConversation(customerPhone);
        if (conv) {
          await saveMessage(conv.id, true, body, true, msgId);
          await pauseConversation(customerPhone);
        }
        continue;
      }

      // Message entrant client : persistance immédiate + debounce avant
      // d'appeler le cerveau (plusieurs messages rapprochés = un seul appel).
      console.log(`📩 ${customerPhone}: ${body.slice(0, 80)}`);
      const conv = await upsertConversation(customerPhone, msg.pushName ?? undefined);
      if (conv) await saveMessage(conv.id, false, body, false, msgId);

      await enqueueIncoming(customerPhone, jid, msgId, body);
    }
  });
}
