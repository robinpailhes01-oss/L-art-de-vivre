/** Shape commun d'un lead utilisé par la table, le drawer et la vue d'ensemble. */
export type Lead = {
  id: string;
  first_name: string | null;
  phone: string | null;
  source_channel: string | null;
  status: string | null;
  score: number | null;
  service_type: string | null;
  service_detail: string | null;
  occasion: string | null;
  party_size: number | null;
  desired_date: string | null;
  desired_date_end: string | null;
  desired_time_slot: string | null;
  budget_range: string | null;
  location: string | null;
  ai_memo: string | null;
  needs_human_intervention: boolean | null;
  followup_count: number | null;
  last_followup_at: string | null;
  last_interaction_at: string | null;
  archived: boolean | null;
  created_at: string | null;
};

/** Colonnes de référence (= enum lead_status), dans l'ordre du pipeline. */
export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "quote_sent",
  "followed_up",
  "booked",
  "lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABEL: Record<string, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  qualified: "Qualifié",
  quote_sent: "Devis envoyé",
  followed_up: "Relancé",
  booked: "Confirmé",
  lost: "Perdu",
};

/** Catalogue des types de prestation (= contrainte CHECK leads.service_type). */
export const SERVICE_TYPES = [
  "yacht",
  "villa",
  "evenement",
  "transport",
  "gastronomie",
  "bien_etre",
  "autre",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_LABEL: Record<string, string> = {
  yacht: "Yacht",
  villa: "Villa",
  evenement: "Événement privé",
  transport: "Transfert premium",
  gastronomie: "Gastronomie",
  bien_etre: "Bien-être",
  autre: "Autre",
};

export const BUDGET_LABEL: Record<string, string> = {
  moins_5k: "< 5 000 €",
  "5k_15k": "5 – 15 k€",
  "15k_50k": "15 – 50 k€",
  plus_50k: "> 50 k€",
  non_communique: "Non communiqué",
};

/** Statuts « actifs » où une relance > 48h devient pertinente. */
const ACTIVE_STATUSES = new Set<string>([
  "contacted",
  "qualified",
  "quote_sent",
  "followed_up",
]);

const FOLLOW_UP_THRESHOLD_MS = 48 * 60 * 60 * 1000;

/** Vrai si le lead est sur un statut actif et sans interaction depuis > 48h. */
export function needsFollowUp(lead: Lead, now: number): boolean {
  if (!lead.status || !ACTIVE_STATUSES.has(lead.status)) return false;
  const ref = lead.last_interaction_at ?? lead.created_at;
  if (!ref) return false;
  return now - new Date(ref).getTime() > FOLLOW_UP_THRESHOLD_MS;
}

/** Classe de couleur du badge de score (≥7 vert · 5-6 champagne · 3-4 orange · <3 rouge). */
export function scoreClasses(score: number | null): string {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 7) return "bg-success/12 text-success";
  if (score >= 5) return "bg-champagne/15 text-champagne";
  if (score >= 3) return "bg-warning/15 text-warning";
  return "bg-destructive/12 text-destructive";
}

export function displayName(lead: Pick<Lead, "first_name" | "phone">): string {
  return lead.first_name?.trim() || lead.phone || "Lead";
}

export function initials(lead: Pick<Lead, "first_name" | "phone">): string {
  const name = lead.first_name?.trim();
  if (name) {
    const parts = name.split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return "?";
}

/** Libellé relatif court : « aujourd'hui », « hier », « il y a 3 j ». */
export function relativeDays(date: string | null, now: number): string {
  if (!date) return "—";
  const diff = now - new Date(date).getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `il y a ${weeks} sem`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

/** Période souhaitée formatée : « 12 juil. » ou « 12 → 19 juil. ». */
export function desiredPeriod(lead: Pick<Lead, "desired_date" | "desired_date_end">): string | null {
  if (!lead.desired_date) return null;
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
  const start = fmt.format(new Date(lead.desired_date));
  if (lead.desired_date_end && lead.desired_date_end !== lead.desired_date) {
    return `${start} → ${fmt.format(new Date(lead.desired_date_end))}`;
  }
  return start;
}
