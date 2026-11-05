import {
  CoverArtArchiveClient,
  MusicBrainzClient,
  MusicBrainzProviderAdapter,
} from '@yara/adapters-musicbrainz';
import { createPostgresDatabase, migrateYaraDatabase } from '@yara/adapters-postgres';
import {
  PostgresCatalogQueryAdapter,
  PostgresCatalogSearchAdapter,
  PostgresCatalogWriteAdapter,
} from '@yara/adapters-postgres/catalog';
import { CatalogIngestionService } from '@yara/application';
import { readApiConfig, readCatalogProviderConfig } from '@yara/config';

export async function createCatalogCli() {
  const databaseConfig = readApiConfig(process.env);
  const providerConfig = readCatalogProviderConfig(process.env);
  const database = createPostgresDatabase(databaseConfig.databaseUrl, { maxConnections: 3 });
  await migrateYaraDatabase(database);

  const commonProviderOptions = {
    userAgent: providerConfig.musicBrainzUserAgent,
    timeoutMs: providerConfig.musicBrainzTimeoutMs,
    maximumRetries: providerConfig.musicBrainzMaxRetries,
  } as const;
  const provider = new MusicBrainzProviderAdapter(
    new MusicBrainzClient({
      ...commonProviderOptions,
      baseUrl: providerConfig.musicBrainzBaseUrl,
      minimumIntervalMs: providerConfig.musicBrainzRequestIntervalMs,
    }),
    new CoverArtArchiveClient({
      ...commonProviderOptions,
      baseUrl: providerConfig.coverArtArchiveBaseUrl,
      minimumIntervalMs: 0,
    }),
  );
  const catalogQuery = new PostgresCatalogQueryAdapter(database);
  const searchProjection = new PostgresCatalogSearchAdapter(database);
  const ingestion = new CatalogIngestionService(
    provider,
    catalogQuery,
    new PostgresCatalogWriteAdapter(database),
    searchProjection,
  );
  return { database, catalogQuery, searchProjection, ingestion };
}
