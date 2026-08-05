import { NextRequest, NextResponse } from "next/server";

import { computeBillableEur, currentMonth, getMonthUsage } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";

// Export CSV du mois : une ligne par jour × source × modèle + ligne TOTAL.
// Colonnes en français, séparateur ';' (Excel FR), montants avec marge —
// c'est le fichier joint à la facture du client.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month") ?? currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month attendu au format YYYY-MM" }, { status: 400 });
  }

  const usage = await getMonthUsage(supabase, month);
  const s = usage.settings;

  const n2 = (v: number) => v.toFixed(2).replace(".", ",");
  const n4 = (v: number) => v.toFixed(4).replace(".", ",");

  const lines: string[] = [
    "date;source;modele;appels;tokens_entree;tokens_sortie;tokens_cache_ecriture;tokens_cache_lecture;cout_usd;cout_eur;montant_facturable_eur",
  ];
  for (const row of usage.byDaySource) {
    lines.push(
      [
        row.day,
        row.source === "agent" ? "agent" : "relance",
        row.model,
        row.calls,
        row.inputTokens,
        row.outputTokens,
        row.cacheWriteTokens,
        row.cacheReadTokens,
        n4(row.costUsd),
        n4(row.costUsd * s.usd_eur_rate),
        n2(computeBillableEur(row.costUsd, s)),
      ].join(";"),
    );
  }
  lines.push(
    [
      "TOTAL",
      "",
      "",
      usage.totals.calls,
      usage.totals.inputTokens,
      usage.totals.outputTokens,
      usage.totals.cacheWriteTokens,
      usage.totals.cacheReadTokens,
      n4(usage.totals.costUsd),
      n4(usage.costEur),
      n2(usage.billableEur),
    ].join(";"),
  );
  lines.push("");
  lines.push(`marge;x${String(s.margin_multiplier).replace(".", ",")};taux_usd_eur;${String(s.usd_eur_rate).replace(".", ",")}`);

  // BOM UTF-8 pour qu'Excel ouvre les accents correctement.
  const csv = "﻿" + lines.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="facturation-lartdevivre-${month}.csv"`,
    },
  });
}
