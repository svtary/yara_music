import {
  CatalogIngestionService,
  SearchCatalogQuery,
  type ExternalAlbumCandidate,
  type ExternalArtistCandidate,
  type ExternalCatalogProviderPort,
  type ExternalRecordingCandidate,
} from '@yara/application';
import {
  createProviderIdentity,
  providerMappingSourceRef,
  recordingId,
} from '@yara/domain-catalog';
import { sql, type Kysely } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createPostgresDatabase, migrateYaraDatabase, type YaraDatabase } from './index.js';
import {
  PostgresCatalogDetailAdapter,
  PostgresCatalogQueryAdapter,
  PostgresCatalogSearchAdapter,
  PostgresCatalogWriteAdapter,
  seedCatalogFixtures,
} from './catalog.js';

const { Pool } = pg;
const describePostgres =
  process.env['YARA_RUN_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;

describePostgres('Catalog ingestion, Search projection, and Detail reads', () => {
  const sourceUrl = process.env['DATABASE_URL'];
  const databaseName = `yara_catalog_search_test_${process.pid}`;
  let admin: InstanceType<typeof Pool>;
  let database: Kysely<YaraDatabase>;
  let searchAdapter: PostgresCatalogSearchAdapter;

  beforeAll(async () => {
    if (!sourceUrl) throw new Error('DATABASE_URL is required for PostgreSQL integration tests');
    admin = new Pool({ connectionString: sourceUrl, max: 1 });
    await admin.query(`drop database if exists "${databaseName}"`);
    await admin.query(`create database "${databaseName}"`);
    const databaseUrl = new URL(sourceUrl);
    databaseUrl.pathname = `/${databaseName}`;
    database = createPostgresDatabase(databaseUrl.toString(), { maxConnections: 5 });
    await migrateYaraDatabase(database);
    await seedCatalogFixtures(database);
    searchAdapter = new PostgresCatalogSearchAdapter(database);
    await searchAdapter.rebuild();
  }, 30_000);

  afterAll(async () => {
    if (database) await database.destroy();
    if (admin) {
      await admin.query(
        'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1',
        [databaseName],
      );
      await admin.query(`drop database if exists "${databaseName}"`);
      await admin.end();
    }
  });

  it('rebuilds one derived document per canonical object deterministically', async () => {
    const before = await sql<{
      kind: string;
      canonical_id: string;
      searchable_text: string;
    }>`
      select kind, canonical_id, searchable_text
      from search.catalog_documents
      order by kind, canonical_id
    `.execute(database);
    await searchAdapter.rebuild();
    const after = await sql<{
      kind: string;
      canonical_id: string;
      searchable_text: string;
    }>`
      select kind, canonical_id, searchable_text
      from search.catalog_documents
      order by kind, canonical_id
    `.execute(database);
    expect(after.rows).toEqual(before.rows);
    expect(after.rows).toHaveLength(14);
  });

  it('supports exact, case-insensitive, prefix, FTS, typo, typed, and bounded search', async () => {
    const search = new SearchCatalogQuery(searchAdapter);
    await expect(search.execute({ query: 'Radiohead' })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'artist', id: 'artist:radiohead', name: 'Radiohead' }),
      ]),
    );
    await expect(search.execute({ query: 'radiohead' })).resolves.toEqual(
      await search.execute({ query: 'RADIOHEAD' }),
    );
    await expect(search.execute({ query: 'OK Computer', kind: 'album' })).resolves.toEqual([
      expect.objectContaining({
        kind: 'album',
        id: 'album:ok-computer',
        originalReleaseYear: 1997,
      }),
    ]);
    await expect(search.execute({ query: 'Paranoid Android', kind: 'recording' })).resolves.toEqual(
      [
        expect.objectContaining({
          kind: 'recording',
          id: 'recording:paranoid-android',
          durationMs: 383_000,
          albumContext: expect.objectContaining({ id: 'album:ok-computer' }),
        }),
      ],
    );
    expect(await search.execute({ query: 'Paran', kind: 'recording' })).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'recording:paranoid-android' })]),
    );
    expect(await search.execute({ query: 'Right Place', kind: 'recording' })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'recording:everything-in-its-right-place' }),
      ]),
    );
    expect(await search.execute({ query: 'Parnoid Android', kind: 'recording' })).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'recording:paranoid-android' })]),
    );
    expect(await search.execute({ query: 'Radiohead', limit: 2 })).toHaveLength(2);
  });

  it('keeps mixed-result ranking deterministic and exact title first', async () => {
    const request = { query: 'Radiohead', limit: 20 } as const;
    const first = await searchAdapter.search(request);
    const second = await searchAdapter.search(request);
    expect(second).toEqual(first);
    expect(first[0]).toMatchObject({ kind: 'artist', id: 'artist:radiohead' });
    expect(new Set(first.map(({ kind }) => kind))).toEqual(
      new Set(['artist', 'album', 'recording']),
    );
  });

  it('assembles owner-safe Artist, Album, and Recording detail read models', async () => {
    const details = new PostgresCatalogDetailAdapter(database);
    await expect(details.getArtistDetail('artist:radiohead')).resolves.toEqual(
      expect.objectContaining({
        kind: 'artist',
        id: 'artist:radiohead',
        canonicalName: 'Radiohead',
      }),
    );
    const album = await details.getAlbumDetail('album:ok-computer');
    expect(album).toEqual(
      expect.objectContaining({
        kind: 'album',
        trackCount: 2,
        recordings: [
          expect.objectContaining({ id: 'recording:paranoid-android', position: 0 }),
          expect.objectContaining({ id: 'recording:karma-police', position: 1 }),
        ],
      }),
    );
    expect(album).not.toHaveProperty('cover_url');
    expect(album).not.toHaveProperty('providerPayload');
    await expect(details.getRecordingDetail('recording:paranoid-android')).resolves.toEqual(
      expect.objectContaining({
        kind: 'recording',
        albumContexts: [expect.objectContaining({ id: 'album:ok-computer' })],
      }),
    );
    await expect(details.getArtistDetail('artist:not-found')).resolves.toBeNull();
  });

  it('ingests a normalized provider graph idempotently and makes it searchable', async () => {
    const importedArtist: ExternalArtistCandidate = {
      providerIdentity: createProviderIdentity({
        provider: 'musicbrainz',
        externalObjectType: 'artist',
        externalId: '11111111-1111-4111-8111-111111111111',
      }),
      provenanceSourceRef: providerMappingSourceRef(
        'musicbrainz:artist:11111111-1111-4111-8111-111111111111',
      ),
      canonicalName: 'Imported Test Artist',
    };
    const importedRecording: ExternalRecordingCandidate = {
      providerIdentity: createProviderIdentity({
        provider: 'musicbrainz',
        externalObjectType: 'recording',
        externalId: '22222222-2222-4222-8222-222222222222',
      }),
      provenanceSourceRef: providerMappingSourceRef(
        'musicbrainz:recording:22222222-2222-4222-8222-222222222222',
      ),
      canonicalTitle: 'Imported Test Recording',
      artists: [importedArtist],
      durationMs: 180_000,
      durationSourceRef: providerMappingSourceRef(
        'musicbrainz:recording:22222222-2222-4222-8222-222222222222',
      ),
    };
    const importedAlbum: ExternalAlbumCandidate = {
      providerIdentity: createProviderIdentity({
        provider: 'musicbrainz',
        externalObjectType: 'release-group',
        externalId: '33333333-3333-4333-8333-333333333333',
      }),
      provenanceSourceRef: providerMappingSourceRef(
        'musicbrainz:release-group:33333333-3333-4333-8333-333333333333',
      ),
      canonicalTitle: 'Imported Test Album',
      artists: [importedArtist],
      recordings: [importedRecording],
      originalReleaseYear: 2024,
      originalReleaseYearSourceRef: providerMappingSourceRef(
        'musicbrainz:release-group:33333333-3333-4333-8333-333333333333',
      ),
    };
    const provider: ExternalCatalogProviderPort = {
      getArtist: vi.fn().mockResolvedValue(importedArtist),
      getRecording: vi.fn().mockResolvedValue(importedRecording),
      getAlbum: vi.fn().mockResolvedValue(importedAlbum),
    };
    const service = new CatalogIngestionService(
      provider,
      new PostgresCatalogQueryAdapter(database),
      new PostgresCatalogWriteAdapter(database),
      searchAdapter,
    );

    const first = await service.ingestAlbum(importedAlbum.providerIdentity.externalId);
    const second = await service.ingestAlbum(importedAlbum.providerIdentity.externalId);
    expect(second.id).toBe(first.id);
    expect(first.id).not.toBe(importedAlbum.providerIdentity.externalId);
    const rows = await sql<{ objects: string; mappings: string; relations: string }>`
      select
        (select count(*) from catalog.albums where canonical_title = 'Imported Test Album')::text
          as objects,
        (select count(*) from catalog.provider_mappings
          where provider = 'musicbrainz'
            and external_object_type = 'release-group'
            and external_id = '33333333-3333-4333-8333-333333333333')::text as mappings,
        (select count(*) from catalog.album_recordings where album_id = ${first.id})::text
          as relations
    `.execute(database);
    expect(rows.rows[0]).toEqual({ objects: '1', mappings: '1', relations: '1' });
    await expect(
      searchAdapter.search({ query: 'Imported Test Album', limit: 10, kind: 'album' }),
    ).resolves.toEqual([expect.objectContaining({ id: first.id, kind: 'album' })]);
  });

  it('rolls back the aggregate and mapping when a relation write fails', async () => {
    const write = new PostgresCatalogWriteAdapter(database);
    const identity = createProviderIdentity({
      provider: 'failure-test',
      externalObjectType: 'release-group',
      externalId: 'rollback-album',
    });
    await expect(
      write.acceptAlbum({
        candidate: {
          providerIdentity: identity,
          provenanceSourceRef: providerMappingSourceRef('failure-test:rollback-album'),
          canonicalTitle: 'Must Roll Back',
          artists: [],
          recordings: [],
        },
        artistIds: [],
        recordingIds: [recordingId('recording:not-present')],
      }),
    ).rejects.toThrow();
    const rows = await sql<{ albums: string; mappings: string }>`
      select
        (select count(*) from catalog.albums where canonical_title = 'Must Roll Back')::text
          as albums,
        (select count(*) from catalog.provider_mappings
          where provider = 'failure-test' and external_id = 'rollback-album')::text as mappings
    `.execute(database);
    expect(rows.rows[0]).toEqual({ albums: '0', mappings: '0' });
  });
});
