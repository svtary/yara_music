import { readWebConfig } from '@yara/config';
import { NextResponse } from 'next/server';

export async function proxyYaraJson(path: string, init: RequestInit = {}): Promise<NextResponse> {
  const { apiInternalBaseUrl } = readWebConfig(process.env);
  try {
    const response = await fetch(`${apiInternalBaseUrl}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    const body = await response.json().catch(() => ({ error: 'invalid_response' }));
    if (!response.ok) {
      const status = response.status === 404 || response.status === 422 ? response.status : 502;
      return NextResponse.json(
        { error: status === 404 ? 'not_found' : 'yara_unavailable' },
        { status },
      );
    }
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'yara_unavailable' }, { status: 503 });
  }
}

export async function proxyYaraSse(path: string, request: Request): Promise<Response> {
  const { apiInternalBaseUrl } = readWebConfig(process.env);
  try {
    const lastEventId = request.headers.get('last-event-id');
    const response = await fetch(`${apiInternalBaseUrl}${path}`, {
      cache: 'no-store',
      headers: {
        accept: 'text/event-stream',
        ...(lastEventId ? { 'last-event-id': lastEventId } : {}),
      },
      signal: request.signal,
    });
    if (!response.ok || !response.body) {
      return NextResponse.json({ error: 'stream_unavailable' }, { status: response.status || 502 });
    }
    return new Response(response.body, {
      status: response.status,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    });
  } catch {
    return NextResponse.json({ error: 'stream_unavailable' }, { status: 503 });
  }
}
