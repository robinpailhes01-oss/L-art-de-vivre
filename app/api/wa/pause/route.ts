import { NextRequest, NextResponse } from 'next/server';
import { baileysFetch } from '@/lib/baileys';

export async function POST(req: NextRequest) {
  const { phone, action } = await req.json() as { phone: string; action: 'pause' | 'resume' };

  const endpoint = action === 'pause' ? 'pause' : 'resume';
  try {
    const res = await baileysFetch(`/${endpoint}/${encodeURIComponent(phone)}`, {
      method: 'POST',
      body: JSON.stringify({ hours: 24 }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
  }
}
