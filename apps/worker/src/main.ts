import { createServer, type ServerResponse } from 'node:http';

import { createPostgresDatabase, probePostgres } from '@yara/adapters-postgres';
import { readWorkerConfig } from '@yara/config';
import type { HealthResponse } from '@yara/contracts';

const config = readWorkerConfig(process.env);
const database = createPostgresDatabase(config.databaseUrl, { maxConnections: 2 });

function writeJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(`${JSON.stringify(body)}\n`);
}

const server = createServer(async (request, response) => {
  if (request.url === '/health/live') {
    const body: HealthResponse = {
      service: 'worker',
      status: 'ok',
      version: '0.0.0',
      timestamp: new Date().toISOString(),
    };
    writeJson(response, 200, body);
    return;
  }

  if (request.url === '/health/ready') {
    try {
      const probe = await probePostgres(database);
      const ready = probe.pgTrgmAvailable && probe.pgvectorAvailable;
      const body: HealthResponse = {
        service: 'worker',
        status: ready ? 'ok' : 'degraded',
        version: '0.0.0',
        timestamp: new Date().toISOString(),
        checks: {
          postgres: 'ok',
          pgTrgm: probe.pgTrgmAvailable ? 'ok' : 'degraded',
          pgvector: probe.pgvectorAvailable ? 'ok' : 'degraded',
        },
      };
      writeJson(response, ready ? 200 : 503, body);
    } catch {
      writeJson(response, 503, {
        service: 'worker',
        status: 'degraded',
        version: '0.0.0',
        timestamp: new Date().toISOString(),
        checks: { postgres: 'degraded' },
      } satisfies HealthResponse);
    }
    return;
  }

  writeJson(response, 404, { error: 'not_found' });
});

server.listen(config.healthPort, '0.0.0.0', () => {
  console.log(`Yara worker health endpoint listening on :${config.healthPort}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Yara worker received ${signal}; shutting down`);
  server.close();
  await database.destroy();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
