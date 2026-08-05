// Supabase Edge Function — agent « Apolline », concierge L'art de vivre.
// Anthropic Messages API : prompt caching (system stable mis en cache) +
// tool use (create_lead, qualify_lead, update_lead_status,
// record_request_brief, escalate_to_human).
//
// Apolline fait du FRONT-OFFICE conversationnel uniquement : accueillir,
// qualifier la demande, rédiger le brief de mission pour l'équipe. Elle ne
// confirme JAMAIS une disponibilité ni un prix ferme — c'est l'équipe humaine
// (escalate_to_human) qui engage la maison.
//
// Chaque appel API est enregistré dans ai_usage_events (via _shared/anthropic.ts)
// → base de la facturation à l'usage affichée sur /facturation.

import { createClient } from "npm:@supabase/supabase-js@2";

// Client Supabase non générique : sans types générés côté Deno, le check
// strict infère `never` sur chaque table. On assume un client souple ici —
// le schéma est vérifié par les migrations et les tests curl.
// deno-lint-ignore no-explicit-any
type Db = any;
import { callAnthropic, hasApiKey, MODEL } from "../_shared/anthropic.ts";
import { cors, json } from "../_shared/cors.ts";
import type { MeterCtx } from "../_shared/metering.ts";
import { notifyOwner } from "../_shared/notify.ts";
import { normalizePhone } from "../_shared/phone.ts";

const MAX_TOOL_TURNS = 6;

// ── Types ───────────────────────────────────────────────────────────
type ChatMsg = { from: "client" | "ai" | "human"; text: string; at: string };
type ApiMessage = { role: "user" | "assistant"; content: unknown };

// ── Outils exposés au modèle ────────────────────────────────────────
const TOOLS = [
  {
    name: "create_lead",
    description:
      "Enrichit la fiche client dès que tu as un prénom (une fiche minimale existe déjà : elle est créée automatiquement au 1er message WhatsApp). À appeler une seule fois.",
    input_schema: {
      type: "object",
      properties: {
        first_name: { type: "string" },
        phone: { type: "string" },
        preferred_language: { type: "string", description: "Langue préférée du client (fr, en…)" },
      },
    },
  },
  {
    name: "qualify_lead",
    description:
      "Enregistre chaque information de qualification DÈS réception, AVANT de répondre au client. Un score ≥ 7 = demande chaude (remonte en priorité côté équipe).",
    input_schema: {
      type: "object",
      properties: {
        score: { type: "integer", minimum: 0, maximum: 10, description: "Intérêt/qualité estimés 0-10" },
        service_type: {
          type: "string",
          enum: ["yacht", "villa", "evenement", "transport", "gastronomie", "bien_etre", "autre"],
          description: "Famille de prestation demandée",
        },
        service_detail: { type: "string", description: "Précision libre (ex. 'charter 30 m, 5 cabines, Grand Prix')" },
        occasion: { type: "string", description: "Occasion (anniversaire, mariage, séminaire…)" },
        party_size: { type: "integer", minimum: 1, description: "Nombre de personnes" },
        desired_date: { type: "string", description: "Date souhaitée (début) au format YYYY-MM-DD" },
        desired_date_end: { type: "string", description: "Date de fin YYYY-MM-DD si séjour multi-jours" },
        desired_time_slot: { type: "string", description: "Créneau (journée, soirée, coucher de soleil…)" },
        budget_range: {
          type: "string",
          enum: ["moins_5k", "5k_15k", "15k_50k", "plus_50k", "non_communique"],
          description: "Enveloppe budget si évoquée — jamais exigée",
        },
        location: { type: "string", description: "Lieu souhaité (Saint-Tropez, Monaco, Courchevel…)" },
      },
    },
  },
  {
    name: "update_lead_status",
    description:
      "Met à jour l'étape du client dans le pipeline. 'contacted' au 1er échange avec prénom, 'qualified' une fois la demande claire, 'lost' si le client se désiste.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["new", "contacted", "qualified", "quote_sent", "followed_up", "booked", "lost"],
        },
      },
      required: ["status"],
    },
  },
  {
    name: "record_request_brief",
    description:
      "Rédige le brief de mission pour l'équipe dès que la demande est suffisamment claire (au minimum : prestation + dates approximatives + nombre de personnes). Le brief est persisté sur la fiche et le statut passe à 'qualified'. Structure attendue : demande précise, dates, lieu, budget si connu, exigences particulières, prochaine étape suggérée pour l'équipe. Mets-le à jour si la demande évolue.",
    input_schema: {
      type: "object",
      properties: {
        brief: {
          type: "string",
          description: "Brief structuré multi-lignes, factuel, prêt à être lu par l'équipe",
        },
      },
      required: ["brief"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Passe la main à l'équipe. À utiliser quand : (1) le client veut CONFIRMER, réserver ou avoir un devis/prix ferme — tu ne t'engages jamais sur une disponibilité ou un prix, (2) négociation, (3) demande sensible, VIP ou hors catalogue, (4) situation ambiguë. La conversation WhatsApp est mise en pause automatiquement et le gérant reçoit une notification. Si tu fournis `final_message`, ce texte est envoyé au client avant la pause — sinon escalade silencieuse. APRÈS cet appel, n'écris RIEN d'autre.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Raison courte, pour l'équipe qui reprend la main" },
        final_message: {
          type: "string",
          description:
            "Message optionnel envoyé au client avant la pause. Ex. : 'Parfait, je transmets à notre équipe qui revient vers vous très rapidement avec une proposition.' Laisser vide pour une escalade silencieuse.",
        },
      },
      required: ["reason"],
    },
  },
];

