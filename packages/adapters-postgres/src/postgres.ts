import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';

import type { YaraDatabase } from './database-schema.js';

const { Pool } = pg;

export interface PostgresProbe {
  readonly serverVersion: string;
  readonly pgTrgmAvailable: boolean;
  readonly pgvectorAvailable: boolean;
}

export function createPostgresDatabase(
  connectionString: string,
  options: { readonly maxConnections?: number } = {},
): Kysely<YaraDatabase> {
  return new Kysely<YaraDatabase>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString,
        max: options.maxConnections ?? 10,
      }),
    }),
  });
}

export async function probePostgres(database: Kysely<YaraDatabase>): Promise<PostgresProbe> {
  const version = await sql<{ server_version: string }>`
    select current_setting('server_version') as server_version
  `.execute(database);
  const extensions = await sql<{ extname: string }>`
    select extname from pg_extension where extname in ('pg_trgm', 'vector')
  `.execute(database);
  const installed = new Set(extensions.rows.map((row) => row.extname));
  const serverVersion = version.rows[0]?.server_version;
  if (!serverVersion) {
    throw new Error('PostgreSQL did not return a server version');
  }
  return {
    serverVersion,
    pgTrgmAvailable: installed.has('pg_trgm'),
    pgvectorAvailable: installed.has('vector'),
  };
}
