import { NextResponse } from 'next/server';
import { demoWaConversations, isDemo } from '@/lib/demo';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  if (isDemo()) return NextResponse.json(demoWaConversations);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('wa_conversations')
    .select('*')
    .order('last_message_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