// ── System prompt — bloc stable (mis en cache côté Anthropic) ────────
// Structure façon "skill" : chaque section couvre UN domaine de comportement.
// Avant d'ajouter une règle, vérifier si elle appartient à une section
// existante plutôt que d'en écrire une variante ailleurs.
function buildStableSystem(config: Record<string, unknown>): string {
  const identity = (config.identity ?? {}) as Record<string, unknown>;
  const agentName = (identity.agent_name as string) ?? "Apolline";
  const company = (identity.company as string) ?? "L'art de vivre";
  return `Tu es ${agentName}, concierge personnelle de ${company}, conciergerie privée (yachts, villas, événements privés, transferts, gastronomie, bien-être). Tu réponds sur WhatsApp.

# 1. IDENTITÉ & TON — LUXE DISCRET
- Vouvoiement impeccable, chaleur sobre. Jamais d'emphase commerciale, jamais de superlatifs en rafale.
- Messages COURTS (1-3 phrases max), façon SMS soigné. Tu es une concierge, pas une brochure.
- Tu ne te présentes JAMAIS comme une IA ou un robot.
- Zéro emoji dans les messages factuels. Un seul emoji maximum, uniquement en accueil ou conclusion chaleureuse. Si tu hésites → pas d'emoji.
- Pas de "Bonjour" si la conversation a déjà commencé — enchaîne directement.
- Tu réponds dans la langue du client (français par défaut, anglais si le client écrit en anglais).

# 2. FORMAT DES MESSAGES
- UN SEUL message par réponse. Une seule idée à la fois.
- Pas de listes à puces, pas de markdown (WhatsApp affiche les astérisques tels quels). Texte brut uniquement.
- Silence quand le client réfléchit : "je regarde", "un instant", "ok" → n'ajoute PAS de message de politesse inutile. Attends sa vraie prochaine demande.
- Pas de forcing : ne pousse jamais à confirmer. Le client avance à son rythme, tu l'accompagnes.

# 3. EXEMPLES DE TON (calque ce registre)
[OUVERTURE]
> "Bonjour, avec grand plaisir. Vous imaginez cela pour quelle occasion et à quelles dates ?"
[QUALIFICATION]
> "Très bien. Pour vous orienter au mieux : vous seriez combien à bord ?"
[BUDGET — en dernier, avec tact]
> "Avez-vous une enveloppe en tête, pour que je vous oriente vers ce qui s'y prête le mieux ?"
[PASSAGE À L'ÉQUIPE]
> "Parfait. Je transmets votre demande à notre équipe, qui revient vers vous très rapidement avec une proposition."
⚠️ À ne PAS faire :
❌ "Bienvenue chez ${company} !! 🎉 Je suis ${agentName}, votre concierge dédiée ! Comment puis-je transformer vos rêves en réalité ?" (emphase, emojis, tirade)
❌ "Nous proposons : • yachts • villas • événements…" (liste à puces, catalogue récité)
❌ "C'est noté !!! Quel est votre budget ?" (budget trop tôt, ton familier)

# 4. ANTI-RÉPÉTITION — RÈGLE D'OR
Une information donnée une fois est acquise pour toute la conversation — tu ne la redis JAMAIS, même reformulée. Une question posée une fois n'est JAMAIS reposée, même si le client répond partiellement ou change de sujet. Après avoir répondu à une question factuelle, ne relance pas automatiquement par une question de qualification.

# 5. MÉMOIRE & FIL
- Relis TOUT l'historique avant de répondre. Ne redemande jamais une info déjà donnée (vérifie aussi la fiche client plus bas).
- Le client peut répondre partiellement — considère l'info comme acquise et enchaîne sur la suite logique.

# 6. QUALIFICATION — L'ORDRE NATUREL
1. La nature de la demande (yacht, villa, événement…) — souvent donnée d'emblée.
2. Les dates (ou la période approximative).
3. Le nombre de personnes.
4. Le lieu souhaité.
5. EN DERNIER, et seulement si utile pour orienter : le budget, avec tact ("une enveloppe en tête ?"). Jamais exigé — si le client élude, n'insiste pas et note non_communique.
Rythme : UNE question à la fois, jamais un interrogatoire. Si le client donne tout d'un coup, ne repose rien.

# 7. PÉRIMÈTRE — CE QUE TU NE FAIS JAMAIS
- Tu ne confirmes JAMAIS une disponibilité (yacht, villa, chef, hélicoptère…). Les disponibilités sont vérifiées par l'équipe. Formule : "je fais vérifier cela par notre équipe".
- Tu n'annonces JAMAIS de prix ferme ni de devis. Tu peux situer un ordre de grandeur UNIQUEMENT s'il figure dans la base de connaissances ci-dessous (from_price) — sinon rien.
- Tu n'inventes JAMAIS une information absente de la base de connaissances. Dis que tu vérifies avec l'équipe, et escalade si besoin.
- Discrétion absolue : tu ne mentionnes jamais d'autres clients, jamais de noms.

# 8. BRIEF DE MISSION (record_request_brief)
Dès que tu connais au minimum prestation + dates approximatives + nombre de personnes, appelle record_request_brief avec un brief factuel et structuré : demande précise, dates, lieu, budget si connu, exigences particulières, prochaine étape suggérée. C'est ce que l'équipe lit en premier — soigne-le. Mets-le à jour si la demande évolue. Le client ne voit jamais le brief.

# 9. ESCALADE VERS L'ÉQUIPE (escalate_to_human)
Cas obligatoires :
1. Le client veut confirmer / réserver / recevoir un devis ou un prix ferme → escalade avec final_message du type "Je transmets votre demande à notre équipe, qui revient vers vous très rapidement avec une proposition."
2. Négociation, demande sensible ou VIP, demande hors catalogue, situation ambiguë → escalade silencieuse (pas de final_message).
Séquence idéale : record_request_brief PUIS escalate_to_human — l'équipe reprend avec un brief propre.
⚠️ APRÈS escalate_to_human, n'écris RIEN d'autre : le final_message suffit s'il y en a un, sinon silence total.

# 10. UTILISATION DES OUTILS (côté serveur, invisible pour le client)
- create_lead : dès que tu as le prénom — ça enrichit la fiche existante et passe le statut à "contacted".
- qualify_lead : IMMÉDIATEMENT après chaque nouvelle info (prestation, dates, nb pers., lieu, budget, score), AVANT de répondre.
- update_lead_status : fais avancer le pipeline.
- record_request_brief / escalate_to_human : selon les règles ci-dessus.

⚠️ RÈGLE ABSOLUE : après CHAQUE appel d'outil (sauf escalate_to_human), tu DOIS écrire un message texte au client. Les outils sont silencieux côté client — si tu sors sans texte, le client reçoit le silence et la conversation meurt. Seule exception : escalate_to_human.

# Base de connaissances (faits — source de vérité)
${JSON.stringify(config, null, 2)}`;
}

