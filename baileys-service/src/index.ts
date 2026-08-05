import express from 'express';
import qrcode from 'qrcode';
import {
  connectToWhatsApp,
  getQR,
  isConnected,
  sendAsAgent,
  sendRaw,
  resolveJid,
  getSock,
} from './lib/whatsapp.js';
import {
  pauseConversation,
  resumeConversation,
  saveMessage,
  upsertConversation,
} from './lib/supabase.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 3001;
const SECRET = process.env.BAILEYS_SERVICE_SECRET ?? '';

// Health check — public (healthcheck Railway).
app.get('/health', (_req, res) => {
  res.json({ ok: true, connected: isConnected() });
});

// Tout le reste exige le secret partagé (dette Harmonie Yacht corrigée :
// ses endpoints /send et /qr étaient ouverts).
app.use((req, res, next) => {
  if (!SECRET) return next(); // secret non configuré (dev local)
  if (req.headers['x-baileys-secret'] !== SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

// QR code en base64 PNG (pollé par la page /agent du dashboard).
app.get('/qr', async (_req, res) => {
  if (isConnected()) return res.json({ status: 'connected' });
  const qr = getQR();
  if (!qr) return res.status(202).json({ status: 'waiting' });
  const dataUrl = await qrcode.toDataURL(qr, { width: 300 });
  res.json({ status: 'pending', qr: dataUrl });
});

// Pause de l'agent pour une conversation.
app.post('/pause/:phone', async (req, res) => {
  const { phone } = req.params;
  const hours: number = req.body.hours ?? 24;
  await pauseConversation(phone, hours);
  res.json({ ok: true });
});

// Reprise de l'agent pour une conversation.
app.post('/resume/:phone', async (req, res) => {
  const { phone } = req.params;
  await resumeConversation(phone);
  res.json({ ok: true });
});

// Envoi manuel depuis l'inbox du dashboard (réponse humaine) :
// persisté comme humain + pause de l'agent 24h (l'équipe a repris la main).
app.post('/send', async (req, res) => {
  const { phone, message } = req.body as { phone: string; message: string };
  const sock = getSock();
  if (!sock || !isConnected()) {
    return res.status(503).json({ error: 'WhatsApp non connecté' });
  }
  try {
    const jid = await resolveJid(phone);
    if (!jid) return res.status(404).json({ error: `Numéro ${phone} introuvable sur WhatsApp` });

    const sent = await sock.sendMessage(jid, { text: message });
    const conv = await upsertConversation(phone);
    if (conv) {
      await saveMessage(conv.id, true, message, true, sent?.key?.id ?? undefined);
      await pauseConversation(phone);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Envoi "agent" (relances agent-followups, message final d'escalade) :
// signé agent, simulation de frappe, PAS de pause.
app.post('/send-agent', async (req, res) => {
  const { phone, message } = req.body as { phone: string; message: string };
  const result = await sendAsAgent(phone, message);
  res.status(result.ok ? 200 : 503).json(result);
});

// Notification au gérant : envoi brut, aucune persistance conversationnelle.
app.post('/notify', async (req, res) => {
  const { phone, message } = req.body as { phone: string; message: string };
  const result = await sendRaw(phone, message);
  res.status(result.ok ? 200 : 503).json(result);
});

app.listen(PORT, () => {
  console.log(`🚀 Baileys service (Apolline) on port ${PORT}`);
  connectToWhatsApp().catch(console.error);
});
