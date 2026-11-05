import type {
  AlbumContextSummary,
  ArtistSummary,
  CatalogSearchProjectionPort,
  CatalogSearchQueryPort,
  CatalogSearchRequest,
  CatalogSearchResult,
} from '@yara/application';
import { providerMappingSourceRef, providerName, type CatalogImage } from '@yara/domain-catalog';
import { sql, type Kysely } from 'kysely';

import type { YaraDatabase } from './database-schema.js';

interface SearchRow {
  readonly kind: 'artist' | 'album' | 'recording';
  readonly canonical_id: string;
  readonly display_title: string;
  readonly artists: unknown;
  readonly original_release_year: number | null;
  readonly image_url: string | null;
  readonly image_provider: string | null;
  readonly image_source_ref: string | null;
  readonly duration_ms: number | null;
  readonly album_context: unknown;
}

function image(row: SearchRow): CatalogImage | undefined {
  if (!row.image_url) return undefined;
  return {
    url: row.image_url,
    ...(row.image_provider && row.image_source_ref
      ? {
          provider: providerName(row.image_provider),
          sourceRef: providerMappingSourceRef(row.image_source_ref),
        }
      : {}),
  };
}

function artists(value: unknown): readonly ArtistSummary[] {
  if (!Array.isArray(value)) throw new Error('Search projection contains malformed artists.');
  return value.map((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof (item as { id?: unknown }).id !== 'string' ||
      typeof (item as { name?: unknown }).name !== 'string'
    ) {
      throw new Error('Search projection contains a malformed artist summary.');
    }
    return { id: (item as { id: string }).id, name: (item as { name: string }).name };
  });
}

function albumContext(value: unknown): AlbumContextSummary | undefined {
  if (value === null || value === undefined) return undefined;
  if (
    typeof value !== 'object' ||
    typeof (value as { id?: unknown }).id !== 'string' ||
    typeof (value as { title?: unknown }).title !== 'string'
  ) {
    throw new Error('Search projection contains a malformed album context.');
  }
  const rawCover = (value as { cover?: unknown }).cover;
  let cover: CatalogImage | undefined;
  if (rawCover !== undefined) {
    if (
      !rawCover ||
      typeof rawCover !== 'object' ||
      typeof (rawCover as { url?: unknown }).url !== 'string'
    ) {
      throw new Error('Search projection contains malformed album artwork.');
    }
    const rawProvider = (rawCover as { provider?: unknown }).provider;
    const rawSourceRef = (rawCover as { sourceRef?: unknown }).sourceRef;
    cover = {
      url: (rawCover as { url: string }).url,
      ...(typeof rawProvider === 'string' && typeof rawSourceRef === 'string'
        ? {
            provider: providerName(rawProvider),
            sourceRef: providerMappingSourceRef(rawSourceRef),
          }
        : {}),
    };
  }
  return {
    id: (value as { id: string }).id,
    title: (value as { title: string }).title,
    ...(cover ? { cover } : {}),
  };
}

