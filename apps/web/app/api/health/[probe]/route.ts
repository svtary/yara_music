import { readWebConfig } from '@yara/config';
import type { HealthResponse } from '@yara/contracts';
import { NextResponse } from 'next/server';

const supportedProbes = new Set(['live', 'ready']);

export async function GET(
  _request: Request,
  context: Readonly<{ params: Promise<{ probe: string }> }>,
) {
  const { probe } = await context.params;
  if (!supportedProbes.has(probe)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const config = readWebConfig(process.env);

  try {
    const response = await fetch(`${config.apiInternalBaseUrl}/health/${probe}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    const body = (await response.json()) as HealthResponse;
    return NextResponse.json(body, { status: response.status });
  } catch {
    const unavailable: HealthResponse = {
      service: 'web',
      status: 'degraded',
      version: '0.0.0',
      timestamp: new Date().toISOString(),
      checks: { api: 'degraded' },
    };
    return NextResponse.json(unavailable, { status: 503 });
  }
}
