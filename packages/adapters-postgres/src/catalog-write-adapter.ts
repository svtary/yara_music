import { randomUUID } from 'node:crypto';

import type {
  AcceptAlbumInput,
  AcceptArtistInput,
  AcceptRecordingInput,
  CatalogWritePort,
} from '@yara/application';
import {
  albumId,
  createAlbum,
  createArtist,
  createRecording,
  artistId,
  providerMappingSourceRef,
  providerName,
  recordingId,
  type Album,
  type Artist,
  type CatalogEntityKind,
  type CatalogImage,
  type ProviderIdentity,
  type Recording,
} from '@yara/domain-catalog';
import { sql, type Kysely, type Transaction } from 'kysely';

import type { CatalogProviderMappingTable, YaraDatabase } from './database-schema.js';

type CanonicalResolution = {
  readonly id: string;
  readonly mappingExists: boolean;
};

function canonicalId(kind: CatalogEntityKind): string {
  return `${kind}:yara:${randomUUID()}`;
}

function mappingCanonicalId(row: CatalogProviderMappingTable): string | null {
  switch (row.canonical_kind) {
    case 'artist':
      return row.canonical_artist_id;
    case 'album':
      return row.canonical_album_id;
    case 'recording':
      return row.canonical_recording_id;
  }
}

function mappingColumns(kind: CatalogEntityKind, id: string) {
  return {
    canonical_artist_id: kind === 'artist' ? id : null,
    canonical_album_id: kind === 'album' ? id : null,
    canonical_recording_id: kind === 'recording' ? id : null,
  };
}

function assertSourcedValue(
  value: number | undefined,
  sourceRef: string | undefined,
  label: string,
): void {
  if ((value === undefined) !== (sourceRef === undefined)) {
    throw new Error(`${label} and its provenance source must be supplied together.`);
  }
}

function persistedImage(
  url: string | null | undefined,
  provider: string | null | undefined,
  sourceRef: string | null | undefined,
): CatalogImage | undefined {
  if (!url) return undefined;
  return {
    url,
    ...(provider && sourceRef
      ? { provider: providerName(provider), sourceRef: providerMappingSourceRef(sourceRef) }
      : {}),
  };
}

/** Catalog-owned mutation adapter. Every accepted aggregate and mapping commit atomically. */
export class PostgresCatalogWriteAdapter implements CatalogWritePort {
  public constructor(private readonly database: Kysely<YaraDatabase>) {}

  public acceptArtist({ candidate }: AcceptArtistInput): Promise<Artist> {
    return this.database.transaction().execute(async (transaction) => {
      const resolution = await this.resolveCanonicalId(
        transaction,
        candidate.providerIdentity,
        'artist',
      );
      const current = await transaction
        .selectFrom('catalog.artists')
        .selectAll()
        .where('id', '=', resolution.id)
        .executeTakeFirst();
      const image =
        candidate.image ??
        persistedImage(current?.image_url, current?.image_provider, current?.image_source_ref);
      const artist = createArtist({
        id: artistId(resolution.id),
        canonicalName: candidate.canonicalName,
        ...(image ? { image } : {}),
      });

      await transaction
        .insertInto('catalog.artists')
        .values({
          id: artist.id,
          canonical_name: artist.canonicalName,
          image_url: artist.image?.url ?? null,
          image_provider: artist.image?.provider ?? null,
          image_source_ref: artist.image?.sourceRef ?? null,
        })
        .onConflict((conflict) =>
          conflict.column('id').doUpdateSet({
            canonical_name: artist.canonicalName,
            image_url: artist.image?.url ?? null,
            image_provider: artist.image?.provider ?? null,
            image_source_ref: artist.image?.sourceRef ?? null,
          }),
        )
        .execute();
      await this.insertMappingIfNeeded(transaction, candidate, 'artist', resolution);
      return artist;
    });
  }

  public acceptRecording({ candidate, artistIds }: AcceptRecordingInput): Promise<Recording> {
    assertSourcedValue(candidate.durationMs, candidate.durationSourceRef, 'Recording duration');
    return this.database.transaction().execute(async (transaction) => {
      const resolution = await this.resolveCanonicalId(
        transaction,
        candidate.providerIdentity,
        'recording',
      );
      const current = await transaction
        .selectFrom('catalog.recordings')
        .selectAll()
        .where('id', '=', resolution.id)
        .executeTakeFirst();
      const durationMs = candidate.durationMs ?? current?.duration_ms ?? undefined;
      const durationSourceRef =
        candidate.durationSourceRef ?? current?.duration_source_ref ?? undefined;
      const recording = createRecording({
        id: recordingId(resolution.id),
        canonicalTitle: candidate.canonicalTitle,
        artistIds,
        ...(durationMs === undefined ? {} : { durationMs }),
      });

      await transaction
        .insertInto('catalog.recordings')
        .values({
          id: recording.id,
          canonical_title: recording.canonicalTitle,
          duration_ms: recording.durationMs ?? null,
          duration_source_ref: durationSourceRef ?? null,
        })
        .onConflict((conflict) =>
          conflict.column('id').doUpdateSet({
            canonical_title: recording.canonicalTitle,
            duration_ms: recording.durationMs ?? null,
            duration_source_ref: durationSourceRef ?? null,
          }),
        )
        .execute();
      await transaction
        .deleteFrom('catalog.recording_artists')
        .where('recording_id', '=', recording.id)
        .execute();
      if (recording.artistIds.length > 0) {
        await transaction
          .insertInto('catalog.recording_artists')
          .values(
            recording.artistIds.map((id, position) => ({
              recording_id: recording.id,
              artist_id: id,
              position,
            })),
          )
          .execute();
      }
      await this.insertMappingIfNeeded(transaction, candidate, 'recording', resolution);
      return recording;
    });
  }

