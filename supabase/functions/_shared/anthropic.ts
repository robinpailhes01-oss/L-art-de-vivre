// Point d'interception UNIQUE des appels à l'API Anthropic : chaque appel
// (chaque tour de la boucle d'outils, retry compris) enregistre son champ
// `usage` dans ai_usage_events — fidèle à la facturation réelle du fournisseur.

import { type MeterCtx, recordUsage } from "./metering.ts";

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

export function hasApiKey(): boolean {
  return !!ANTHROPIC_API_KEY;
}

export async function callAnthropic(
  body: Record<string, unknown>,
  meter: MeterCtx,
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Anthropic ${res.status}: ${detail}`);
  }
  const data = await res.json();
  await recordUsage(
    meter,
    String(body.model ?? MODEL),
    data.usage,
    res.headers.get("request-id"),
  );
  return data;
}
