import type { HealthResponse } from '@yara/contracts';

export type HealthProbe = 'live' | 'ready';

export async function fetchHealth(probe: HealthProbe): Promise<HealthResponse> {
  const response = await fetch(`/api/health/${probe}`, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Health probe failed with status ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
