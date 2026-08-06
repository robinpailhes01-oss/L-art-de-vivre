"use server";

import { revalidatePath } from "next/cache";

import { isDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

// Le cerveau relit agent_config à chaque appel : toute modification ici est
// effective au prochain message client, sans redéploiement.

async function getConfigRow() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("agent_config").select("*").limit(1).single();
  if (error || !data) throw new Error(`agent_config introuvable: ${error?.message}`);
  return { supabase, config: data };
}

async function patchConfig(patch: Record<string, Json | boolean | number>) {
  if (isDemo()) return; // mode démo — rien à persister
  const { supabase, config } = await getConfigRow();
  const { error } = await supabase
    .from("agent_config")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", config.id);
  if (error) console.error("[reglages] update:", error.message);
  revalidatePath("/reglages");
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const csv = (fd: FormData, key: string) =>
  str(fd, key).split(",").map((s) => s.trim()).filter(Boolean);

export async function updateIdentity(formData: FormData): Promise<void> {
  if (isDemo()) return;
  const { config } = await getConfigRow();
  const identity = { ...(config.identity as Record<string, Json>) };
  identity.agent_name = str(formData, "agent_name") || "Apolline";
  identity.company = str(formData, "company") || "L'art de vivre";
  identity.base_location = str(formData, "base_location");
  identity.languages = csv(formData, "languages");
  await patchConfig({ identity });
}

export async function updateService(serviceKey: string, formData: FormData): Promise<void> {
  if (isDemo()) return;
  const { config } = await getConfigRow();
  const services = { ...(config.services as Record<string, Json>) };
  const current = (services[serviceKey] ?? {}) as Record<string, Json>;
  services[serviceKey] = {
    ...current,
    name: str(formData, "name"),
    description: str(formData, "description"),
    from_price: str(formData, "from_price"),
    ...(formData.has("zones") ? { zones: csv(formData, "zones") } : {}),
  };
  await patchConfig({ services });
}

export async function updateFaq(formData: FormData): Promise<void> {
  if (isDemo()) return;
  const { config } = await getConfigRow();
  const faq = { ...(config.faq as Record<string, Json>) };
  for (const key of ["delai_reponse", "acompte", "annulation", "zones_couvertes", "confidentialite"]) {
    faq[key] = str(formData, key);
  }
  await patchConfig({ faq });
}

export async function updateHours(formData: FormData): Promise<void> {
  if (isDemo()) return;
  const { config } = await getConfigRow();
  const business_hours = { ...(config.business_hours as Record<string, Json>) };
  business_hours.equipe = str(formData, "equipe");
  business_hours.agent = str(formData, "agent");
  await patchConfig({ business_hours });
}

export async function updateFollowups(formData: FormData): Promise<void> {
  const max = Number(formData.get("max_followups"));
  await patchConfig({
    auto_followup_enabled: formData.get("auto_followup_enabled") === "on",
    max_followups: Number.isFinite(max) && max >= 0 && max <= 5 ? max : 2,
  });
}
