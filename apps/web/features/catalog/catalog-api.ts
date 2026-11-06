import type {
  AlbumDetailContract,
  AlbumSearchResultContract,
  ArtistDetailContract,
  ArtistSearchResultContract,
  CatalogImageContract,
  CatalogSearchResultContract,
  RecordingDetailContract,
  RecordingSearchResultContract,
} from '@yara/contracts';

export class CatalogApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'CatalogApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isImage(value: unknown): value is CatalogImageContract {
  return (
    isRecord(value) &&
    isString(value['url']) &&
    (value['provider'] === undefined || typeof value['provider'] === 'string') &&
    (value['sourceRef'] === undefined || typeof value['sourceRef'] === 'string')
  );
}

function isOptionalImage(value: unknown): value is CatalogImageContract | undefined {
  return value === undefined || isImage(value);
}

function isArtistSummary(value: unknown): value is { readonly id: string; readonly name: string } {
  return isRecord(value) && isString(value['id']) && isString(value['name']);
}

function isArtistSearchResult(value: unknown): value is ArtistSearchResultContract {
  return (
    isRecord(value) &&
    value['kind'] === 'artist' &&
    isString(value['id']) &&
    isString(value['name']) &&
    isOptionalImage(value['image'])
  );
}

function isAlbumSearchResult(value: unknown): value is AlbumSearchResultContract {
  return (
    isRecord(value) &&
    value['kind'] === 'album' &&
    isString(value['id']) &&
    isString(value['title']) &&
    Array.isArray(value['artists']) &&
    value['artists'].every(isArtistSummary) &&
    isOptionalNumber(value['originalReleaseYear']) &&
    isOptionalImage(value['cover'])
  );
}

function isAlbumContext(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value['id']) &&
    isString(value['title']) &&
    isOptionalImage(value['cover'])
  );
}

function isRecordingSearchResult(value: unknown): value is RecordingSearchResultContract {
  return (
    isRecord(value) &&
    value['kind'] === 'recording' &&
    isString(value['id']) &&
    isString(value['title']) &&
    Array.isArray(value['artists']) &&
    value['artists'].every(isArtistSummary) &&
    isOptionalNumber(value['durationMs']) &&
    (value['albumContext'] === undefined || isAlbumContext(value['albumContext'])) &&
    isOptionalImage(value['artwork'])
  );
}

export function isCatalogSearchResponse(
  value: unknown,
): value is readonly CatalogSearchResultContract[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isArtistSearchResult(item) || isAlbumSearchResult(item) || isRecordingSearchResult(item),
    )
  );
}

export function isArtistDetail(value: unknown): value is ArtistDetailContract {
  return (
    isRecord(value) &&
    value['kind'] === 'artist' &&
    isString(value['id']) &&
    isString(value['canonicalName']) &&
    isOptionalImage(value['image'])
  );
}

function isRecordingSummary(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value['id']) &&
    isString(value['title']) &&
    Array.isArray(value['artists']) &&
    value['artists'].every(isArtistSummary) &&
    isOptionalNumber(value['durationMs']) &&
    typeof value['position'] === 'number' &&
    Number.isInteger(value['position'])
  );
}

export function isAlbumDetail(value: unknown): value is AlbumDetailContract {
  return (
    isRecord(value) &&
    value['kind'] === 'album' &&
    isString(value['id']) &&
    isString(value['title']) &&
    Array.isArray(value['artists']) &&
    value['artists'].every(isArtistSummary) &&
    isOptionalNumber(value['originalReleaseYear']) &&
    isOptionalImage(value['cover']) &&
    typeof value['trackCount'] === 'number' &&
    Number.isInteger(value['trackCount']) &&
    Array.isArray(value['recordings']) &&
    value['recordings'].every(isRecordingSummary)
  );
}

export function isRecordingDetail(value: unknown): value is RecordingDetailContract {
  return (
    isRecord(value) &&
    value['kind'] === 'recording' &&
    isString(value['id']) &&
    isString(value['title']) &&
    Array.isArray(value['artists']) &&
    value['artists'].every(isArtistSummary) &&
    isOptionalNumber(value['durationMs']) &&
    Array.isArray(value['albumContexts']) &&
    value['albumContexts'].every(isAlbumContext)
  );
}

async function readCatalogResponse<T>(
  url: string,
  signal: AbortSignal | undefined,
  validate: (value: unknown) => value is T,
): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    throw new CatalogApiError(
      response.status === 404
        ? 'The music object was not found.'
        : 'Yara could not load this music.',
      response.status,
    );
  }

  const body: unknown = await response.json();
  if (!validate(body)) throw new CatalogApiError('Yara received an unexpected response.', 502);
  return body;
}

export function searchCatalog(query: string, signal?: AbortSignal) {
  return readCatalogResponse(
    `/api/catalog/search?q=${encodeURIComponent(query)}`,
    signal,
    isCatalogSearchResponse,
  );
}

export function readArtistDetail(id: string, signal?: AbortSignal) {
  return readCatalogResponse(
    `/api/catalog/artists/${encodeURIComponent(id)}`,
    signal,
    isArtistDetail,
  );
}

export function readAlbumDetail(id: string, signal?: AbortSignal) {
  return readCatalogResponse(
    `/api/catalog/albums/${encodeURIComponent(id)}`,
    signal,
    isAlbumDetail,
  );
}

export function readRecordingDetail(id: string, signal?: AbortSignal) {
  return readCatalogResponse(
    `/api/catalog/recordings/${encodeURIComponent(id)}`,
    signal,
    isRecordingDetail,
  );
}
