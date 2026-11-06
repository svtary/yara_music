import { NextResponse } from 'next/server';

import { proxyCatalogRead } from '../../../../lib/server/catalog-proxy';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length === 0 || query.length > 120) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  return proxyCatalogRead(`/search?q=${encodeURIComponent(query)}&limit=30`);
}
