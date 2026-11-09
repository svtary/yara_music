import { z } from 'zod';

const nodeEnvironment = z.enum(['development', 'test', 'staging', 'production']);
const logLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']);
const port = z.coerce.number().int().min(1).max(65_535);
const databaseUrl = z.string().url().startsWith('postgresql://');
const providerUrl = z.string().url();
const modelProvider = z.enum(['disabled', 'openai']);

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
);

const apiEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironment.default('development'),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: port.default(4000),
  DATABASE_URL: databaseUrl,
  LOG_LEVEL: logLevel.default('info'),
  MODEL_PROVIDER: modelProvider.default('disabled'),
  MODEL_NAME: z.string().min(1).default('gpt-5-mini'),
  YARA_ACTOR_REF: z.string().min(1).max(256).default('user:yara:local'),
});

const workerEnvironmentSchema = z
  .object({
    NODE_ENV: nodeEnvironment.default('development'),
    WORKER_HEALTH_PORT: port.default(4001),
    DATABASE_URL: databaseUrl,
    LOG_LEVEL: logLevel.default('info'),
    MODEL_PROVIDER: modelProvider.default('disabled'),
    MODEL_NAME: z.string().min(1).default('gpt-5-mini'),
    MODEL_API_KEY: optionalNonEmptyString,
    MODEL_BASE_URL: optionalNonEmptyString.pipe(z.string().url().optional()),
    MODEL_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
    WORKER_ID: z.string().min(1).max(128).default('worker:local'),
    AI_JOB_POLL_MS: z.coerce.number().int().min(100).max(10_000).default(500),
    AI_JOB_LEASE_MS: z.coerce.number().int().min(5_000).max(300_000).default(45_000),
    AI_JOB_HEARTBEAT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  })
  .superRefine((value, context) => {
    if (value.MODEL_PROVIDER === 'openai' && !value.MODEL_API_KEY) {
      context.addIssue({
        code: 'custom',
        path: ['MODEL_API_KEY'],
        message: 'MODEL_API_KEY is required when MODEL_PROVIDER=openai.',
      });
    }
    if (value.AI_JOB_HEARTBEAT_MS >= value.AI_JOB_LEASE_MS) {
      context.addIssue({
        code: 'custom',
        path: ['AI_JOB_HEARTBEAT_MS'],
        message: 'AI_JOB_HEARTBEAT_MS must be shorter than AI_JOB_LEASE_MS.',
      });
    }
  });

const webEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironment.default('development'),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:4000'),
  API_INTERNAL_BASE_URL: z.string().url().optional(),
});

const catalogProviderEnvironmentSchema = z.object({
  MUSICBRAINZ_BASE_URL: providerUrl.default('https://musicbrainz.org/ws/2/'),
  MUSICBRAINZ_USER_AGENT: z
    .string()
    .min(12)
    .default('Yara-MVP-0/0.0.0 (https://github.com/yarayu/yara)'),
  MUSICBRAINZ_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(8_000),
  MUSICBRAINZ_REQUEST_INTERVAL_MS: z.coerce.number().int().min(1_000).default(1_000),
  MUSICBRAINZ_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(2),
  COVER_ART_ARCHIVE_BASE_URL: providerUrl.default('https://coverartarchive.org/'),
});

export interface ApiConfig {
  readonly nodeEnv: z.infer<typeof nodeEnvironment>;
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly logLevel: z.infer<typeof logLevel>;
  readonly modelProvider: z.infer<typeof modelProvider>;
  readonly modelName: string;
  readonly yaraActorRef: string;
}

export interface WorkerConfig {
  readonly nodeEnv: z.infer<typeof nodeEnvironment>;
  readonly healthPort: number;
  readonly databaseUrl: string;
  readonly logLevel: z.infer<typeof logLevel>;
  readonly modelProvider: z.infer<typeof modelProvider>;
  readonly modelName: string;
  readonly modelApiKey?: string;
  readonly modelBaseUrl?: string;
  readonly modelTimeoutMs: number;
  readonly workerId: string;
  readonly jobPollMs: number;
  readonly jobLeaseMs: number;
  readonly jobHeartbeatMs: number;
}

export interface WebConfig {
  readonly nodeEnv: z.infer<typeof nodeEnvironment>;
  readonly apiBaseUrl: string;
  readonly apiInternalBaseUrl: string;
}

export interface CatalogProviderConfig {
  readonly musicBrainzBaseUrl: string;
  readonly musicBrainzUserAgent: string;
  readonly musicBrainzTimeoutMs: number;
  readonly musicBrainzRequestIntervalMs: number;
  readonly musicBrainzMaxRetries: number;
  readonly coverArtArchiveBaseUrl: string;
}

export function readApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const value = apiEnvironmentSchema.parse(environment);
  return {
    nodeEnv: value.NODE_ENV,
    host: value.API_HOST,
    port: value.API_PORT,
    databaseUrl: value.DATABASE_URL,
    logLevel: value.LOG_LEVEL,
    modelProvider: value.MODEL_PROVIDER,
    modelName: value.MODEL_NAME,
    yaraActorRef: value.YARA_ACTOR_REF,
  };
}

export function readWorkerConfig(environment: NodeJS.ProcessEnv): WorkerConfig {
  const value = workerEnvironmentSchema.parse(environment);
  return {
    nodeEnv: value.NODE_ENV,
    healthPort: value.WORKER_HEALTH_PORT,
    databaseUrl: value.DATABASE_URL,
    logLevel: value.LOG_LEVEL,
    modelProvider: value.MODEL_PROVIDER,
    modelName: value.MODEL_NAME,
    ...(value.MODEL_API_KEY ? { modelApiKey: value.MODEL_API_KEY } : {}),
    ...(value.MODEL_BASE_URL ? { modelBaseUrl: value.MODEL_BASE_URL } : {}),
    modelTimeoutMs: value.MODEL_TIMEOUT_MS,
    workerId: value.WORKER_ID,
    jobPollMs: value.AI_JOB_POLL_MS,
    jobLeaseMs: value.AI_JOB_LEASE_MS,
    jobHeartbeatMs: value.AI_JOB_HEARTBEAT_MS,
  };
}

export function readWebConfig(environment: NodeJS.ProcessEnv): WebConfig {
  const value = webEnvironmentSchema.parse(environment);
  return {
    nodeEnv: value.NODE_ENV,
    apiBaseUrl: value.NEXT_PUBLIC_API_BASE_URL,
    apiInternalBaseUrl: value.API_INTERNAL_BASE_URL ?? value.NEXT_PUBLIC_API_BASE_URL,
  };
}

export function readCatalogProviderConfig(environment: NodeJS.ProcessEnv): CatalogProviderConfig {
  const value = catalogProviderEnvironmentSchema.parse(environment);
  return {
    musicBrainzBaseUrl: value.MUSICBRAINZ_BASE_URL,
    musicBrainzUserAgent: value.MUSICBRAINZ_USER_AGENT,
    musicBrainzTimeoutMs: value.MUSICBRAINZ_TIMEOUT_MS,
    musicBrainzRequestIntervalMs: value.MUSICBRAINZ_REQUEST_INTERVAL_MS,
    musicBrainzMaxRetries: value.MUSICBRAINZ_MAX_RETRIES,
    coverArtArchiveBaseUrl: value.COVER_ART_ARCHIVE_BASE_URL,
  };
}