/** Rebuildable Search-owned projection and deterministic lexical query adapter. */
export class PostgresCatalogSearchAdapter
  implements CatalogSearchQueryPort, CatalogSearchProjectionPort
{
  public constructor(private readonly database: Kysely<YaraDatabase>) {}

  public async rebuild(): Promise<void> {
    await this.database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('search.catalog_documents').execute();
      await sql`
        insert into search.catalog_documents (
          kind, canonical_id, display_title, artists, original_release_year,
          image_url, image_provider, image_source_ref, duration_ms,
          album_context, searchable_text, projection_version
        )
        select
          'artist', artist.id, artist.canonical_name, '[]'::jsonb, null,
          artist.image_url, artist.image_provider, artist.image_source_ref, null,
          null, artist.canonical_name, 1
        from catalog.artists artist
        order by artist.id
      `.execute(transaction);
      await sql`
        insert into search.catalog_documents (
          kind, canonical_id, display_title, artists, original_release_year,
          image_url, image_provider, image_source_ref, duration_ms,
          album_context, searchable_text, projection_version
        )
        select
          'album', album.id, album.canonical_title,
          coalesce(artist_data.artists, '[]'::jsonb), album.original_release_year,
          album.cover_url, album.cover_provider, album.cover_source_ref, null,
          null,
          concat_ws(' ', album.canonical_title, artist_data.artist_names), 1
        from catalog.albums album
        left join lateral (
          select
            jsonb_agg(
              jsonb_build_object('id', artist.id, 'name', artist.canonical_name)
              order by relation.position
            ) as artists,
            string_agg(artist.canonical_name, ' ' order by relation.position) as artist_names
          from catalog.album_artists relation
          join catalog.artists artist on artist.id = relation.artist_id
          where relation.album_id = album.id
        ) artist_data on true
        order by album.id
      `.execute(transaction);
      await sql`
        insert into search.catalog_documents (
          kind, canonical_id, display_title, artists, original_release_year,
          image_url, image_provider, image_source_ref, duration_ms,
          album_context, searchable_text, projection_version
        )
        select
          'recording', recording.id, recording.canonical_title,
          coalesce(artist_data.artists, '[]'::jsonb), null,
          album_data.cover_url, album_data.cover_provider, album_data.cover_source_ref,
          recording.duration_ms, album_data.album_context,
          concat_ws(
            ' ', recording.canonical_title, artist_data.artist_names, album_data.album_names
          ), 1
        from catalog.recordings recording
        left join lateral (
          select
            jsonb_agg(
              jsonb_build_object('id', artist.id, 'name', artist.canonical_name)
              order by relation.position
            ) as artists,
            string_agg(artist.canonical_name, ' ' order by relation.position) as artist_names
          from catalog.recording_artists relation
          join catalog.artists artist on artist.id = relation.artist_id
          where relation.recording_id = recording.id
        ) artist_data on true
        left join lateral (
          select
            first_album.cover_url,
            first_album.cover_provider,
            first_album.cover_source_ref,
            jsonb_strip_nulls(jsonb_build_object(
              'id', first_album.id,
              'title', first_album.canonical_title,
              'cover', case when first_album.cover_url is null then null else
                jsonb_strip_nulls(jsonb_build_object(
                  'url', first_album.cover_url,
                  'provider', first_album.cover_provider,
                  'sourceRef', first_album.cover_source_ref
                ))
              end
            )) as album_context,
            all_albums.album_names
          from (
            select album.*
            from catalog.album_recordings relation
            join catalog.albums album on album.id = relation.album_id
            where relation.recording_id = recording.id
            order by album.canonical_title, album.id
            limit 1
          ) first_album
          cross join lateral (
            select string_agg(album.canonical_title, ' ' order by album.canonical_title, album.id)
              as album_names
            from catalog.album_recordings relation
            join catalog.albums album on album.id = relation.album_id
            where relation.recording_id = recording.id
          ) all_albums
        ) album_data on true
        order by recording.id
      `.execute(transaction);
    });
  }

  public async search(request: CatalogSearchRequest): Promise<readonly CatalogSearchResult[]> {
    const kind = request.kind ?? null;
    const result = await sql<SearchRow>`
      with query_input as (
        select
          lower(${request.query}) as normalized,
          plainto_tsquery('simple', ${request.query}) as tsquery
      )
      select
        document.kind,
        document.canonical_id,
        document.display_title,
        document.artists,
        document.original_release_year,
        document.image_url,
        document.image_provider,
        document.image_source_ref,
        document.duration_ms,
        document.album_context
      from search.catalog_documents document
      cross join query_input query
      where (${kind}::text is null or document.kind = ${kind})
        and (
          lower(document.display_title) = query.normalized
          or lower(document.display_title) like query.normalized || '%'
          or document.search_vector @@ query.tsquery
          or similarity(lower(document.display_title), query.normalized) >= 0.2
        )
      order by
        (lower(document.display_title) = query.normalized) desc,
        (lower(document.display_title) like query.normalized || '%') desc,
        (document.search_vector @@ query.tsquery) desc,
        ts_rank_cd(document.search_vector, query.tsquery) desc,
        similarity(lower(document.display_title), query.normalized) desc,
        case document.kind when 'artist' then 1 when 'album' then 2 else 3 end,
        lower(document.display_title),
        document.canonical_id
      limit ${request.limit}
    `.execute(this.database);
    return result.rows.map((row) => this.toResult(row));
  }

  private toResult(row: SearchRow): CatalogSearchResult {
    const projectedArtists = artists(row.artists);
    const projectedImage = image(row);
    switch (row.kind) {
      case 'artist':
        return {
          kind: 'artist',
          id: row.canonical_id,
          name: row.display_title,
          ...(projectedImage ? { image: projectedImage } : {}),
        };
      case 'album':
        return {
          kind: 'album',
          id: row.canonical_id,
          title: row.display_title,
          artists: projectedArtists,
          ...(row.original_release_year === null
            ? {}
            : { originalReleaseYear: row.original_release_year }),
          ...(projectedImage ? { cover: projectedImage } : {}),
        };
      case 'recording': {
        const context = albumContext(row.album_context);
        return {
          kind: 'recording',
          id: row.canonical_id,
          title: row.display_title,
          artists: projectedArtists,
          ...(row.duration_ms === null ? {} : { durationMs: row.duration_ms }),
          ...(context ? { albumContext: context } : {}),
          ...(projectedImage ? { artwork: projectedImage } : {}),
        };
      }
    }
  }
}