// ── System prompt — bloc dynamique (fiche client, non caché) ─────────
function buildDynamicSystem(lead: Record<string, unknown> | null, nowIso: string): string {
  if (!lead) {
    return `Date et heure actuelles : ${nowIso} (Europe/Paris).\nAucune fiche client connue pour ce contact (nouveau contact — pense à create_lead dès que tu as un prénom).`;
  }
  // Liste explicite : ce que tu SAIS déjà (ne redemande pas) vs ce qui MANQUE.
  const known: string[] = [];
  const missing: string[] = [];
  const add = (label: string, value: unknown) => {
    if (value !== null && value !== undefined && value !== "") known.push(`${label} = ${JSON.stringify(value)}`);
    else missing.push(label);
  };
  add("prénom", lead.first_name);
  add("prestation", lead.service_type);
  add("détail_prestation", lead.service_detail);
  add("occasion", lead.occasion);
  add("nb_personnes", lead.party_size);
  add("date_souhaitée", lead.desired_date);
  add("date_fin", lead.desired_date_end);
  add("créneau", lead.desired_time_slot);
  add("lieu", lead.location);
  add("budget", lead.budget_range);
  const statut = lead.status ?? "new";
  const score = lead.score ?? "—";

  const briefSection = lead.ai_memo
    ? `\n# Brief de mission déjà rédigé (mets-le à jour via record_request_brief si la demande évolue)\n${lead.ai_memo}`
    : "";

  return `Date et heure actuelles : ${nowIso} (Europe/Paris).

# Fiche client (id ${lead.id}, statut ${statut}, score ${score})
Tu connais DÉJÀ ces infos — ne les redemande JAMAIS :
${known.length ? known.map((k) => "  - " + k).join("\n") : "  (aucune info collectée à ce stade)"}

Infos encore à collecter au fil de la conversation (si pertinent — jamais en interrogatoire) :
${missing.length ? missing.map((m) => "  - " + m).join("\n") : "  (tout est collecté ✓)"}

⚠️ Si le client donne UNE des infos manquantes, persiste-la immédiatement (qualify_lead) puis enchaîne sur l'étape suivante logique.${briefSection}`;
}

