import type { CatalogQueryPort } from '@yara/application';
import {
  albumId,
  albumRef,
  artistId,
  artistRef,
  createAlbum,
  createArtist,
  createProviderMapping,
  createRecording,
  providerMappingSourceRef,
  providerName,
  recordingId,
  recordingRef,
  type Album,
  type AlbumId,
  type Artist,
  type ArtistId,
  type CatalogEntityKind,
  type CatalogEntityRef,
  type CatalogImage,
  type ProviderIdentity,
  type ProviderMapping,
  type Recording,
  type RecordingId,
} from '@yara/domain-catalog';
import type { Kysely } from 'kysely';

import type {
  CatalogProviderMappingCandidateTable,
  CatalogProviderMappingTable,
  YaraDatabase,
} from './database-schema.js';

function catalogImage(
  url: string | null,
  provider: string | null,
  sourceRef: string | null,
): CatalogImage | undefined {
  if (url === null) return undefined;
  return {
    url,
    ...(provider !== null && sourceRef !== null
      ? { provider: providerName(provider), sourceRef: providerMappingSourceRef(sourceRef) }
      : {}),
  };
}

function canonicalReference(row: CatalogProviderMappingTable): CatalogEntityRef {
  switch (row.canonical_kind) {
    case 'artist':
      if (!row.canonical_artist_id) throw new Error('Persisted artist mapping is missing its ref');
      return artistRef(artistId(row.canonical_artist_id));
    case 'album':
      if (!row.canonical_album_id) throw new Error('Persisted album mapping is missing its ref');
      return albumRef(albumId(row.canonical_album_id));
    case 'recording':
      if (!row.canonical_recording_id)
        throw new Error('Persisted recording mapping is missing its ref');
      return recordingRef(recordingId(row.canonical_recording_id));
  }
}

function candidateReference(
  canonicalKind: CatalogEntityKind,
  row: CatalogProviderMappingCandidateTable,
): CatalogEntityRef {
  switch (canonicalKind) {
    case 'artist':
      if (!row.candidate_artist_id)
        throw new Error('Persisted artist candidate is missing its ref');
      return artistRef(artistId(row.candidate_artist_id));
    case 'album':
      if (!row.candidate_album_id) throw new Error('Persisted album candidate is missing its ref');
      return albumRef(albumId(row.candidate_album_id));
    case 'recording':
      if (!row.candidate_recording_id)
        throw new Error('Persisted recording candidate is missing its ref');
      return recordingRef(recordingId(row.candidate_recording_id));
  }
}

/** Catalog-owned read adapter. Kysely rows are revalidated through Domain factories. */
export class PostgresCatalogQueryAdapter implements CatalogQueryPort {
  constructor(private readonly database: Kysely<YaraDatabase>) {}

  async getArtistById(id: ArtistId): Promise<Artist | null> {
    const row = await this.database
      .selectFrom('catalog.artists')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) return null;
    const image = catalogImage(row.image_url, row.image_provider, row.image_source_ref);
    return createArtist({
      id: artistId(row.id),
      canonicalName: row.canonical_name,
      ...(image ? { image } : {}),
    });
  }

  async getAlbumById(id: AlbumId): Promise<Album | null> {
    return this.database
      .transaction()
      .setIsolationLevel('repeatable read')
      .execute(async (trx) => {
        const row = await trx
          .selectFrom('catalog.albums')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst();
        if (!row) return null;

        const [artists, recordings] = await Promise.all([
          trx
            .selectFrom('catalog.album_artists')
            .select('artist_id')
            .where('album_id', '=', id)
            .orderBy('position')
            .execute(),
          trx
            .selectFrom('catalog.album_recordings')
            .select('recording_id')
            .where('album_id', '=', id)
            .orderBy('position')
            .execute(),
        ]);

        const cover = catalogImage(row.cover_url, row.cover_provider, row.cover_source_ref);
        return createAlbum({
          id: albumId(row.id),
          canonicalTitle: row.canonical_title,
          artistIds: artists.map(({ artist_id }) => artistId(artist_id)),
          recordingIds: recordings.map(({ recording_id }) => recordingId(recording_id)),
          ...(row.original_release_year === null
            ? {}
            : { originalReleaseYear: row.original_release_year }),
          ...(cover ? { cover } : {}),
        });
      });
  }

  async getRecordingById(id: RecordingId): Promise<Recording | null> {
    return this.database
      .transaction()
      .setIsolationLevel('repeatable read')
      .execute(async (trx) => {
        const row = await trx
          .selectFrom('catalog.recordings')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst();
        if (!row) return null;

        const artists = await trx
          .selectFrom('catalog.recording_artists')
          .select('artist_id')
          .where('recording_id', '=', id)
          .orderBy('position')
          .execute();
        return createRecording({
          id: recordingId(row.id),
          canonicalTitle: row.canonical_title,
          artistIds: artists.map(({ artist_id }) => artistId(artist_id)),
          ...(row.duration_ms === null ? {} : { durationMs: row.duration_ms }),
        });
      });
  }

  async resolveProviderIdentity(identity: ProviderIdentity): Promise<ProviderMapping | null> {
    const row = await this.database
      .selectFrom('catalog.provider_mappings')
      .selectAll()
      .where('provider', '=', identity.provider)
      .where('external_object_type', '=', identity.externalObjectType)
      .where('external_id', '=', identity.externalId)
      .orderBy('mapping_version', 'desc')
      .executeTakeFirst();
    if (!row) return null;

    const base = {
      providerIdentity: identity,
      canonicalKind: row.canonical_kind,
      mappingVersion: row.mapping_version,
      provenance: { sourceRef: providerMappingSourceRef(row.provenance_source_ref) },
    } as const;

    switch (row.status) {
      case 'resolved':
      case 'superseded':
      case 'merged':
        return createProviderMapping({
          ...base,
          status: row.status,
          canonicalRef: canonicalReference(row),
        });
      case 'unresolved':
        return createProviderMapping({ ...base, status: row.status });
      case 'ambiguous':
      case 'split': {
        const candidateRefs = await this.loadCandidates(row);
        return createProviderMapping({ ...base, status: row.status, candidateRefs });
      }
      case 'correction_pending': {
        const candidateRefs = await this.loadCandidates(row);
        return createProviderMapping({
          ...base,
          status: row.status,
          canonicalRef: canonicalReference(row),
          candidateRefs,
        });
      }
    }
  }

  private async loadCandidates(
    mapping: CatalogProviderMappingTable,
  ): Promise<readonly CatalogEntityRef[]> {
    const rows = await this.database
      .selectFrom('catalog.provider_mapping_candidates')
      .selectAll()
      .where('provider', '=', mapping.provider)
      .where('external_object_type', '=', mapping.external_object_type)
      .where('external_id', '=', mapping.external_id)
      .where('mapping_version', '=', mapping.mapping_version)
      .orderBy('position')
      .execute();
    return rows.map((row) => candidateReference(mapping.canonical_kind, row));
  }
}
