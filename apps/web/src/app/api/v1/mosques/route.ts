import { NextResponse } from 'next/server';
import { searchPublicMosques } from '@/server/mosques';

export const dynamic = 'force-dynamic';

/** GET /api/v1/mosques?q=… — openbare moskeeën, alleen publieke velden. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const mosques = await searchPublicMosques(q);
  return NextResponse.json({ mosques }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
