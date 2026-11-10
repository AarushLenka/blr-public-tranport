import { NextResponse } from 'next/server';
import { getNetwork } from '@/lib/network';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const net = getNetwork();
    return NextResponse.json(
      {
        status: 'ok',
        service: 'blr-transit',
        generatedAt: net.generatedAt,
        stops: net.stops.length,
        patterns: net.patterns.length,
        uptimeSeconds: Math.round(process.uptime()),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ status: 'degraded', reason: 'transit index unavailable' }, { status: 503 });
  }
}
