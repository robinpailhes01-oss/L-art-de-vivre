export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

type Config = { label: string; variant: BadgeVariant };

const LEAD_STATUS: Record<string, Config> = {
  new: { label: "Nouveau", variant: "default" },
  contacted: { label: "Contacté", variant: "secondary" },
  qualified: { label: "Qualifié", variant: "secondary" },
  quote_sent: { label: "Devis envoyé", variant: "secondary" },
  followed_up: { label: "Relancé", variant: "secondary" },
  booked: { label: "Confirmé", variant: "outline" },
  lost: { label: "Perdu", variant: "destructive" },
};

function fallback(value: string | null): Config {
  return { label: value ?? "—", variant: "outline" };
}

export function leadStatusBadge(status: string | null): Config {
  return LEAD_STATUS[status ?? ""] ?? fallback(status);
}
