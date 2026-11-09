import { createServer, type ServerResponse } from 'node:http';

import { OpenAIModelProviderAdapter } from '@yara/adapters-openai';
import {
  createPostgresDatabase,
  PostgresYaraInteractionAdapter,
  probePostgres,
} from '@yara/adapters-postgres';
import { ControlledAgentRuntime, UnavailableModelProvider } from '@yara/ai-runtime';
import {
  ConversationExecutionService,
  DurableAIExecutionWorker,
  type AIExecutionObservation,
} from '@yara/application';
import { readWorkerConfig } from '@yara/config';
import type { HealthResponse } from '@yara/contracts';
import { PgBoss } from 'pg-boss';

const config = readWorkerConfig(process.env);
const database = createPostgresDatabase(config.databaseUrl, { maxConnections: 2 });
const persistence = new PostgresYaraInteractionAdapter(database);
const provider =
  config.modelProvider === 'openai' && config.modelApiKey
    ? new OpenAIModelProviderAdapter({
        apiKey: config.modelApiKey,
        timeoutMs: config.modelTimeoutMs,
        ...(config.modelBaseUrl ? { baseURL: config.modelBaseUrl } : {}),
      })
    : new UnavailableModelProvider();
const execution = new ConversationExecutionService(
  persistence,
  new ControlledAgentRuntime(provider),
  {
    record(observation: AIExecutionObservation) {
      console.info(JSON.stringify({ event: 'ai.execution', ...observation }));
    },
  },
);
const durableWorker = new DurableAIExecutionWorker(persistence, execution, {
  workerId: config.workerId,
  leaseDurationMs: config.jobLeaseMs,
  heartbeatIntervalMs: config.jobHeartbeatMs,
});
let stopping = false;
let publishing = false;
const durableExecutionQueue = 'yara-ai-execution-drain';
const boss = new PgBoss({
  connectionString: config.databaseUrl,
  schema: 'yara_jobs',
  application_name: config.workerId,
});

boss.on('error', (error) => {
  console.error(
    JSON.stringify({
      event: 'pg_boss.error',
      message: error instanceof Error ? error.message : 'unknown_pg_boss_error',
    }),
  );
});

async function publishDrainSignal(): Promise<void> {
  if (publishing || stopping) return;
  publishing = true;
  try {
    if (!(await durableWorker.hasPendingWork())) return;
    await boss.send(durableExecutionQueue, null, {
      singletonKey: 'durable-ai-outbox',
      singletonSeconds: 1,
      retryLimit: 0,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'ai.execution.dispatch_error',
        message: error instanceof Error ? error.message : 'unknown_dispatch_error',
      }),
    );
  } finally {
    publishing = false;
  }
}

const recovery = await durableWorker.recover();
console.info(JSON.stringify({ event: 'ai.execution.recovery', ...recovery }));
await boss.start({ attempts: 3 });
await boss.createQueue(durableExecutionQueue, {
  retryLimit: 0,
  expireInSeconds: Math.max(60, Math.ceil(config.jobLeaseMs / 1_000) + 15),
  deleteAfterSeconds: 3_600,
});
await boss.work(durableExecutionQueue, { localConcurrency: 1 }, async () => {
  while (!stopping && (await durableWorker.processNext())) {
    // One pg-boss signal drains owner-transactional PostgreSQL outbox work sequentially.
  }
});
const dispatchTimer = setInterval(() => void publishDrainSignal(), config.jobPollMs);
void publishDrainSignal();

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
  stopping = true;
  clearInterval(dispatchTimer);
  durableWorker.abortActive();
  server.close();
  await boss.stop({ graceful: true, timeout: config.jobLeaseMs });
  await database.destroy();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
