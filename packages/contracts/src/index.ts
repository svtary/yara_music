export type ServiceName = 'web' | 'api' | 'worker';

export type HealthStatus = 'ok' | 'degraded';

export interface HealthResponse {
  readonly service: ServiceName;
  readonly status: HealthStatus;
  readonly version: string;
  readonly timestamp: string;
  readonly checks?: Readonly<Record<string, HealthStatus>>;
}
