import { NextResponse } from 'next/server';
import { baileysFetch } from '@/lib/baileys';

export async function GET() {
  try {
    const res = await baileysFetch('/qr');
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
  }
}
