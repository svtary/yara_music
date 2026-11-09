import { describe, expect, it } from 'vitest';

import {
  readApiConfig,
  readCatalogProviderConfig,
  readWebConfig,
  readWorkerConfig,
} from './index.js';

const databaseUrl = 'postgresql://yara:password@localhost:5432/yara';

describe('typed environment configuration', () => {
  it('applies safe Stage 0 defaults', () => {
    expect(readApiConfig({ DATABASE_URL: databaseUrl })).toMatchObject({
      nodeEnv: 'development',
      host: '0.0.0.0',
      port: 4000,
      logLevel: 'info',
      modelProvider: 'disabled',
      modelName: 'gpt-5-mini',
      yaraActorRef: 'user:yara:local',
    });
    expect(readWorkerConfig({ DATABASE_URL: databaseUrl })).toMatchObject({
      healthPort: 4001,
      modelProvider: 'disabled',
      workerId: 'worker:local',
      jobPollMs: 500,
      jobLeaseMs: 45_000,
      jobHeartbeatMs: 10_000,
    });
    expect(readWebConfig({})).toMatchObject({
      nodeEnv: 'development',
      apiBaseUrl: 'http://localhost:4000',
      apiInternalBaseUrl: 'http://localhost:4000',
    });
    expect(readWebConfig({ API_INTERNAL_BASE_URL: 'http://api:4000' }).apiInternalBaseUrl).toBe(
      'http://api:4000',
    );
    expect(readCatalogProviderConfig({})).toMatchObject({
      musicBrainzBaseUrl: 'https://musicbrainz.org/ws/2/',
      musicBrainzRequestIntervalMs: 1_000,
      musicBrainzMaxRetries: 2,
      coverArtArchiveBaseUrl: 'https://coverartarchive.org/',
    });
  });

  it('rejects invalid critical values', () => {
    expect(() => readApiConfig({ DATABASE_URL: 'not-a-url', API_PORT: '0' })).toThrow();
    expect(() => readCatalogProviderConfig({ MUSICBRAINZ_REQUEST_INTERVAL_MS: '999' })).toThrow();
    expect(() => readWorkerConfig({ DATABASE_URL: databaseUrl, MODEL_PROVIDER: 'openai' })).toThrow(
      /MODEL_API_KEY/,
    );
    expect(() =>
      readWorkerConfig({
        DATABASE_URL: databaseUrl,
        AI_JOB_LEASE_MS: '5000',
        AI_JOB_HEARTBEAT_MS: '5000',
      }),
    ).toThrow(/AI_JOB_HEARTBEAT_MS/);
  });
});
