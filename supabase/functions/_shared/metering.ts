// Metering des appels Anthropic — 1 ligne par appel dans ai_usage_events.
// C'est la matière première de la facturation à l'usage : la page
// /facturation valorise ces tokens via model_pricing × marge.

// deno-lint-ignore no-explicit-any
type SupabaseLike = { from: (table: string) => any };

export type MeterCtx = {
  supabase: SupabaseLike;
  source: "agent" | "followup";
  leadId?: string | null;
  phone?: string | null;
  turn?: number;
};

export type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

// Best-effort : un échec de metering ne doit JAMAIS casser la réponse client.
export async function recordUsage(
  meter: MeterCtx,
  model: string,
  usage: AnthropicUsage | undefined,
  requestId: string | null,
): Promise<void> {
  try {
    const { error } = await meter.supabase.from("ai_usage_events").insert({
      source: meter.source,
      model,
      lead_id: meter.leadId ?? null,
      customer_phone: meter.phone ?? null,
      input_tokens: usage?.input_tokens ?? 0,
      output_tokens: usage?.output_tokens ?? 0,
      cache_creation_input_tokens: usage?.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: usage?.cache_read_input_tokens ?? 0,
      tool_turn: meter.turn ?? null,
      request_id: requestId,
    });
    if (error) console.warn("[metering] insert failed:", error.message);
  } catch (e) {
    console.warn("[metering] insert threw:", e);
  }
}
