import { z } from 'zod';

const nodeEnvironment = z.enum(['development', 'test', 'staging', 'production']);
const logLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']);
const port = z.coerce.number().int().min(1).max(65_535);
const databaseUrl = z.string().url().startsWith('postgresql://');
const providerUrl = z.string().url();

const apiEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironment.default('development'),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: port.default(4000),
  DATABASE_URL: databaseUrl,
  LOG_LEVEL: logLevel.default('info'),
});

const workerEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironment.default('development'),
  WORKER_HEALTH_PORT: port.default(4001),
  DATABASE_URL: databaseUrl,
  LOG_LEVEL: logLevel.default('info'),
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
}

export interface WorkerConfig {
  readonly nodeEnv: z.infer<typeof nodeEnvironment>;
  readonly healthPort: number;
  readonly databaseUrl: string;
  readonly logLevel: z.infer<typeof logLevel>;
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
  };
}

export function readWorkerConfig(environment: NodeJS.ProcessEnv): WorkerConfig {
  const value = workerEnvironmentSchema.parse(environment);
  return {
    nodeEnv: value.NODE_ENV,
    healthPort: value.WORKER_HEALTH_PORT,
    databaseUrl: value.DATABASE_URL,
    logLevel: value.LOG_LEVEL,
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
