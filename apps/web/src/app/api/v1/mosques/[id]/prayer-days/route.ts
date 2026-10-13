import { NextResponse } from 'next/server';
import { localDateAt } from '@mescid/domain';
import { getPublicMosqueById } from '@/server/mosques';
import { loadPublicSchedule, parseRange, MAX_RANGE_DAYS } from '@/lib/public-data';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mosques/{id}/prayer-days?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Zonder periode: gisteren t/m morgen in de tijdzone van de moskee (genoeg voor "volgend gebed").
 * Alleen gepubliceerde tijden; elke dag bevat lokale tijden met dagverschuiving, plus bron en versie.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const mosque = await getPublicMosqueById((await params).id);
  if (!mosque) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const sp = new URL(req.url).searchParams;
  const nowMs = Date.now();
  const range = parseRange(sp.get('from'), sp.get('to'), localDateAt(nowMs, mosque.timezone));
  if (!range) return NextResponse.json({ error: 'invalid_range', maxDays: MAX_RANGE_DAYS }, { status: 400 });
  const data = await loadPublicSchedule(mosque, range.from, range.to, nowMs);
  return NextResponse.json({ ...data, from: range.from, to: range.to }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
