import { NextRequest, NextResponse } from 'next/server';
import { isDemo } from '@/lib/demo';
import { baileysFetch } from '@/lib/baileys';

export async function POST(req: NextRequest) {
  if (isDemo()) return NextResponse.json({ ok: true, demo: true });
  const { phone, message } = await req.json() as { phone: string; message: string };

  try {
    const res = await baileysFetch('/send', {
      method: 'POST',
      body: JSON.stringify({ phone, message }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
  }
}
