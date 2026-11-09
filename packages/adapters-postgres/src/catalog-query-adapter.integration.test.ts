import { albumId, artistId, createProviderIdentity, recordingId } from '@yara/domain-catalog';
import { sql, type Kysely } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createPostgresDatabase,
  migrateYaraDatabase,
  migrateYaraDatabaseTo,
  type YaraDatabase,
} from './index.js';
import { PostgresCatalogQueryAdapter, seedCatalogFixtures } from './catalog.js';

const { Pool } = pg;
const describePostgres =
  process.env['YARA_RUN_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;

describePostgres('PostgreSQL Catalog persistence', () => {
  const sourceUrl = process.env['DATABASE_URL'];
  const databaseName = `yara_catalog_upgrade_test_${process.pid}`;
  const freshDatabaseName = `yara_catalog_fresh_test_${process.pid}`;
  let admin: InstanceType<typeof Pool>;
  let database: Kysely<YaraDatabase>;
  let freshDatabase: Kysely<YaraDatabase>;

  beforeAll(async () => {
    if (!sourceUrl) throw new Error('DATABASE_URL is required for PostgreSQL integration tests');

    admin = new Pool({ connectionString: sourceUrl, max: 1 });
    for (const name of [databaseName, freshDatabaseName]) {
      await admin.query(`drop database if exists "${name}"`);
      await admin.query(`create database "${name}"`);
    }

    const upgradeUrl = new URL(sourceUrl);
    upgradeUrl.pathname = `/${databaseName}`;
    database = createPostgresDatabase(upgradeUrl.toString(), { maxConnections: 4 });
    await migrateYaraDatabaseTo(database, '0002_catalog_foundation');
    await sql`
      insert into catalog.artists (id, canonical_name)
      values ('artist:legacy', 'Legacy Artist');
      insert into catalog.recordings (id, canonical_title)
      values ('recording:legacy', 'Legacy Recording');
      insert into catalog.releases (id, canonical_title)
      values ('release:legacy-album', 'Legacy Album');
      insert into catalog.release_artists (release_id, artist_id, position)
      values ('release:legacy-album', 'artist:legacy', 0);
      insert into catalog.release_recordings (release_id, recording_id, position)
      values ('release:legacy-album', 'recording:legacy', 0);
      insert into catalog.recording_artists (recording_id, artist_id, position)
      values ('recording:legacy', 'artist:legacy', 0);
      insert into catalog.provider_mappings (
        provider, object_type, external_id, mapping_version, status,
        provenance_source_ref, canonical_artist_id, canonical_release_id,
        canonical_recording_id
      ) values (
        'legacy-provider', 'release', 'legacy-release-object', 1, 'resolved',
        'legacy:observation', null, 'release:legacy-album', null
      );
    `.execute(database);
    await migrateYaraDatabase(database);
    await migrateYaraDatabase(database);

    const freshUrl = new URL(sourceUrl);
    freshUrl.pathname = `/${freshDatabaseName}`;
    freshDatabase = createPostgresDatabase(freshUrl.toString(), { maxConnections: 2 });
    await migrateYaraDatabase(freshDatabase);
    await migrateYaraDatabase(freshDatabase);
  }, 30_000);

  afterAll(async () => {
    if (database) await database.destroy();
    if (freshDatabase) await freshDatabase.destroy();
    if (admin) {
      for (const name of [databaseName, freshDatabaseName]) {
        await admin.query(
          'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1',
          [name],
        );
        await admin.query(`drop database if exists "${name}"`);
      }
      await admin.end();
    }
  });

  it('migrates an existing 0002 database, preserves data, and creates the same fresh schema', async () => {
    const expectedTables = [
      'album_artists',
      'album_recordings',
      'albums',
      'artists',
      'provider_mapping_candidates',
      'provider_mappings',
      'recording_artists',
      'recordings',
    ];
    for (const target of [database, freshDatabase]) {
      const tables = await sql<{ table_name: string }>`
        select table_name
        from information_schema.tables
        where table_schema = 'catalog'
        order by table_name
      `.execute(target);
      expect(tables.rows.map(({ table_name }) => table_name)).toEqual(expectedTables);
    }

    const preserved = await sql<{
      id: string;
      canonical_kind: string;
      external_object_type: string;
      canonical_album_id: string | null;
    }>`
      select album.id, mapping.canonical_kind, mapping.external_object_type,
        mapping.canonical_album_id
      from catalog.albums album
      join catalog.provider_mappings mapping
        on mapping.canonical_album_id = album.id
      where album.id = 'release:legacy-album'
    `.execute(database);
    expect(preserved.rows[0]).toEqual({
      id: 'release:legacy-album',
      canonical_kind: 'album',
      external_object_type: 'release',
      canonical_album_id: 'release:legacy-album',
    });

    const migrations = await sql<{ name: string }>`
      select name from kysely_migration order by name
    `.execute(database);
    expect(migrations.rows.map(({ name }) => name)).toEqual([
      '0001_stage_zero_extensions',
      '0002_catalog_foundation',
      '0003_catalog_album_metadata',
      '0004_catalog_search_projection',
      '0005_yara_interaction_foundation',
      '0006_yara_interaction_reliability',
    ]);

    await seedCatalogFixtures(database);
  });

  it('round-trips Artist, Album, Recording, metadata, ordered relations, and not-found results', async () => {
    const adapter = new PostgresCatalogQueryAdapter(database);
    await expect(adapter.getArtistById(artistId('artist:radiohead'))).resolves.toEqual({
      id: 'artist:radiohead',
      canonicalName: 'Radiohead',
      image: {
        url: 'https://fixtures.yara.test/images/artists/radiohead.jpg',
        provider: 'fixture-metadata',
        sourceRef: 'fixture:image:artist:radiohead',
      },
    });
    await expect(adapter.getAlbumById(albumId('album:ok-computer'))).resolves.toEqual({
      id: 'album:ok-computer',
      canonicalTitle: 'OK Computer',
      artistIds: ['artist:radiohead'],
      recordingIds: ['recording:paranoid-android', 'recording:karma-police'],
      originalReleaseYear: 1997,
      cover: {
        url: 'https://fixtures.yara.test/images/albums/ok-computer.jpg',
        provider: 'fixture-metadata',
        sourceRef: 'fixture:image:album:ok-computer',
      },
    });
    await expect(
      adapter.getRecordingById(recordingId('recording:paranoid-android')),
    ).resolves.toEqual({
      id: 'recording:paranoid-android',
      canonicalTitle: 'Paranoid Android',
      artistIds: ['artist:radiohead'],
      durationMs: 383_000,
    });
    await expect(adapter.getAlbumById(albumId('album:not-found'))).resolves.toBeNull();

    const sources = await sql<{
      year_source: string | null;
      duration_source: string | null;
    }>`
      select album.original_release_year_source_ref as year_source,
        recording.duration_source_ref as duration_source
      from catalog.albums album
      join catalog.album_recordings relation on relation.album_id = album.id
      join catalog.recordings recording on recording.id = relation.recording_id
      where album.id = 'album:ok-computer' and relation.position = 0
    `.execute(database);
    expect(sources.rows[0]).toEqual({
      year_source: 'fixture:year:album:ok-computer',
      duration_source: 'fixture:duration:recording:paranoid-android',
    });
  });

  it('round-trips all seven ProviderMapping states and external release-group to Album', async () => {
    const adapter = new PostgresCatalogQueryAdapter(database);
    const examples = [
      ['release-group', 'release-group:ok-computer', 'resolved'],
      ['artist', 'artist:unknown', 'unresolved'],
      ['release-group', 'release-group:ambiguous-radiohead', 'ambiguous'],
      ['track', 'track:legacy-paranoid-android', 'superseded'],
      ['artist', 'artist:duplicate-bjork', 'merged'],
      ['release-group', 'release-group:legacy-radiohead-bundle', 'split'],
      ['recording', 'recording:pending-correction', 'correction_pending'],
    ] as const;

    for (const [externalObjectType, externalId, expectedStatus] of examples) {
      const mapping = await adapter.resolveProviderIdentity(
        createProviderIdentity({
          provider: 'fixture-metadata',
          externalObjectType,
          externalId,
        }),
      );
      expect(mapping?.status).toBe(expectedStatus);
      expect(mapping?.provenance.sourceRef).toBe('fixture:catalog:v2');
    }

    const ambiguous = await adapter.resolveProviderIdentity(
      createProviderIdentity({
        provider: 'fixture-metadata',
        externalObjectType: 'release-group',
        externalId: 'release-group:ambiguous-radiohead',
      }),
    );
    expect(ambiguous?.canonicalKind).toBe('album');
    if (ambiguous?.status === 'ambiguous') {
      expect(ambiguous.candidateRefs).toEqual([
        { kind: 'album', id: 'album:ok-computer' },
        { kind: 'album', id: 'album:kid-a' },
      ]);
    }
  });

  it('re-seeds deterministically without duplicating rows', async () => {
    await seedCatalogFixtures(database);
    await seedCatalogFixtures(database);
    const counts = await sql<{ artists: string; albums: string; recordings: string }>`
      select
        (select count(*) from catalog.artists)::text as artists,
        (select count(*) from catalog.albums)::text as albums,
        (select count(*) from catalog.recordings)::text as recordings
    `.execute(database);
    expect(counts.rows[0]).toEqual({ artists: '3', albums: '4', recordings: '7' });
  });

  it('enforces metadata, canonical-kind, and candidate-kind constraints', async () => {
    await expect(
      database
        .insertInto('catalog.albums')
        .values({
          id: 'album:invalid-year',
          canonical_title: 'Invalid Year',
          original_release_year: 999,
          original_release_year_source_ref: 'test:year',
          cover_url: null,
          cover_provider: null,
          cover_source_ref: null,
        })
        .execute(),
    ).rejects.toThrow();
    await expect(
      database
        .insertInto('catalog.recordings')
        .values({
          id: 'recording:missing-source',
          canonical_title: 'Missing Source',
          duration_ms: 1000,
          duration_source_ref: null,
        })
        .execute(),
    ).rejects.toThrow();
    await expect(
      database
        .insertInto('catalog.artists')
        .values({
          id: 'artist:partial-image',
          canonical_name: 'Partial Image',
          image_url: 'https://fixtures.yara.test/partial.jpg',
          image_provider: 'fixture-metadata',
          image_source_ref: null,
        })
        .execute(),
    ).rejects.toThrow();

    await expect(
      database
        .insertInto('catalog.provider_mappings')
        .values({
          provider: 'constraint-test',
          external_object_type: 'release-group',
          external_id: 'wrong-type',
          canonical_kind: 'artist',
          mapping_version: 1,
          status: 'resolved',
          provenance_source_ref: 'test:constraint',
          canonical_artist_id: null,
          canonical_album_id: 'album:ok-computer',
          canonical_recording_id: null,
        })
        .execute(),
    ).rejects.toThrow();

    await expect(
      database.transaction().execute(async (transaction) => {
        await transaction
          .insertInto('catalog.provider_mappings')
          .values({
            provider: 'constraint-test',
            external_object_type: 'release-group',
            external_id: 'candidate-kind-mismatch',
            canonical_kind: 'album',
            mapping_version: 1,
            status: 'ambiguous',
            provenance_source_ref: 'test:constraint',
            canonical_artist_id: null,
            canonical_album_id: null,
            canonical_recording_id: null,
          })
          .execute();
        await transaction
          .insertInto('catalog.provider_mapping_candidates')
          .values([
            {
              provider: 'constraint-test',
              external_object_type: 'release-group',
              external_id: 'candidate-kind-mismatch',
              canonical_kind: 'album',
              mapping_version: 1,
              position: 0,
              candidate_artist_id: 'artist:radiohead',
              candidate_album_id: null,
              candidate_recording_id: null,
            },
            {
              provider: 'constraint-test',
              external_object_type: 'release-group',
              external_id: 'candidate-kind-mismatch',
              canonical_kind: 'album',
              mapping_version: 1,
              position: 1,
              candidate_artist_id: null,
              candidate_album_id: 'album:kid-a',
              candidate_recording_id: null,
            },
          ])
          .execute();
      }),
    ).rejects.toThrow();

    await expect(
      database.transaction().execute(async (transaction) => {
        await transaction
          .insertInto('catalog.provider_mappings')
          .values({
            provider: 'constraint-test',
            external_object_type: 'release-group',
            external_id: 'ambiguous-without-candidates',
            canonical_kind: 'album',
            mapping_version: 1,
            status: 'ambiguous',
            provenance_source_ref: 'test:constraint',
            canonical_artist_id: null,
            canonical_album_id: null,
            canonical_recording_id: null,
          })
          .execute();
      }),
    ).rejects.toThrow(/at least two candidate references/);
  });

  it('keeps physical Release and Recording artwork out of the Catalog schema', async () => {
    const obsoleteTables = await sql<{ count: string }>`
      select count(*)::text as count
      from information_schema.tables
      where table_schema = 'catalog'
        and table_name in ('releases', 'release_artists', 'release_recordings')
    `.execute(database);
    expect(obsoleteTables.rows[0]?.count).toBe('0');

    const recordingArtwork = await sql<{ count: string }>`
      select count(*)::text as count
      from information_schema.columns
      where table_schema = 'catalog'
        and table_name = 'recordings'
        and column_name in ('image_url', 'artwork_url', 'cover_url')
    `.execute(database);
    expect(recordingArtwork.rows[0]?.count).toBe('0');
  });
});
