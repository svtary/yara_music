import { readApiConfig } from '@yara/config';

import { createPostgresDatabase, migrateYaraDatabase, probePostgres } from './index.js';

const config = readApiConfig(process.env);
const database = createPostgresDatabase(config.databaseUrl, { maxConnections: 2 });

try {
  await migrateYaraDatabase(database);
  const probe = await probePostgres(database);
  console.log(JSON.stringify({ migration: 'ok', ...probe }));
} finally {
  await database.destroy();
}
