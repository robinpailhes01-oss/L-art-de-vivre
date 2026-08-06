import Link from "next/link";
import { AlertTriangle, Bot, MessageCircle, Users, Flame } from "lucide-react";

import { demoLeads, demoMonthlyLeads, demoStats, isDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MonthlyBars } from "@/components/dashboard/monthly-bars";
import { RecentLeads, type RecentLead } from "@/components/dashboard/recent-leads";
import { Reveal } from "@/components/dashboard/reveal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SERVICE_LABEL, displayName, type Lead } from "@/lib/leads";

export const dynamic = "force-dynamic";

type OverviewData = {
  leadsTotal: number;
  leads30: number;
  msgIn: number;
  msgOut: number;
  activeConv: number;
  escalatedCount: number;
  monthly: number[];
  recent: Array<Pick<Lead, "id" | "first_name" | "phone" | "service_type" | "score" | "status" | "created_at">>;
};

async function loadData(currentMonth: number): Promise<OverviewData> {
  if (isDemo()) {
    const ago30 = Date.now() - 30 * 24 * 3600 * 1000;
    return {
      leadsTotal: demoLeads.length + 34, // historique fictif au-delà des fiches listées
      leads30: demoLeads.filter((l) => l.created_at && new Date(l.created_at).getTime() >= ago30).length + 14,
      msgIn: demoStats.msgIn,
      msgOut: demoStats.msgOut,
      activeConv: 4,
      escalatedCount: demoLeads.filter((l) => l.needs_human_intervention).length,
      monthly: demoMonthlyLeads(currentMonth),
      recent: [...demoLeads]
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 6),
    };
  }

  const supabase = await createClient();
  const now = new Date();
  const ago30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  const [
    leadsTotalRes,
    leads30Res,
    msgInRes,
    msgOutRes,
    activeConvRes,
    escalatedRes,
    monthlyLeadsRes,
    recentLeadsRes,
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("archived", false),
    supabase.from("leads").select("*", { count: "exact", head: true }).gte("created_at", ago30),
    supabase.from("wa_messages").select("*", { count: "exact", head: true }).eq("from_me", false),
    supabase.from("wa_messages").select("*", { count: "exact", head: true }).eq("from_me", true),
    supabase
      .from("wa_conversations")
      .select("*", { count: "exact", head: true })
      .gte("last_message_at", ago30),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("needs_human_intervention", true)
      .eq("archived", false),
    supabase.from("leads").select("created_at").gte("created_at", yearStart),
    supabase
      .from("leads")
      .select("id, first_name, phone, service_type, score, status, created_at")
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const monthly = new Array(12).fill(0);
  for (const row of monthlyLeadsRes.data ?? []) {
    if (row.created_at) monthly[new Date(row.created_at).getMonth()] += 1;
  }

  return {
    leadsTotal: leadsTotalRes.count ?? 0,
    leads30: leads30Res.count ?? 0,
    msgIn: msgInRes.count ?? 0,
    msgOut: msgOutRes.count ?? 0,
    activeConv: activeConvRes.count ?? 0,
    escalatedCount: escalatedRes.count ?? 0,
    monthly,
    recent: recentLeadsRes.data ?? [],
  };
}

export default async function OverviewPage() {
  const now = new Date();
  const data = await loadData(now.getMonth());

  const recentLeads: RecentLead[] = data.recent.map((l) => ({
    id: l.id,
    name: displayName(l),
    sourceChannel: null,
    interestedOffer: l.service_type ? SERVICE_LABEL[l.service_type] ?? l.service_type : null,
    score: l.score,
    status: l.status,
    createdAt: l.created_at,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Vue d&apos;ensemble</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ce qu&apos;Apolline traite pour L&apos;art de vivre, en direct.
        </p>
      </div>

      {data.escalatedCount > 0 && (
        <Link
          href="/leads?filter=escalated"
          className="enter-up flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <AlertTriangle className="size-4 shrink-0" />
          {data.escalatedCount === 1
            ? "1 demande escaladée attend l'équipe"
            : `${data.escalatedCount} demandes escaladées attendent l'équipe`}
          <span className="ml-auto text-xs font-normal opacity-70">Voir les leads →</span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Leads"
          value={data.leadsTotal}
          icon={Users}
          accent="primary"
          delta={{ value: `+${data.leads30}`, positive: true }}
          hint="sur 30 jours"
          index={0}
        />
        <KpiCard
          label="Messages traités"
          value={data.msgIn + data.msgOut}
          icon={MessageCircle}
          accent="champagne"
          hint={`${data.msgIn} reçus · ${data.msgOut} envoyés`}
          index={1}
        />
        <KpiCard
          label="Conversations actives"
          value={data.activeConv}
          icon={Bot}
          accent="success"
          hint="30 derniers jours"
          index={2}
        />
        <KpiCard
          label="À reprendre"
          value={data.escalatedCount}
          icon={Flame}
          accent="info"
          hint="escaladées à l'équipe"
          index={3}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Reveal className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg font-semibold">
                Nouveaux leads par mois
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MonthlyBars values={data.monthly} currentMonth={now.getMonth()} />
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={120} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg font-semibold">Derniers leads</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentLeads leads={recentLeads} />
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
