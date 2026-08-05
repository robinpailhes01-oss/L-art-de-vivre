import Link from "next/link";
import { Sparkles } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { leadStatusBadge } from "@/lib/status";
import {
  BUDGET_LABEL,
  LEAD_STATUSES,
  SERVICE_LABEL,
  SERVICE_TYPES,
  STATUS_LABEL,
  desiredPeriod,
  displayName,
  relativeDays,
  scoreClasses,
} from "@/lib/leads";

export const dynamic = "force-dynamic";

type Search = { status?: string; service?: string; filter?: string };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { status, service, filter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select("*")
    .eq("archived", false)
    .order("last_interaction_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (status && (LEAD_STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status as (typeof LEAD_STATUSES)[number]);
  }
  if (service && (SERVICE_TYPES as readonly string[]).includes(service)) {
    query = query.eq("service_type", service);
  }
  if (filter === "escalated") {
    query = query.eq("needs_human_intervention", true);
  }

  const { data: leads } = await query;
  const now = Date.now();

  const filterHref = (patch: Partial<Search>) => {
    const params = new URLSearchParams();
    const merged = { status, service, filter, ...patch };
    if (merged.status) params.set("status", merged.status);
    if (merged.service) params.set("service", merged.service);
    if (merged.filter) params.set("filter", merged.filter);
    const qs = params.toString();
    return qs ? `/leads?${qs}` : "/leads";
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chaque demande qualifiée par Apolline, avec son brief de mission.
        </p>
      </div>

      {/* Filtres statut */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip href={filterHref({ status: undefined, filter: undefined })} active={!status && filter !== "escalated"}>
          Tous
        </FilterChip>
        <FilterChip href={filterHref({ status: undefined, filter: "escalated" })} active={filter === "escalated"}>
          À reprendre
        </FilterChip>
        {LEAD_STATUSES.map((s) => (
          <FilterChip key={s} href={filterHref({ status: s, filter: undefined })} active={status === s}>
            {STATUS_LABEL[s]}
          </FilterChip>
        ))}
      </div>

      {/* Filtres prestation */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip href={filterHref({ service: undefined })} active={!service} subtle>
          Toutes prestations
        </FilterChip>
        {SERVICE_TYPES.filter((s) => s !== "autre").map((s) => (
          <FilterChip key={s} href={filterHref({ service: s })} active={service === s} subtle>
            {SERVICE_LABEL[s]}
          </FilterChip>
        ))}
      </div>

      <div className="enter-up overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Prestation</TableHead>
              <TableHead>Période</TableHead>
              <TableHead className="text-right">Pers.</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Dernier contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(leads ?? []).map((lead) => {
              const badge = leadStatusBadge(lead.status);
              return (
                <TableRow key={lead.id} className="relative cursor-pointer hover:bg-muted/40">
                  <TableCell className="font-medium">
                    <Link href={`/leads/${lead.id}`} className="after:absolute after:inset-0">
                      <span className="flex items-center gap-2">
                        {lead.needs_human_intervention && (
                          <span className="size-2 shrink-0 rounded-full bg-destructive" title="Escaladé" />
                        )}
                        {displayName(lead)}
                        {lead.ai_memo && (
                          <Sparkles className="size-3.5 text-champagne" aria-label="Brief de mission prêt" />
                        )}
                      </span>
                      <span className="block font-mono text-xs font-normal text-muted-foreground">
                        {lead.phone ?? "—"}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {lead.service_type ? SERVICE_LABEL[lead.service_type] ?? lead.service_type : "—"}
                    {lead.location ? (
                      <span className="block text-xs text-muted-foreground">{lead.location}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{desiredPeriod(lead) ?? "—"}</TableCell>
                  <TableCell className="text-right">{lead.party_size ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {lead.budget_range ? BUDGET_LABEL[lead.budget_range] ?? lead.budget_range : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {lead.score != null ? (
                      <span
                        className={cn(
                          "inline-flex min-w-8 justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold",
                          scoreClasses(lead.score),
                        )}
                      >
                        {lead.score}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {relativeDays(lead.last_interaction_at ?? lead.created_at, now)}
                  </TableCell>
                </TableRow>
              );
            })}
            {(leads ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Aucun lead sur ces critères.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  subtle,
  children,
}: {
  href: string;
  active: boolean;
  subtle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : subtle
            ? "border-border bg-card text-muted-foreground hover:bg-muted"
            : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}
