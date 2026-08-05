import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive, BadgeCheck, Send, Undo2, XCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { leadStatusBadge } from "@/lib/status";
import {
  BUDGET_LABEL,
  SERVICE_LABEL,
  desiredPeriod,
  displayName,
  relativeDays,
  scoreClasses,
} from "@/lib/leads";
import {
  archiveLeadForm,
  relaunchLeadForm,
  resolveEscalationForm,
  setLeadStatusForm,
} from "../actions";

export const dynamic = "force-dynamic";

type ChatMsg = { from: "client" | "ai" | "human"; text: string; at: string };

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: lead }, { data: conv }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("conversations")
      .select("messages")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!lead) notFound();

  const badge = leadStatusBadge(lead.status);
  const messages = (Array.isArray(conv?.messages) ? conv.messages : []) as ChatMsg[];
  const now = Date.now();

  const facts: Array<[string, string | null]> = [
    ["Prestation", lead.service_type ? SERVICE_LABEL[lead.service_type] ?? lead.service_type : null],
    ["Détail", lead.service_detail],
    ["Occasion", lead.occasion],
    ["Période", desiredPeriod(lead)],
    ["Créneau", lead.desired_time_slot],
    ["Personnes", lead.party_size != null ? String(lead.party_size) : null],
    ["Lieu", lead.location],
    ["Budget", lead.budget_range ? BUDGET_LABEL[lead.budget_range] ?? lead.budget_range : null],
    ["Relances envoyées", String(lead.followup_count ?? 0)],
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Retour aux leads
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">{displayName(lead)}</h1>
          <p className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono">{lead.phone ?? "—"}</span>
            <span>·</span>
            <span>dernier contact {relativeDays(lead.last_interaction_at ?? lead.created_at, now)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lead.score != null && (
            <span
              className={cn(
                "inline-flex min-w-9 justify-center rounded-md px-2 py-1 text-sm font-semibold",
                scoreClasses(lead.score),
              )}
            >
              {lead.score}/10
            </span>
          )}
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </div>

      {lead.needs_human_intervention && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span className="font-medium">Apolline a passé la main — l&apos;équipe doit reprendre ce client.</span>
          <form action={resolveEscalationForm.bind(null, lead.id)}>
            <Button type="submit" size="sm" variant="outline">
              <Undo2 /> Traité, rendre la main à Apolline
            </Button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          {/* Brief de mission — mis en avant */}
          <Card className="border-champagne/40 bg-champagne/5">
            <CardHeader>
              <CardTitle className="font-display text-lg font-semibold text-champagne-foreground dark:text-champagne">
                Brief de mission
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lead.ai_memo ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{lead.ai_memo}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pas encore de brief — Apolline le rédige dès que la demande est claire.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg font-semibold">Qualification</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                {facts.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium text-foreground">{value ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <form action={relaunchLeadForm.bind(null, lead.id)}>
              <Button type="submit" variant="default" size="sm">
                <Send /> Relancer maintenant
              </Button>
            </form>
            <form action={setLeadStatusForm.bind(null, lead.id, "booked")}>
              <Button type="submit" variant="outline" size="sm">
                <BadgeCheck /> Confirmé
              </Button>
            </form>
            <form action={setLeadStatusForm.bind(null, lead.id, "lost")}>
              <Button type="submit" variant="outline" size="sm">
                <XCircle /> Perdu
              </Button>
            </form>
            <form action={archiveLeadForm.bind(null, lead.id)}>
              <Button type="submit" variant="ghost" size="sm">
                <Archive /> Archiver
              </Button>
            </form>
          </div>
        </div>

        {/* Fil de conversation */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="font-display text-lg font-semibold">Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun échange enregistré.</p>
            ) : (
              <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.from === "client" ? "justify-start" : "justify-end")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        m.from === "client"
                          ? "bg-muted text-foreground"
                          : m.from === "human"
                            ? "bg-info/90 text-white"
                            : "bg-primary text-primary-foreground",
                      )}
                    >
                      <p className="whitespace-pre-line">{m.text}</p>
                      <p className="mt-0.5 text-right text-[10px] opacity-60">
                        {m.from === "ai" ? "Apolline" : m.from === "human" ? "Équipe" : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
