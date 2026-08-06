// Mode démonstration — actif quand AUCUNE variable Supabase n'est configurée
// (déploiement Vercel « à vide », pour montrer le dashboard sans rien brancher).
// Toutes les pages affichent alors ce jeu de données fictif, et les actions
// serveur deviennent des no-op. Dès que NEXT_PUBLIC_SUPABASE_URL est renseignée,
// le mode réel reprend automatiquement — aucun code à changer.

import type { Lead } from "@/lib/leads";

export function isDemo(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

const now = () => Date.now();
const hoursAgo = (h: number) => new Date(now() - h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(now() - d * 86_400_000).toISOString();
const inDays = (d: number) => new Date(now() + d * 86_400_000).toISOString().slice(0, 10);

export const demoLeads: Lead[] = [
  {
    id: "demo-1", first_name: "Sophie", phone: "+33612000001", source_channel: "whatsapp",
    status: "qualified", score: 9, service_type: "yacht",
    service_detail: "Charter 30 m avec équipage, journée", occasion: "Anniversaire de mariage",
    party_size: 10, desired_date: inDays(18), desired_date_end: null, desired_time_slot: "journée",
    budget_range: "15k_50k", location: "Monaco",
    ai_memo: "Demande : charter yacht ~30 m, journée complète au départ de Monaco.\nDates : dans ~3 semaines, flexible ±2 jours.\nInvités : 10 adultes.\nBudget : 15-50 k€.\nExigences : chef à bord, décoration anniversaire.\nProchaine étape : proposer 2-3 yachts avec devis.",
    needs_human_intervention: false, followup_count: 0, last_followup_at: null,
    last_interaction_at: hoursAgo(2), archived: false, created_at: daysAgo(3),
  },
  {
    id: "demo-2", first_name: "James", phone: "+44770000002", source_channel: "whatsapp",
    status: "quote_sent", score: 8, service_type: "villa",
    service_detail: "Villa 6 chambres, vue mer, staff complet", occasion: "Vacances en famille",
    party_size: 12, desired_date: inDays(40), desired_date_end: inDays(54), desired_time_slot: null,
    budget_range: "plus_50k", location: "Saint-Tropez",
    ai_memo: "Demande : villa 6+ chambres à Saint-Tropez, 2 semaines en haute saison.\nStaff : chef + ménage quotidien.\nBudget : > 50 k€.\nProchaine étape : devis envoyé, relancer sous 72 h.",
    needs_human_intervention: false, followup_count: 1, last_followup_at: daysAgo(1),
    last_interaction_at: daysAgo(1), archived: false, created_at: daysAgo(8),
  },
  {
    id: "demo-3", first_name: "Isabelle", phone: "+33612000003", source_channel: "whatsapp",
    status: "booked", score: 9, service_type: "evenement",
    service_detail: "Soirée 50 ans, 80 invités", occasion: "50e anniversaire",
    party_size: 80, desired_date: inDays(25), desired_date_end: null, desired_time_slot: "soirée",
    budget_range: "15k_50k", location: "Cannes",
    ai_memo: "Confirmé : lieu privatisé à Cannes, traiteur étoilé, DJ. Acompte reçu.",
    needs_human_intervention: false, followup_count: 0, last_followup_at: null,
    last_interaction_at: daysAgo(3), archived: false, created_at: daysAgo(21),
  },
  {
    id: "demo-4", first_name: "Karim", phone: "+33612000004", source_channel: "whatsapp",
    status: "new", score: 6, service_type: "yacht", service_detail: null, occasion: null,
    party_size: 6, desired_date: null, desired_date_end: null, desired_time_slot: null,
    budget_range: "non_communique", location: "Cannes", ai_memo: null,
    needs_human_intervention: false, followup_count: 0, last_followup_at: null,
    last_interaction_at: hoursAgo(0.6), archived: false, created_at: hoursAgo(0.6),
  },
  {
    id: "demo-5", first_name: "Alexandre", phone: "+33612000006", source_channel: "whatsapp",
    status: "qualified", score: 7, service_type: "transport",
    service_detail: "Hélicoptère Nice → Courchevel A/R", occasion: null,
    party_size: 4, desired_date: inDays(10), desired_date_end: null, desired_time_slot: "matin",
    budget_range: "5k_15k", location: "Nice",
    ai_memo: "Demande : transfert héli Nice → Courchevel aller-retour, 4 pax + bagages ski.\nProchaine étape : vérifier dispo opérateur.",
    needs_human_intervention: true, followup_count: 0, last_followup_at: null,
    last_interaction_at: hoursAgo(4), archived: false, created_at: daysAgo(5),
  },
  {
    id: "demo-6", first_name: "Camille", phone: "+33612000011", source_channel: "whatsapp",
    status: "quote_sent", score: 7, service_type: "yacht",
    service_detail: "Sunset cruise 3 h", occasion: "Demande en mariage",
    party_size: 2, desired_date: inDays(9), desired_date_end: null, desired_time_slot: "coucher de soleil",
    budget_range: "5k_15k", location: "Monaco",
    ai_memo: "Demande : croisière privée au coucher du soleil, demande en mariage.\nExigences : fleurs, champagne, photographe discret.\nDevis envoyé.",
    needs_human_intervention: false, followup_count: 0, last_followup_at: null,
    last_interaction_at: hoursAgo(30), archived: false, created_at: daysAgo(7),
  },
  {
    id: "demo-7", first_name: "Nadia", phone: "+33612000009", source_channel: "whatsapp",
    status: "contacted", score: 5, service_type: "gastronomie",
    service_detail: "Chef à domicile pour dîner de 8", occasion: "Dîner d'affaires",
    party_size: 8, desired_date: inDays(6), desired_date_end: null, desired_time_slot: "soirée",
    budget_range: "moins_5k", location: "Nice", ai_memo: null,
    needs_human_intervention: false, followup_count: 0, last_followup_at: null,
    last_interaction_at: hoursAgo(6), archived: false, created_at: daysAgo(2),
  },
  {
    id: "demo-8", first_name: "Pierre", phone: "+33612000013", source_channel: "whatsapp",
    status: "booked", score: 8, service_type: "gastronomie",
    service_detail: "Chef étoilé à la villa, 2 dîners", occasion: "Séjour famille",
    party_size: 10, desired_date: inDays(15), desired_date_end: null, desired_time_slot: null,
    budget_range: "5k_15k", location: "Saint-Jean-Cap-Ferrat",
    ai_memo: "Confirmé : chef partenaire réservé pour les 2 dîners.",
    needs_human_intervention: false, followup_count: 0, last_followup_at: null,
    last_interaction_at: daysAgo(6), archived: false, created_at: daysAgo(14),
  },
];

export const demoConversations: Record<string, Array<{ from: "client" | "ai" | "human"; text: string; at: string }>> = {
  "demo-1": [
    { from: "client", text: "Bonjour, nous cherchons un yacht pour fêter notre anniversaire de mariage, une dizaine d'invités.", at: daysAgo(3) },
    { from: "ai", text: "Bonsoir, avec grand plaisir — félicitations à vous deux. Vous imaginez plutôt une journée en mer ou une soirée au mouillage ?", at: daysAgo(3) },
    { from: "client", text: "Une journée complète, au départ de Monaco idéalement.", at: daysAgo(3) },
    { from: "ai", text: "C'est noté. Pour vous proposer les bons bateaux : à quelle date pensez-vous, et souhaitez-vous un chef à bord ?", at: daysAgo(3) },
    { from: "client", text: "Dans 3 semaines environ, et oui pour le chef !", at: hoursAgo(2) },
    { from: "ai", text: "Parfait. Je transmets votre demande à notre équipe, qui revient vers vous très rapidement avec une sélection et les tarifs.", at: hoursAgo(2) },
  ],
  "demo-5": [
    { from: "client", text: "Il me faudrait l'hélico assez tôt le matin en fait, 8h max à Courchevel.", at: hoursAgo(4) },
    { from: "human", text: "Bonjour Alexandre, je vérifie ça avec notre opérateur et je reviens vers vous d'ici midi.", at: hoursAgo(3) },
  ],
};

export const demoWaConversations = [
  { id: "demo-wa-1", customer_phone: "+33612000001", customer_name: "Sophie", is_paused: false, paused_until: null, last_message_at: hoursAgo(2) },
  { id: "demo-wa-4", customer_phone: "+33612000004", customer_name: "Karim", is_paused: false, paused_until: null, last_message_at: hoursAgo(0.6) },
  { id: "demo-wa-5", customer_phone: "+33612000006", customer_name: "Alexandre", is_paused: true, paused_until: hoursAgo(-20), last_message_at: hoursAgo(3) },
  { id: "demo-wa-6", customer_phone: "+33612000011", customer_name: "Camille", is_paused: false, paused_until: null, last_message_at: hoursAgo(30) },
];

export const demoWaMessages: Record<string, Array<{ id: string; from_me: boolean; is_from_human: boolean; body: string; created_at: string }>> = {
  "+33612000001": [
    { id: "m1", from_me: false, is_from_human: false, body: "Bonjour, nous cherchons un yacht pour fêter notre anniversaire de mariage, une dizaine d'invités.", created_at: daysAgo(3) },
    { id: "m2", from_me: true, is_from_human: false, body: "Bonsoir, avec grand plaisir — félicitations à vous deux. Vous imaginez plutôt une journée en mer ou une soirée au mouillage ?", created_at: daysAgo(3) },
    { id: "m3", from_me: false, is_from_human: false, body: "Une journée complète, au départ de Monaco idéalement.", created_at: daysAgo(3) },
    { id: "m4", from_me: true, is_from_human: false, body: "C'est noté. Pour vous proposer les bons bateaux : à quelle date pensez-vous, et souhaitez-vous un chef à bord ?", created_at: daysAgo(3) },
    { id: "m5", from_me: false, is_from_human: false, body: "Dans 3 semaines environ, et oui pour le chef !", created_at: hoursAgo(2) },
    { id: "m6", from_me: true, is_from_human: false, body: "Parfait. Je transmets votre demande à notre équipe, qui revient vers vous très rapidement avec une sélection et les tarifs.", created_at: hoursAgo(2) },
  ],
  "+33612000004": [
    { id: "m7", from_me: false, is_from_human: false, body: "Bonjour, vous louez des yachts à Cannes ? On serait 6.", created_at: hoursAgo(0.6) },
  ],
  "+33612000006": [
    { id: "m8", from_me: false, is_from_human: false, body: "Il me faudrait l'hélico assez tôt le matin en fait, 8h max à Courchevel.", created_at: hoursAgo(4) },
    { id: "m9", from_me: true, is_from_human: true, body: "Bonjour Alexandre, je vérifie ça avec notre opérateur et je reviens vers vous d'ici midi.", created_at: hoursAgo(3) },
  ],
  "+33612000011": [
    { id: "m10", from_me: true, is_from_human: false, body: "Votre devis pour la croisière au coucher du soleil vient de partir par email. Le photographe est disponible à la date souhaitée.", created_at: hoursAgo(30) },
  ],
};

// Compteurs globaux de la vue d'ensemble (cohérents avec ~60 j d'activité).
export const demoStats = {
  msgIn: 418,
  msgOut: 391,
};

/** Leads par mois (année en cours) — montée en charge plausible. */
export function demoMonthlyLeads(currentMonth: number): number[] {
  const values = new Array(12).fill(0);
  for (let m = 0; m <= currentMonth; m++) {
    const fromCurrent = currentMonth - m;
    values[m] = fromCurrent >= 6 ? 0 : Math.max(3, 26 - fromCurrent * 4 + ((m * 7) % 5));
  }
  return values;
}

export type DemoUsageEvent = {
  occurred_at: string;
  source: "agent" | "followup";
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
};

/** ~240 appels IA déterministes répartis sur les 60 derniers jours. */
export function demoUsageEvents(): DemoUsageEvent[] {
  const events: DemoUsageEvent[] = [];
  const today = new Date();
  for (let back = 0; back < 60; back++) {
    const day = new Date(today.getTime() - back * 86_400_000);
    const dayN = day.getUTCDate();
    const calls = 2 + (dayN % 5);
    for (let n = 1; n <= calls; n++) {
      const occurred = new Date(day);
      occurred.setUTCHours(8 + ((n * 37) % 13), (n * 17) % 60, 0, 0);
      events.push({
        occurred_at: occurred.toISOString(),
        source: (n + dayN) % 9 === 0 ? "followup" : "agent",
        model: "claude-sonnet-4-6",
        input_tokens: 350 + ((n * 61 + dayN * 13) % 900),
        output_tokens: 120 + ((n * 43 + dayN * 7) % 380),
        cache_creation_input_tokens: n === 1 ? 2800 : 0,
        cache_read_input_tokens: n === 1 ? 0 : 2800,
      });
    }
  }
  return events;
}

export const demoBillingSettings = {
  id: true,
  margin_multiplier: 3.0,
  usd_eur_rate: 0.92,
  plan_type: "usage",
  included_amount_eur: null,
  overage_multiplier: null,
  updated_at: new Date().toISOString(),
};

export const demoAgentConfig = {
  id: "demo-config",
  identity: {
    agent_name: "Apolline",
    company: "L'art de vivre",
    role: "concierge personnelle",
    base_location: "Côte d'Azur",
    languages: ["fr", "en"],
  },
  services: {
    yacht: { name: "Location & charter de yachts", description: "À la journée ou en croisière, avec équipage.", from_price: "TO_BE_PROVIDED", zones: ["Côte d'Azur", "Monaco", "Corse"] },
    villa: { name: "Villas & propriétés d'exception", description: "Séjours courts et locations saisonnières, staff sur demande.", from_price: "TO_BE_PROVIDED", zones: ["Saint-Tropez", "Cannes", "Courchevel"] },
    evenement: { name: "Événements privés", description: "Anniversaires, mariages, soirées d'entreprise.", from_price: "TO_BE_PROVIDED" },
    transport: { name: "Transferts premium", description: "Jet privé, hélicoptère, voiture avec chauffeur.", from_price: "TO_BE_PROVIDED" },
    gastronomie: { name: "Chef à domicile & tables privées", description: "Chefs étoilés, réservations impossibles.", from_price: "TO_BE_PROVIDED" },
    bien_etre: { name: "Bien-être & expériences", description: "Spa privé, coach, expériences sur mesure.", from_price: "TO_BE_PROVIDED" },
  },
  faq: {
    delai_reponse: "L'équipe confirme disponibilités et devis sous quelques heures en journée (9h-20h).",
    acompte: "TO_BE_PROVIDED",
    annulation: "TO_BE_PROVIDED",
    zones_couvertes: "Côte d'Azur en priorité ; autres destinations étudiées sur demande.",
    confidentialite: "Discrétion absolue : aucune information client n'est partagée.",
  },
  business_hours: { equipe: "9h-20h, 7j/7", agent: "24h/24, 7j/7" },
  auto_followup_enabled: true,
  max_followups: 2,
  updated_at: new Date().toISOString(),
};
