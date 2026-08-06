"use server";

import { revalidatePath } from "next/cache";

import { isDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

/** Met à jour la marge et le taux USD→EUR (singleton billing_settings). */
export async function updateBillingSettings(formData: FormData): Promise<void> {
  if (isDemo()) return; // mode démo — rien à persister
  const margin = Number(String(formData.get("margin_multiplier") ?? "").replace(",", "."));
  const rate = Number(String(formData.get("usd_eur_rate") ?? "").replace(",", "."));
  if (!Number.isFinite(margin) || margin <= 0 || !Number.isFinite(rate) || rate <= 0) {
    console.error("[facturation] valeurs invalides", { margin, rate });
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("billing_settings")
    .update({
      margin_multiplier: margin,
      usd_eur_rate: rate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) console.error("[facturation] update settings:", error.message);
  revalidatePath("/facturation");
}
