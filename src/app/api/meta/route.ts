import { NextResponse } from 'next/server';
import { getNetwork } from '@/lib/network';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const net = getNetwork();
  return NextResponse.json(
    {
      sources: net.sources,
      generatedAt: net.generatedAt,
      counts: net.meta,
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
