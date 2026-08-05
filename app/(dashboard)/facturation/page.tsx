import Link from "next/link";
import { Bot, Coins, Download, MessagesSquare, Receipt } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { computeBillableEur, currentMonth, getMonthUsage } from "@/lib/billing";
import { updateBillingSettings } from "./actions";

export const dynamic = "force-dynamic";

const eur2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function FacturationPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: rawMonth } = await searchParams;
  const month = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : currentMonth();

  const supabase = await createClient();
  const usage = await getMonthUsage(supabase, month);
  const s = usage.settings;

  const maxDayCost = Math.max(...usage.byDay.map((d) => d.costUsd), 1e-9);
  const daysInMonth = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  const dayMap = new Map(usage.byDay.map((d) => [d.day, d]));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Facturation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consommation IA réelle, valorisée avec la marge convenue — prête à facturer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/facturation?month=${shiftMonth(month, -1)}`}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            ←
          </Link>
          <span className="min-w-36 text-center font-display text-lg font-semibold capitalize">
            {monthLabel(month)}
          </span>
          <Link
            href={`/facturation?month=${shiftMonth(month, 1)}`}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            →
          </Link>
        </div>
      </div>

      {/* Montant facturable — la carte signature */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="enter-up lg:col-span-1 border-champagne/40 bg-gradient-to-b from-card to-champagne-100/60 dark:to-champagne-100">
          <CardContent className="flex flex-col gap-1.5 py-6">
            <span className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
              <Receipt className="size-4 text-champagne" /> À facturer ce mois
            </span>
            <span className="kpi-figure text-5xl text-foreground">{eur2.format(usage.billableEur)}</span>
            <span className="hairline-champagne w-24 pt-1" />
            <span className="pt-1 text-xs text-muted-foreground">
              Coût brut {eur2.format(usage.costEur)} × marge ×{String(s.margin_multiplier)}
            </span>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-2">
          <MiniStat
            icon={<Bot className="size-4" />}
            label="Appels IA"
            value={formatNumber(usage.totals.calls)}
            hint={`${formatNumber(usage.bySource.find((x) => x.source === "agent")?.calls ?? 0)} agent · ${formatNumber(usage.bySource.find((x) => x.source === "followup")?.calls ?? 0)} relances`}
          />
          <MiniStat
            icon={<MessagesSquare className="size-4" />}
            label="Tokens"
            value={formatNumber(usage.totals.inputTokens + usage.totals.outputTokens)}
            hint={`${formatNumber(usage.totals.inputTokens)} entrée · ${formatNumber(usage.totals.outputTokens)} sortie`}
          />
          <MiniStat
            icon={<Coins className="size-4" />}
            label="Coût brut"
            value={`${usage.totals.costUsd.toFixed(2)} $`}
            hint={`dont cache : ${formatNumber(usage.totals.cacheReadTokens)} tokens lus`}
          />
        </div>
      </div>

      {/* Coût par jour */}
      <Card className="enter-up">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-lg font-semibold">Coût par jour (USD)</CardTitle>
          <Button variant="outline" size="sm" render={<a href={`/api/billing/export?month=${month}`} />}>
            <Download /> Exporter CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex h-36 items-end gap-[3px]">
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = `${month}-${String(i + 1).padStart(2, "0")}`;
              const d = dayMap.get(day);
              const pct = d ? Math.max((d.costUsd / maxDayCost) * 100, 4) : 0;
              return (
                <div
                  key={day}
                  className="flex-1"
                  title={d ? `${day} — ${d.calls} appels, ${d.costUsd.toFixed(3)} $` : day}
                >
                  <div
                    className={cn(
                      "animate-grow w-full rounded-sm",
                      d ? "bg-gradient-to-t from-primary/20 to-primary/60" : "bg-border/60",
                    )}
                    style={{ height: d ? `${pct}%` : "2px", animationDelay: `${i * 18}ms` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>1</span>
            <span>{daysInMonth}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Détail par source */}
        <Card className="enter-up">
          <CardHeader>
            <CardTitle className="font-display text-lg font-semibold">Détail par source</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Appels</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Coût</TableHead>
                  <TableHead className="text-right">Facturable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.bySource.map((row) => (
                  <TableRow key={row.source}>
                    <TableCell className="font-medium">
                      {row.source === "agent" ? "Conversations Apolline" : "Relances automatiques"}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(row.calls)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatNumber(row.inputTokens + row.outputTokens)}
                    </TableCell>
                    <TableCell className="text-right">{eur2.format(row.costUsd * s.usd_eur_rate)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {eur2.format(computeBillableEur(row.costUsd, s))}
                    </TableCell>
                  </TableRow>
                ))}
                {usage.bySource.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      Aucun appel IA sur ce mois.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Réglages de facturation */}
        <Card className="enter-up">
          <CardHeader>
            <CardTitle className="font-display text-lg font-semibold">Réglages de facturation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={updateBillingSettings} className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="margin_multiplier">Marge (×)</Label>
                <Input
                  id="margin_multiplier"
                  name="margin_multiplier"
                  defaultValue={String(s.margin_multiplier)}
                  className="h-9 w-24"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="usd_eur_rate">Taux USD → EUR</Label>
                <Input
                  id="usd_eur_rate"
                  name="usd_eur_rate"
                  defaultValue={String(s.usd_eur_rate)}
                  className="h-9 w-24"
                  inputMode="decimal"
                />
              </div>
              <Button type="submit" size="sm" className="h-9">
                Enregistrer
              </Button>
            </form>
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              Mode actuel : <span className="font-medium text-foreground">usage × marge</span>.
              Le mode <span className="font-medium">forfait + usage inclus</span> est prévu
              (champs déjà en base) — à activer lors d&apos;un futur accord commercial.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="enter-up">
      <CardContent className="flex flex-col gap-1.5 py-5">
        <span className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
          <span className="text-champagne">{icon}</span> {label}
        </span>
        <span className="kpi-figure text-[1.7rem] leading-none text-foreground">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
}