// ── Exécution des outils côté Supabase ──────────────────────────────
async function runTool(
  supabase: Db,
  name: string,
  input: Record<string, unknown>,
  state: { leadId: string | null; escalated: boolean; escalationFinalMessage: string; phone: string | null },
): Promise<string> {
  const now = new Date().toISOString();
  switch (name) {
    case "create_lead": {
      // Enrichit le stub auto-créé au 1er message WhatsApp si présent,
      // sinon crée une nouvelle fiche.
      if (state.leadId) {
        const patch: Record<string, unknown> = { updated_at: now, last_interaction_at: now };
        if (input.first_name) {
          patch.first_name = input.first_name;
          // Passe de "new" (stub) à "contacted" dès qu'on a un prénom.
          patch.status = "contacted";
        }
        const { error } = await supabase.from("leads").update(patch).eq("id", state.leadId);
        return error ? `Erreur mise à jour: ${error.message}` : `Fiche enrichie (id ${state.leadId}).`;
      }
      const insertPhone = normalizePhone((input.phone as string) ?? state.phone);
      const { data, error } = await supabase
        .from("leads")
        .insert({
          first_name: (input.first_name as string) ?? null,
          phone: insertPhone,
          source_channel: "whatsapp",
          status: input.first_name ? "contacted" : "new",
          last_interaction_at: now,
        })
        .select("id")
        .single();
      if (error) return `Erreur création: ${error.message}`;
      state.leadId = data.id as string;
      return `Fiche créée (id ${data.id}).`;
    }
    case "qualify_lead": {
      if (!state.leadId) return "Aucune fiche à mettre à jour — appelle create_lead d'abord.";
      const patch: Record<string, unknown> = { updated_at: now, last_interaction_at: now };
      const FIELDS = [
        "score",
        "service_type",
        "service_detail",
        "occasion",
        "party_size",
        "desired_date",
        "desired_date_end",
        "desired_time_slot",
        "budget_range",
        "location",
      ];
      for (const k of FIELDS) {
        if (input[k] !== undefined && input[k] !== null) patch[k] = input[k];
      }
      const { error } = await supabase.from("leads").update(patch).eq("id", state.leadId);
      if (error) return `Erreur: ${error.message}`;

      // Auto-qualification : prestation + date connues → statut "qualified"
      // (sauf si déjà plus avancé : quote_sent / booked / lost).
      const { data: refreshed } = await supabase
        .from("leads")
        .select("status, service_type, desired_date")
        .eq("id", state.leadId)
        .single();
      if (refreshed?.service_type && refreshed?.desired_date) {
        const earlier = ["new", "contacted"];
        if (refreshed.status && earlier.includes(refreshed.status as string)) {
          await supabase
            .from("leads")
            .update({ status: "qualified", updated_at: now })
            .eq("id", state.leadId);
          return "Informations enregistrées + statut → qualified (prestation + date connues).";
        }
      }
      return "Informations enregistrées.";
    }
    case "update_lead_status": {
      if (!state.leadId) return "Aucune fiche à mettre à jour.";
      const { error } = await supabase
        .from("leads")
        .update({ status: input.status, updated_at: now, last_interaction_at: now })
        .eq("id", state.leadId);
      return error ? `Erreur: ${error.message}` : `Statut mis à jour : ${input.status}.`;
    }
    case "record_request_brief": {
      if (!state.leadId) return "Aucune fiche — appelle create_lead d'abord.";
      const brief = String(input.brief ?? "").trim();
      if (!brief) return "Brief vide — rien enregistré.";
      const { data: current } = await supabase
        .from("leads")
        .select("status")
        .eq("id", state.leadId)
        .single();
      const patch: Record<string, unknown> = { ai_memo: brief, updated_at: now, last_interaction_at: now };
      if (current?.status && ["new", "contacted"].includes(current.status as string)) {
        patch.status = "qualified";
      }
      const { error } = await supabase.from("leads").update(patch).eq("id", state.leadId);
      return error
        ? `Erreur: ${error.message}`
        : "Brief de mission enregistré sur la fiche (statut → qualified). Continue la conversation.";
    }
    case "escalate_to_human": {
      state.escalated = true;
      state.escalationFinalMessage = (input.final_message as string) ?? "";
      if (state.leadId) {
        await supabase
          .from("leads")
          .update({ needs_human_intervention: true, updated_at: now })
          .eq("id", state.leadId);
      }
      // Met la conversation WhatsApp en pause 24h — l'équipe reprend la main.
      if (state.phone) {
        const pausedUntil = new Date(Date.now() + 24 * 3_600_000).toISOString();
        await supabase
          .from("wa_conversations")
          .update({ is_paused: true, paused_until: pausedUntil })
          .eq("customer_phone", state.phone);
      }
      await notifyOwner(
        `🔔 Escalade Apolline\n${String(input.reason ?? "—")}${state.phone ? `\nClient : ${state.phone}` : ""}\nBrief sur la fiche dans le dashboard.`,
      );
      const hasFinal = !!state.escalationFinalMessage;
      return `Escalade enregistrée (raison: ${input.reason ?? "—"}). ${hasFinal ? `Message final au client : "${state.escalationFinalMessage}"` : "Escalade silencieuse — ne génère AUCUN texte."} Sors immédiatement.`;
    }
    default:
      return `Outil inconnu: ${name}`;
  }
}

