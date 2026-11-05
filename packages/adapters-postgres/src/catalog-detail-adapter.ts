import type {
  AlbumContextSummary,
  AlbumDetail,
  ArtistDetail,
  ArtistSummary,
  CatalogDetailQueryPort,
  RecordingDetail,
  RecordingDetailSummary,
} from '@yara/application';
import { providerMappingSourceRef, providerName, type CatalogImage } from '@yara/domain-catalog';
import type { Kysely } from 'kysely';

import type { YaraDatabase } from './database-schema.js';

function image(
  url: string | null,
  provider: string | null,
  sourceRef: string | null,
): CatalogImage | undefined {
  if (!url) return undefined;
  return {
    url,
    ...(provider && sourceRef
      ? { provider: providerName(provider), sourceRef: providerMappingSourceRef(sourceRef) }
      : {}),
  };
}

/** Catalog detail read models are assembled here; persistence rows never cross the adapter. */
export class PostgresCatalogDetailAdapter implements CatalogDetailQueryPort {
  public constructor(private readonly database: Kysely<YaraDatabase>) {}

  public async getArtistDetail(id: string): Promise<ArtistDetail | null> {
    const row = await this.database
      .selectFrom('catalog.artists')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) return null;
    const artistImage = image(row.image_url, row.image_provider, row.image_source_ref);
    return {
      kind: 'artist',
      id: row.id,
      canonicalName: row.canonical_name,
      ...(artistImage ? { image: artistImage } : {}),
    };
  }

  public async getAlbumDetail(id: string): Promise<AlbumDetail | null> {
    return this.database
      .transaction()
      .setIsolationLevel('repeatable read')
      .execute(async (transaction) => {
        const row = await transaction
          .selectFrom('catalog.albums')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst();
        if (!row) return null;

        const artists: ArtistSummary[] = await transaction
          .selectFrom('catalog.album_artists as relation')
          .innerJoin('catalog.artists as artist', 'artist.id', 'relation.artist_id')
          .select(['artist.id as id', 'artist.canonical_name as name'])
          .where('relation.album_id', '=', id)
          .orderBy('relation.position')
          .execute();
        const recordingRows = await transaction
          .selectFrom('catalog.album_recordings as relation')
          .innerJoin('catalog.recordings as recording', 'recording.id', 'relation.recording_id')
          .select([
            'recording.id as id',
            'recording.canonical_title as title',
            'recording.duration_ms as duration_ms',
            'relation.position as position',
          ])
          .where('relation.album_id', '=', id)
          .orderBy('relation.position')
          .execute();
        const recordings: RecordingDetailSummary[] = [];
        for (const recording of recordingRows) {
          const recordingArtists: ArtistSummary[] = await transaction
            .selectFrom('catalog.recording_artists as relation')
            .innerJoin('catalog.artists as artist', 'artist.id', 'relation.artist_id')
            .select(['artist.id as id', 'artist.canonical_name as name'])
            .where('relation.recording_id', '=', recording.id)
            .orderBy('relation.position')
            .execute();
          recordings.push({
            id: recording.id,
            title: recording.title,
            artists: recordingArtists,
            position: recording.position,
            ...(recording.duration_ms === null ? {} : { durationMs: recording.duration_ms }),
          });
        }

        const cover = image(row.cover_url, row.cover_provider, row.cover_source_ref);
        return {
          kind: 'album',
          id: row.id,
          title: row.canonical_title,
          artists,
          trackCount: recordings.length,
          recordings,
          ...(row.original_release_year === null
            ? {}
            : { originalReleaseYear: row.original_release_year }),
          ...(cover ? { cover } : {}),
        };
      });
  }

  public async getRecordingDetail(id: string): Promise<RecordingDetail | null> {
    return this.database
      .transaction()
      .setIsolationLevel('repeatable read')
      .execute(async (transaction) => {
        const row = await transaction
          .selectFrom('catalog.recordings')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst();
        if (!row) return null;
        const artists: ArtistSummary[] = await transaction
          .selectFrom('catalog.recording_artists as relation')
          .innerJoin('catalog.artists as artist', 'artist.id', 'relation.artist_id')
          .select(['artist.id as id', 'artist.canonical_name as name'])
          .where('relation.recording_id', '=', id)
          .orderBy('relation.position')
          .execute();
        const albumRows = await transaction
          .selectFrom('catalog.album_recordings as relation')
          .innerJoin('catalog.albums as album', 'album.id', 'relation.album_id')
          .select([
            'album.id as id',
            'album.canonical_title as title',
            'album.cover_url as cover_url',
            'album.cover_provider as cover_provider',
            'album.cover_source_ref as cover_source_ref',
          ])
          .where('relation.recording_id', '=', id)
          .orderBy('album.canonical_title')
          .orderBy('album.id')
          .execute();
        const albumContexts: AlbumContextSummary[] = albumRows.map((album) => {
          const cover = image(album.cover_url, album.cover_provider, album.cover_source_ref);
          return {
            id: album.id,
            title: album.title,
            ...(cover ? { cover } : {}),
          };
        });
        return {
          kind: 'recording',
          id: row.id,
          title: row.canonical_title,
          artists,
          albumContexts,
          ...(row.duration_ms === null ? {} : { durationMs: row.duration_ms }),
        };
      });
  }
}
