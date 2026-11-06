import type { CatalogImage } from '@yara/domain-catalog';

export type CatalogSearchKind = 'artist' | 'album' | 'recording';

export interface ArtistSummary {
  readonly id: string;
  readonly name: string;
}

export interface AlbumContextSummary {
  readonly id: string;
  readonly title: string;
  readonly cover?: CatalogImage;
}

export interface ArtistSearchResult {
  readonly kind: 'artist';
  readonly id: string;
  readonly name: string;
  readonly image?: CatalogImage;
}

export interface AlbumSearchResult {
  readonly kind: 'album';
  readonly id: string;
  readonly title: string;
  readonly artists: readonly ArtistSummary[];
  readonly originalReleaseYear?: number;
  readonly cover?: CatalogImage;
}

export interface RecordingSearchResult {
  readonly kind: 'recording';
  readonly id: string;
  readonly title: string;
  readonly artists: readonly ArtistSummary[];
  readonly durationMs?: number;
  readonly albumContext?: AlbumContextSummary;
  readonly artwork?: CatalogImage;
}

export type CatalogSearchResult = ArtistSearchResult | AlbumSearchResult | RecordingSearchResult;

export interface CatalogSearchRequest {
  readonly query: string;
  readonly limit: number;
  readonly kind?: CatalogSearchKind;
}

export interface CatalogSearchQueryPort {
  search(request: CatalogSearchRequest): Promise<readonly CatalogSearchResult[]>;
}

export interface CatalogSearchProjectionPort {
  rebuild(): Promise<void>;
}

export class CatalogSearchInputError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CatalogSearchInputError';
  }
}

export interface RawCatalogSearchRequest {
  readonly query: string;
  readonly limit?: number;
  readonly kind?: string;
}

export class SearchCatalogQuery {
  public constructor(private readonly port: CatalogSearchQueryPort) {}

  public async execute(input: RawCatalogSearchRequest): Promise<readonly CatalogSearchResult[]> {
    const query = input.query.trim();
    if (query.length === 0) throw new CatalogSearchInputError('Search query must not be empty.');
    if (query.length > 120) {
      throw new CatalogSearchInputError('Search query must be at most 120 characters.');
    }
    const limit = input.limit ?? 20;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
      throw new CatalogSearchInputError('Search limit must be an integer between 1 and 50.');
    }
    const kind = input.kind;
    if (kind !== undefined && kind !== 'artist' && kind !== 'album' && kind !== 'recording') {
      throw new CatalogSearchInputError('Search kind must be artist, album, or recording.');
    }

    return this.port.search({
      query,
      limit,
      ...(kind ? { kind } : {}),
    });
  }
}
