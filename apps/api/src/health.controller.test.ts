import type { HealthResponse } from '@yara/contracts';
import type { FastifyReply } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('reports process liveness without claiming database readiness', () => {
    const service = new HealthService(null as never);
    expect(service.live()).toMatchObject({ service: 'api', status: 'ok', version: '0.0.0' });
  });

  it('maps degraded readiness to HTTP 503', async () => {
    const degraded: HealthResponse = {
      service: 'api',
      status: 'degraded',
      version: '0.0.0',
      timestamp: new Date(0).toISOString(),
      checks: { postgres: 'degraded' },
    };
    const service = { ready: vi.fn().mockResolvedValue(degraded) } as unknown as HealthService;
    const status = vi.fn();
    const response = { status } as unknown as FastifyReply;

    await expect(new HealthController(service).ready(response)).resolves.toEqual(degraded);
    expect(status).toHaveBeenCalledWith(503);
  });
});
