import { readApiConfig } from '@yara/config';

import { createPostgresDatabase, migrateYaraDatabase } from './index.js';
import { catalogFixtures, seedCatalogFixtures } from './catalog.js';

if (process.env['NODE_ENV'] === 'production') {
  throw new Error('Catalog development fixtures must never be loaded in production.');
}

const config = readApiConfig(process.env);
const database = createPostgresDatabase(config.databaseUrl);

try {
  await migrateYaraDatabase(database);
  await seedCatalogFixtures(database);
  console.log(
    JSON.stringify({
      seed: 'ok',
      fixtureSet: 'catalog:v2',
      artists: catalogFixtures.artists.length,
      albums: catalogFixtures.albums.length,
      recordings: catalogFixtures.recordings.length,
      providerMappings: catalogFixtures.providerMappings.length,
    }),
  );
} finally {
  await database.destroy();
}
