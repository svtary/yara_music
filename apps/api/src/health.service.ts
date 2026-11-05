import { Inject, Injectable } from '@nestjs/common';
import { probePostgres, type YaraDatabase } from '@yara/adapters-postgres';
import type { HealthResponse } from '@yara/contracts';
import type { Kysely } from 'kysely';

import { DATABASE } from './tokens.js';

@Injectable()
export class HealthService {
  public constructor(@Inject(DATABASE) private readonly database: Kysely<YaraDatabase>) {}

  public live(): HealthResponse {
    return {
      service: 'api',
      status: 'ok',
      version: '0.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  public async ready(): Promise<HealthResponse> {
    try {
      const probe = await probePostgres(this.database);
      const extensionsReady = probe.pgTrgmAvailable && probe.pgvectorAvailable;
      return {
        service: 'api',
        status: extensionsReady ? 'ok' : 'degraded',
        version: '0.0.0',
        timestamp: new Date().toISOString(),
        checks: {
          postgres: 'ok',
          pgTrgm: probe.pgTrgmAvailable ? 'ok' : 'degraded',
          pgvector: probe.pgvectorAvailable ? 'ok' : 'degraded',
        },
      };
    } catch {
      return {
        service: 'api',
        status: 'degraded',
        version: '0.0.0',
        timestamp: new Date().toISOString(),
        checks: { postgres: 'degraded' },
      };
    }
  }
}
