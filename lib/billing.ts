// Calculs de facturation à l'usage — source unique partagée par la page
// /facturation et l'export CSV, pour que les totaux soient identiques.
//
// Chaque appel Anthropic = 1 ligne ai_usage_events (tokens bruts). Le coût
// est valorisé à la lecture via model_pricing (prix en vigueur à la date de
// l'appel), puis converti en € et multiplié par la marge de billing_settings.
//
// Bascule forfait future : seul computeBillableEur change (plan_type,
// included_amount_eur, overage_multiplier sont déjà en base).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type BillingSettings = Tables<"billing_settings">;

export type UsageAgg = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costUsd: number;
};

export type MonthUsage = {
  month: string; // "YYYY-MM"
  totals: UsageAgg;
  byDay: Array<{ day: string } & UsageAgg>;
  bySource: Array<{ source: string } & UsageAgg>;
  byDaySource: Array<{ day: string; source: string; model: string } & UsageAgg>;
  settings: BillingSettings;
  costEur: number;
  billableEur: number;
};

const emptyAgg = (): UsageAgg => ({
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
  costUsd: 0,
});

export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y, m, 1)).toISOString();
  return { start, end };
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function computeBillableEur(costUsd: number, s: BillingSettings): number {
  const costEur = costUsd * s.usd_eur_rate;
  // plan_type 'forfait' non câblé pour l'instant (champs prêts en base).
  return costEur * s.margin_multiplier;
}

export async function getBillingSettings(supabase: Supabase): Promise<BillingSettings> {
  const { data } = await supabase.from("billing_settings").select("*").limit(1).single();
  if (!data) throw new Error("billing_settings introuvable");
  return data;
}

export async function getMonthUsage(supabase: Supabase, month: string): Promise<MonthUsage> {
  const { start, end } = monthBounds(month);

  const [settings, eventsRes, pricingRes] = await Promise.all([
    getBillingSettings(supabase),
    supabase
      .from("ai_usage_events")
      .select("occurred_at, source, model, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens")
      .gte("occurred_at", start)
      .lt("occurred_at", end)
      .order("occurred_at", { ascending: true })
      .limit(20000),
    supabase.from("model_pricing").select("*"),
  ]);

  const pricing = pricingRes.data ?? [];
  // Prix en vigueur pour (model, date) : ligne la plus récente ≤ date d'appel.
  const priceFor = (model: string, day: string) => {
    const rows = pricing
      .filter((p) => p.model === model && p.effective_from <= day)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
    return rows[0] ?? null;
  };

  const totals = emptyAgg();
  const byDay = new Map<string, UsageAgg>();
  const bySource = new Map<string, UsageAgg>();
  const byDaySource = new Map<string, { day: string; source: string; model: string } & UsageAgg>();

  for (const e of eventsRes.data ?? []) {
    const day = e.occurred_at.slice(0, 10);
    const p = priceFor(e.model, day);
    const costUsd = p
      ? (e.input_tokens * p.input_usd_per_mtok +
          e.output_tokens * p.output_usd_per_mtok +
          e.cache_creation_input_tokens * p.cache_write_usd_per_mtok +
          e.cache_read_input_tokens * p.cache_read_usd_per_mtok) /
        1e6
      : 0;

    const buckets: UsageAgg[] = [totals];
    if (!byDay.has(day)) byDay.set(day, emptyAgg());
    buckets.push(byDay.get(day)!);
    if (!bySource.has(e.source)) bySource.set(e.source, emptyAgg());
    buckets.push(bySource.get(e.source)!);
    const dsKey = `${day}|${e.source}|${e.model}`;
    if (!byDaySource.has(dsKey)) {
      byDaySource.set(dsKey, { day, source: e.source, model: e.model, ...emptyAgg() });
    }
    buckets.push(byDaySource.get(dsKey)!);

    for (const b of buckets) {
      b.calls += 1;
      b.inputTokens += e.input_tokens;
      b.outputTokens += e.output_tokens;
      b.cacheWriteTokens += e.cache_creation_input_tokens;
      b.cacheReadTokens += e.cache_read_input_tokens;
      b.costUsd += costUsd;
    }
  }

  return {
    month,
    totals,
    byDay: [...byDay.entries()].map(([day, agg]) => ({ day, ...agg })).sort((a, b) => a.day.localeCompare(b.day)),
    bySource: [...bySource.entries()].map(([source, agg]) => ({ source, ...agg })),
    byDaySource: [...byDaySource.values()].sort((a, b) => a.day.localeCompare(b.day)),
    settings,
    costEur: totals.costUsd * settings.usd_eur_rate,
    billableEur: computeBillableEur(totals.costUsd, settings),
  };
}