  public acceptAlbum({ candidate, artistIds, recordingIds }: AcceptAlbumInput): Promise<Album> {
    assertSourcedValue(
      candidate.originalReleaseYear,
      candidate.originalReleaseYearSourceRef,
      'Album original release year',
    );
    return this.database.transaction().execute(async (transaction) => {
      const resolution = await this.resolveCanonicalId(
        transaction,
        candidate.providerIdentity,
        'album',
      );
      const current = await transaction
        .selectFrom('catalog.albums')
        .selectAll()
        .where('id', '=', resolution.id)
        .executeTakeFirst();
      const originalReleaseYear =
        candidate.originalReleaseYear ?? current?.original_release_year ?? undefined;
      const originalReleaseYearSourceRef =
        candidate.originalReleaseYearSourceRef ??
        current?.original_release_year_source_ref ??
        undefined;
      const cover =
        candidate.cover ??
        persistedImage(current?.cover_url, current?.cover_provider, current?.cover_source_ref);
      const album = createAlbum({
        id: albumId(resolution.id),
        canonicalTitle: candidate.canonicalTitle,
        artistIds,
        recordingIds,
        ...(originalReleaseYear === undefined ? {} : { originalReleaseYear }),
        ...(cover ? { cover } : {}),
      });

      await transaction
        .insertInto('catalog.albums')
        .values({
          id: album.id,
          canonical_title: album.canonicalTitle,
          original_release_year: album.originalReleaseYear ?? null,
          original_release_year_source_ref: originalReleaseYearSourceRef ?? null,
          cover_url: album.cover?.url ?? null,
          cover_provider: album.cover?.provider ?? null,
          cover_source_ref: album.cover?.sourceRef ?? null,
        })
        .onConflict((conflict) =>
          conflict.column('id').doUpdateSet({
            canonical_title: album.canonicalTitle,
            original_release_year: album.originalReleaseYear ?? null,
            original_release_year_source_ref: originalReleaseYearSourceRef ?? null,
            cover_url: album.cover?.url ?? null,
            cover_provider: album.cover?.provider ?? null,
            cover_source_ref: album.cover?.sourceRef ?? null,
          }),
        )
        .execute();
      await transaction
        .deleteFrom('catalog.album_artists')
        .where('album_id', '=', album.id)
        .execute();
      await transaction
        .deleteFrom('catalog.album_recordings')
        .where('album_id', '=', album.id)
        .execute();
      if (album.artistIds.length > 0) {
        await transaction
          .insertInto('catalog.album_artists')
          .values(
            album.artistIds.map((id, position) => ({
              album_id: album.id,
              artist_id: id,
              position,
            })),
          )
          .execute();
      }
      if (album.recordingIds.length > 0) {
        await transaction
          .insertInto('catalog.album_recordings')
          .values(
            album.recordingIds.map((id, position) => ({
              album_id: album.id,
              recording_id: id,
              position,
            })),
          )
          .execute();
      }
      await this.insertMappingIfNeeded(transaction, candidate, 'album', resolution);
      return album;
    });
  }

  private async resolveCanonicalId(
    transaction: Transaction<YaraDatabase>,
    identity: ProviderIdentity,
    expectedKind: CatalogEntityKind,
  ): Promise<CanonicalResolution> {
    const lockKey = `${identity.provider}:${identity.externalObjectType}:${identity.externalId}`;
    await sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`.execute(transaction);
    const mapping = await transaction
      .selectFrom('catalog.provider_mappings')
      .selectAll()
      .where('provider', '=', identity.provider)
      .where('external_object_type', '=', identity.externalObjectType)
      .where('external_id', '=', identity.externalId)
      .orderBy('mapping_version', 'desc')
      .executeTakeFirst();
    if (!mapping) return { id: canonicalId(expectedKind), mappingExists: false };
    if (mapping.canonical_kind !== expectedKind) {
      throw new Error(`Provider identity maps to ${mapping.canonical_kind}, not ${expectedKind}.`);
    }
    if (mapping.status !== 'resolved' && mapping.status !== 'merged') {
      throw new Error(`Provider mapping status ${mapping.status} cannot accept an observation.`);
    }
    const id = mappingCanonicalId(mapping);
    if (!id) throw new Error('Resolved provider mapping is missing its canonical reference.');
    return { id, mappingExists: true };
  }

  private async insertMappingIfNeeded(
    transaction: Transaction<YaraDatabase>,
    candidate: {
      readonly providerIdentity: ProviderIdentity;
      readonly provenanceSourceRef: string;
    },
    canonicalKind: CatalogEntityKind,
    resolution: CanonicalResolution,
  ): Promise<void> {
    if (resolution.mappingExists) return;
    await transaction
      .insertInto('catalog.provider_mappings')
      .values({
        provider: candidate.providerIdentity.provider,
        external_object_type: candidate.providerIdentity.externalObjectType,
        external_id: candidate.providerIdentity.externalId,
        canonical_kind: canonicalKind,
        mapping_version: 1,
        status: 'resolved',
        provenance_source_ref: candidate.provenanceSourceRef,
        ...mappingColumns(canonicalKind, resolution.id),
      })
      .execute();
  }
}
