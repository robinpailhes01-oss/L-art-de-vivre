"use server";

import { revalidatePath } from "next/cache";

import { baileysFetch } from "@/lib/baileys";
import { isDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import type { LeadStatus } from "@/types/database";

/** Relance manuelle : appelle agent-followups en mode lead_id (bypass intervalle). */
export async function relaunchLead(leadId: string): Promise<{ ok: boolean; error?: string }> {
  if (isDemo()) return { ok: false, error: "Mode démo — action désactivée" };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!url || !cronSecret) return { ok: false, error: "CRON_SECRET non configuré côté Vercel" };

  try {
    const res = await fetch(`${url}/functions/v1/agent-followups`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cron-secret": cronSecret },
      body: JSON.stringify({ lead_id: leadId }),
      cache: "no-store",
    });
    const data = await res.json();
    revalidatePath(`/leads/${leadId}`);
    if (!res.ok) return { ok: false, error: data?.error ?? `HTTP ${res.status}` };
    const sent = (data?.sent ?? 0) > 0;
    return sent ? { ok: true } : { ok: false, error: data?.results?.[0]?.reason ?? "relance non envoyée" };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function setLeadStatus(leadId: string, status: LeadStatus): Promise<{ ok: boolean; error?: string }> {
  if (isDemo()) return { ok: false, error: "Mode démo — action désactivée" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function archiveLead(leadId: string): Promise<{ ok: boolean; error?: string }> {
  if (isDemo()) return { ok: false, error: "Mode démo — action désactivée" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  revalidatePath("/leads");
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * L'équipe a traité l'escalade : on rend la main à Apolline
 * (needs_human_intervention = false + reprise de la conversation WhatsApp).
 */
export async function resolveEscalation(leadId: string): Promise<{ ok: boolean; error?: string }> {
  if (isDemo()) return { ok: false, error: "Mode démo — action désactivée" };
  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .update({ needs_human_intervention: false, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .select("phone")
    .single();
  if (error) return { ok: false, error: error.message };

  if (lead?.phone) {
    try {
      await baileysFetch(`/resume/${encodeURIComponent(lead.phone)}`, { method: "POST", body: "{}" });
    } catch {
      // Service Baileys injoignable : la pause expirera d'elle-même (24 h).
    }
  }
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

// ── Variantes « form action » (les <form action> exigent un retour void) ──

export async function relaunchLeadForm(leadId: string): Promise<void> {
  const res = await relaunchLead(leadId);
  if (!res.ok) console.error("[leads] relance:", res.error);
}

export async function setLeadStatusForm(leadId: string, status: LeadStatus): Promise<void> {
  await setLeadStatus(leadId, status);
}

export async function archiveLeadForm(leadId: string): Promise<void> {
  await archiveLead(leadId);
}

export async function resolveEscalationForm(leadId: string): Promise<void> {
  await resolveEscalation(leadId);
}
