import { readWebConfig } from '@yara/config';
import { NextResponse } from 'next/server';

type CatalogErrorCode = 'not_found' | 'invalid_request' | 'catalog_unavailable';

function errorResponse(code: CatalogErrorCode, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function proxyCatalogRead(path: string): Promise<NextResponse> {
  const { apiInternalBaseUrl } = readWebConfig(process.env);

  try {
    const response = await fetch(`${apiInternalBaseUrl}${path}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 404) return errorResponse('not_found', 404);
      if (response.status === 400) return errorResponse('invalid_request', 400);
      return errorResponse('catalog_unavailable', 502);
    }

    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return errorResponse('catalog_unavailable', 503);
  }
}