// ── Handler ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!hasApiKey()) return json({ error: "ANTHROPIC_API_KEY manquante (secret Supabase)" }, 500);

  // Auth par secret partagé : appliquée seulement si AGENT_SHARED_SECRET est défini.
  const sharedSecret = Deno.env.get("AGENT_SHARED_SECRET");
  if (sharedSecret && req.headers.get("x-agent-secret") !== sharedSecret) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: { message?: string; lead_id?: string; phone?: string; history?: ChatMsg[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON invalide" }, 400);
  }
  const userText = (body.message ?? "").trim();
  if (!userText) return json({ error: "Champ 'message' requis" }, 400);

  const supabase: Db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Base de connaissances (source de vérité, mise en cache côté Anthropic)
  const { data: config, error: cfgErr } = await supabase
    .from("agent_config")
    .select("identity, services, faq, business_hours")
    .limit(1)
    .single();
  if (cfgErr || !config) return json({ error: `agent_config introuvable: ${cfgErr?.message}` }, 500);

  // Contexte lead — recherche par lead_id, sinon par téléphone normalisé.
  const normalizedPhone = normalizePhone(body.phone);
  let lead: Record<string, unknown> | null = null;
  if (body.lead_id) {
    const { data } = await supabase.from("leads").select("*").eq("id", body.lead_id).maybeSingle();
    lead = data;
  } else if (normalizedPhone) {
    const { data } = await supabase.from("leads").select("*").eq("phone", normalizedPhone).maybeSingle();
    lead = data;
  }

  // Stub auto au premier message WhatsApp : garantit que tout contact apparaisse
  // dans /leads dès le premier échange, même si Apolline n'a pas encore appelé
  // create_lead (le client n'a pas encore donné son prénom).
  if (!lead && normalizedPhone) {
    const { data: stub } = await supabase
      .from("leads")
      .insert({
        phone: normalizedPhone,
        source_channel: "whatsapp",
        status: "new",
        last_interaction_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    lead = stub;
  }

  const state = {
    leadId: (lead?.id as string) ?? null,
    escalated: false,
    escalationFinalMessage: "",
    phone: normalizedPhone ?? (lead?.phone as string) ?? null,
  };

  const meter: MeterCtx = {
    supabase,
    source: "agent",
    leadId: state.leadId,
    phone: state.phone,
    turn: 0,
  };

  // Lie la conversation WhatsApp au lead — permet d'afficher le fil WA sur la
  // fiche du client dans le dashboard.
  if (state.leadId && state.phone) {
    await supabase
      .from("wa_conversations")
      .update({ lead_id: state.leadId })
      .eq("customer_phone", state.phone)
      .is("lead_id", null);
  }

  // Historique → messages API. Si non fourni, rechargé depuis la conversation
  // du lead pour une continuité stateful par téléphone/lead.
  let history: ChatMsg[] = body.history ?? [];
  if (!body.history && state.leadId) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("messages")
      .eq("lead_id", state.leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (conv && Array.isArray(conv.messages)) {
      history = (conv.messages as ChatMsg[]).slice(-20);
    }
  }
  const messages: ApiMessage[] = history.map((m) => ({
    role: m.from === "client" ? "user" : "assistant",
    content: m.text,
  }));
  messages.push({ role: "user", content: userText });

  // System : bloc stable (caché) + bloc dynamique
  const nowIso = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  const system = [
    { type: "text", text: buildStableSystem(config), cache_control: { type: "ephemeral" } },
    { type: "text", text: buildDynamicSystem(lead, nowIso) },
  ];

  const baseBody = {
    model: MODEL,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system,
    tools: TOOLS,
  };

  // Boucle tool_use / tool_result
  let reply = "";
  const usedTools: string[] = [];
  try {
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      meter.turn = turn + 1;
      const data = await callAnthropic({ ...baseBody, messages }, meter);
      messages.push({ role: "assistant", content: data.content });

      const toolUses = (data.content as Array<Record<string, unknown>>).filter((b) => b.type === "tool_use");
      reply = (data.content as Array<Record<string, unknown>>)
        .filter((b) => b.type === "text")
        .map((b) => b.text as string)
        .join("\n")
        .trim();

      if (data.stop_reason !== "tool_use" || toolUses.length === 0) break;

      const results = [];
      for (const tu of toolUses) {
        usedTools.push(tu.name as string);
        const out = await runTool(supabase, tu.name as string, (tu.input as Record<string, unknown>) ?? {}, state);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
      }
      // create_lead a pu fixer le leadId en cours de route — le metering suit.
      meter.leadId = state.leadId;
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    return json({ error: String(e) }, 502);
  }

  // Filet de sécurité 1 : si Apolline n'a rien écrit au client, on relance UN
  // tour en interdisant les tools pour forcer un texte. Sans ça, le client
  // reçoit le silence et la conversation meurt.
  if (!reply && !state.escalated) {
    try {
      messages.push({
        role: "user",
        content:
          "(rappel système — invisible client) Tu n'as RIEN écrit au client. Rédige maintenant ta réponse texte (1-3 phrases, ton concierge sobre). Si tu viens d'utiliser des outils, appuie-toi sur leurs résultats. Ne redemande JAMAIS une info déjà connue. Enchaîne sur la prochaine étape logique.",
      });
      meter.turn = MAX_TOOL_TURNS + 1;
      const final = await callAnthropic(
        { ...baseBody, messages, tool_choice: { type: "none" } },
        meter,
      );
      reply = (final.content as Array<Record<string, unknown>>)
        .filter((b) => b.type === "text")
        .map((b) => b.text as string)
        .join("\n")
        .trim();
    } catch (e) {
      console.error("[agent-concierge] retry forceTextOnly failed:", e);
    }
  }

  // Sur escalade : message final fourni par Apolline, ou vide (silence total).
  if (state.escalated) reply = state.escalationFinalMessage || "";

  // Filet de sécurité 2 : anti-leak. Le modèle génère parfois des notes méta
  // entre parenthèses quand il juge qu'aucune réponse n'est nécessaire.
  // Ces notes ne doivent JAMAIS partir au client.
  const metaPhraseRe =
    /réponse d[ée]j[àa] envoy[ée]e|aucune action(?:\s+suppl[ée]mentaire)?\s+n[ée]cessaire|invisible client|pas de r[ée]ponse [àa] envoyer|rien [àa] r[ée]pondre|no reply needed/i;
  if (reply && (/^\s*\(.*\)\s*$/s.test(reply) || metaPhraseRe.test(reply))) {
    console.warn("[agent-concierge] meta reply suppressed:", reply.slice(0, 200));
    reply = "";
  }

  // Persistance de la conversation (format du dashboard : {from, text, at}).
  // Le message AI n'est inséré que s'il a un vrai contenu.
  if (state.leadId) {
    const now = new Date().toISOString();
    const newMsgs: ChatMsg[] = [{ from: "client", text: userText, at: now }];
    if (reply) newMsgs.push({ from: "ai", text: reply, at: now });
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, messages")
      .eq("lead_id", state.leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (conv) {
      const prev = Array.isArray(conv.messages) ? (conv.messages as ChatMsg[]) : [];
      await supabase
        .from("conversations")
        .update({ messages: [...prev, ...newMsgs], updated_at: now })
        .eq("id", conv.id);
    } else {
      await supabase.from("conversations").insert({
        lead_id: state.leadId,
        channel: "whatsapp",
        messages: newMsgs,
      });
    }
    await supabase.from("leads").update({ last_interaction_at: now }).eq("id", state.leadId);
  }

  return json({ reply, lead_id: state.leadId, escalated: state.escalated, tools_used: usedTools });
});
