// Supabase Edge Function — relances automatiques d'Apolline (cron horaire).
//
// Envoi via le service Baileys (endpoint /send-agent : message signé agent,
// sans pause de la conversation). Cron : POST avec header x-cron-secret.
// Mode manuel : POST {lead_id} bypasse l'intervalle (bouton « Relancer »
// depuis la fiche du dashboard).
//
// Chaque rédaction de relance passe par _shared/anthropic.ts → metering
// ai_usage_events avec source = 'followup'.

import { createClient } from "npm:@supabase/supabase-js@2";
import { callAnthropic, hasApiKey, MODEL } from "../_shared/anthropic.ts";
import { json } from "../_shared/cors.ts";
import { sendWhatsApp } from "../_shared/notify.ts";

// deno-lint-ignore no-explicit-any
type Db = any;
// deno-lint-ignore no-explicit-any
type Lead = Record<string, any>;

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const BAILEYS_SERVICE_URL = Deno.env.get("BAILEYS_SERVICE_URL") ?? "";

const DEFAULT_SECOND_INTERVAL = 72; // 3 j entre 1ère et 2e relance
const MAX_FOLLOWUPS_DEFAULT = 2;    // 2 relances max (évite l'effet forcing)
const ACTIVE_STATUSES = ["contacted", "qualified", "quote_sent", "followed_up"];

// 1ère relance : délai adaptatif selon l'horizon de la demande.
function getFirstFollowupHours(lead: Lead): number {
  if (!lead.desired_date) return 48; // pas de date → 2 jours
  const daysUntil = (new Date(lead.desired_date).getTime() - Date.now()) / 86_400_000;
  if (daysUntil < 7) return 24;   // urgence : prestation dans la semaine
  if (daysUntil < 30) return 72;  // moyen terme : 3 jours
  return 120;                     // long terme (> 30 j) : 5 jours — pas de forcing
}

