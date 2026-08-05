// Appel du cerveau (Edge Function agent-concierge).
export async function askAgent(message: string, phone: string): Promise<string> {
  const url = `${process.env.SUPABASE_URL}/functions/v1/agent-concierge`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
  };
  if (process.env.AGENT_SHARED_SECRET) headers['x-agent-secret'] = process.env.AGENT_SHARED_SECRET;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, phone }),
  });

  if (!res.ok) {
    console.error('[agent] error', res.status, await res.text());
    return '';
  }

  const data = await res.json() as { reply?: string };
  return data.reply ?? '';
}
