// Debounce des messages entrants — un client qui envoie plusieurs messages
// rapprochés (« Bonjour » + « Je cherche un yacht ») ne déclenche qu'UN appel
// au cerveau, avec tous les messages concaténés.
//
// Chez Harmonie Yacht, ce debounce vivait dans le webhook Meta (abandonné ici).
// Le service Baileys étant un process Node unique, un simple timer par
// téléphone suffit — la table wa_inbox sert de dédup (wa_message_id unique)
// et de reprise après redémarrage Railway (sweep des messages orphelins).

import {
  fetchPendingInbox,
  insertInbox,
  markInboxProcessed,
  pendingInboxPhones,
} from './supabase.js';

const WA_DEBOUNCE_MS = parseInt(process.env.WA_DEBOUNCE_MS ?? '12000', 10);

export type FlushHandler = (phone: string, jid: string | null, text: string) => Promise<void>;

let handler: FlushHandler | null = null;
const timers = new Map<string, NodeJS.Timeout>();
// Dernier JID vu par téléphone — nécessaire pour répondre aux contacts en
// mode privacy (@lid) sans lookup. Perdu au restart : le sweep retombe alors
// sur la résolution heuristique du handler (jid null).
const lastJid = new Map<string, string>();

export function initDebounce(h: FlushHandler) {
  handler = h;
}

/** Enfile un message entrant et (ré)arme le timer du numéro. */
export async function enqueueIncoming(
  phone: string,
  jid: string,
  msgId: string,
  text: string,
): Promise<void> {
  const inserted = await insertInbox(msgId, phone, text);
  if (!inserted) return; // écho / doublon Baileys — déjà en buffer

  lastJid.set(phone, jid);
  const existing = timers.get(phone);
  if (existing) clearTimeout(existing);
  timers.set(
    phone,
    setTimeout(() => {
      timers.delete(phone);
      void flushPhone(phone);
    }, WA_DEBOUNCE_MS),
  );
}

/** Traite tous les messages en attente d'un numéro (concaténés). */
export async function flushPhone(phone: string): Promise<void> {
  if (!handler) return;
  const rows = await fetchPendingInbox(phone);
  if (rows.length === 0) return;

  // Marqué AVANT l'appel au cerveau : en cas d'erreur on préfère perdre une
  // réponse (le client relancera) que de répondre en double après un retry.
  await markInboxProcessed(rows.map((r) => r.id));

  const text = rows.map((r) => r.text).join('\n');
  try {
    await handler(phone, lastJid.get(phone) ?? null, text);
  } catch (e) {
    console.error('[debounce] flush failed', phone, e);
  }
}

/**
 * Au démarrage : traite les messages restés en buffer (service redémarré
 * pendant la fenêtre de debounce). On ne prend que les messages de plus de
 * 30 s pour ne pas court-circuiter un debounce en cours.
 */
export async function sweepOrphans(): Promise<void> {
  const phones = await pendingInboxPhones(30_000);
  for (const phone of phones) {
    if (timers.has(phone)) continue; // un debounce est déjà armé
    console.log(`🧹 Sweep messages orphelins pour ${phone}`);
    await flushPhone(phone);
  }
}
