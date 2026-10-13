import { NextResponse } from 'next/server';
import { getPublicMosqueById } from '@/server/mosques';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const mosque = await getPublicMosqueById((await params).id);
  if (!mosque) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ mosque }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