async function writeFollowup(
  supabase: Db,
  lead: Lead,
  followupNumber: number,
  identity: Record<string, unknown>,
): Promise<string> {
  const agentName = (identity.agent_name as string) ?? "Apolline";
  const company = (identity.company as string) ?? "L'art de vivre";
  const system = `Tu es ${agentName}, concierge personnelle de ${company} (conciergerie privée : yachts, villas, événements, transferts, gastronomie, bien-être).
Tu rédiges UNE relance WhatsApp pour un client qui n'a pas répondu.

# Style maison — luxe discret :
> "Bonjour {prénom}, avez-vous eu un moment pour y réfléchir ? Nous restons à votre entière disposition."
> "Bonjour, votre projet de {prestation} est-il toujours d'actualité ? Nous serions ravis de vous accompagner."
> "Bonjour {prénom}, je me permets un dernier message — n'hésitez pas à revenir vers nous le moment venu. Très belle journée."

# Règles
- Très court (1-2 phrases), vouvoiement impeccable, chaleur sobre. Zéro emphase commerciale.
- Aucun emoji, ou un seul très sobre si le ton s'y prête vraiment.
- Si tu connais le prénom → utilise-le naturellement. Sinon "Bonjour" suffit.
- Ne propose JAMAIS de remise, ne confirme jamais une disponibilité ni un prix.
- C'est la relance n°${followupNumber}. Plus le n° monte, plus tu es légère et laisses une porte de sortie élégante ("le moment venu", "à votre disposition").
- Tu ne te présentes JAMAIS comme une IA.

Réponds UNIQUEMENT par le texte du message à envoyer, sans guillemets ni préambule.`;

  const ctx = {
    prénom: lead.first_name,
    prestation: lead.service_type,
    détail: lead.service_detail,
    occasion: lead.occasion,
    personnes: lead.party_size,
    date_souhaitée: lead.desired_date,
    lieu: lead.location,
    statut: lead.status,
  };
  const data = await callAnthropic(
    {
      model: MODEL,
      max_tokens: 300,
      system,
      messages: [
        { role: "user", content: `Rédige la relance n°${followupNumber} pour ce client : ${JSON.stringify(ctx)}` },
      ],
    },
    { supabase, source: "followup", leadId: lead.id, phone: lead.phone },
  );
  return (data.content ?? [])
    // deno-lint-ignore no-explicit-any
    .filter((b: any) => b.type === "text")
    // deno-lint-ignore no-explicit-any
    .map((b: any) => b.text)
    .join("\n")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "unauthorized" }, 401);
  if (!hasApiKey()) return json({ error: "ANTHROPIC_API_KEY manquante" }, 500);
  if (!BAILEYS_SERVICE_URL) return json({ error: "BAILEYS_SERVICE_URL manquant" }, 500);

  // Mode "manuel" : si lead_id est fourni, on traite uniquement ce lead en
  // bypassant le check d'intervalle (clic sur « Relancer » depuis la fiche).
  let manualLeadId: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.lead_id === "string") manualLeadId = body.lead_id;
  } catch { /* body vide = mode cron normal */ }

  const supabase: Db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: config } = await supabase
    .from("agent_config")
    .select("identity, max_followups, auto_followup_enabled")
    .limit(1)
    .single();

  // En mode manuel, on ne respecte pas auto_followup_enabled (l'humain a cliqué).
  if (!manualLeadId && !config?.auto_followup_enabled) {
    return json({ skipped: "auto_followup_enabled = false", processed: 0 });
  }
  const maxFollowups = (config?.max_followups as number) ?? MAX_FOLLOWUPS_DEFAULT;
  const identity = (config?.identity ?? {}) as Record<string, unknown>;

  let leadsQuery = supabase
    .from("leads")
    .select(
      "id, first_name, phone, service_type, service_detail, occasion, party_size, desired_date, location, status, last_interaction_at, created_at, followup_count, last_followup_at",
    );

  if (manualLeadId) {
    leadsQuery = leadsQuery.eq("id", manualLeadId);
  } else {
    leadsQuery = leadsQuery
      .in("status", ACTIVE_STATUSES)
      .eq("needs_human_intervention", false)
      .eq("archived", false)
      .not("phone", "is", null)
      .lt("followup_count", maxFollowups);
  }

  const { data: leads, error } = await leadsQuery;
  if (error) return json({ error: error.message }, 500);

  const now = Date.now();
  const results: Array<{ lead_id: string; sent: boolean; reason?: string }> = [];

  for (const lead of leads ?? []) {
    const count = (lead.followup_count as number) ?? 0;
    if (!manualLeadId) {
      // Mode cron : on respecte l'intervalle adaptatif.
      const ref = (lead.last_followup_at as string) ?? (lead.last_interaction_at as string) ?? (lead.created_at as string);
      if (!ref) continue;
      const hoursSince = (now - new Date(ref).getTime()) / 3_600_000;
      const dueAfter = count === 0 ? getFirstFollowupHours(lead) : DEFAULT_SECOND_INTERVAL;
      if (hoursSince < dueAfter) continue;

      // Conversation en pause (humain a repris la main) → pas de relance auto.
      const { data: waConv } = await supabase
        .from("wa_conversations")
        .select("is_paused, paused_until")
        .eq("customer_phone", lead.phone)
        .maybeSingle();
      if (waConv?.is_paused && (!waConv.paused_until || new Date(waConv.paused_until) > new Date())) {
        continue;
      }
    } else if (!lead.phone) {
      results.push({ lead_id: lead.id, sent: false, reason: "pas de téléphone" });
      continue;
    }

    try {
      const text = await writeFollowup(supabase, lead, count + 1, identity);
      if (!text) {
        results.push({ lead_id: lead.id, sent: false, reason: "message vide" });
        continue;
      }
      const ok = await sendWhatsApp(lead.phone, text);
      const nowIso = new Date().toISOString();

      if (ok) {
        await supabase.from("leads").update({
          followup_count: count + 1,
          last_followup_at: nowIso,
          last_interaction_at: nowIso,
          status: "followed_up",
          updated_at: nowIso,
        }).eq("id", lead.id);

        const { data: conv } = await supabase
          .from("conversations")
          .select("id, messages")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const newMsg = { from: "ai", text, at: nowIso };
        if (conv) {
          const prev = Array.isArray(conv.messages) ? conv.messages : [];
          await supabase
            .from("conversations")
            .update({ messages: [...prev, newMsg], updated_at: nowIso })
            .eq("id", conv.id);
        } else {
          await supabase
            .from("conversations")
            .insert({ lead_id: lead.id, channel: "whatsapp", messages: [newMsg] });
        }
      }
      results.push({ lead_id: lead.id, sent: ok, reason: ok ? undefined : "envoi Baileys échoué" });
    } catch (e) {
      console.error("followup failed", lead.id, e);
      results.push({ lead_id: lead.id, sent: false, reason: String(e) });
    }
  }

  return json({ processed: results.length, sent: results.filter((r) => r.sent).length, results });
});
