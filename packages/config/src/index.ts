import { z } from 'zod';

const nodeEnvironment = z.enum(['development', 'test', 'staging', 'production']);
const logLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']);
const port = z.coerce.number().int().min(1).max(65_535);
const databaseUrl = z.string().url().startsWith('postgresql://');

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
