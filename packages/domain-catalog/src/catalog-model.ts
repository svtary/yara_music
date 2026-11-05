import { CatalogInvariantError } from './catalog-error.js';
import {
  albumId,
  artistId,
  providerMappingSourceRef,
  providerName,
  recordingId,
  type AlbumId,
  type ArtistId,
  type ProviderMappingSourceRef,
  type ProviderName,
  type RecordingId,
} from './catalog-identity.js';

export interface CatalogImage {
  readonly url: string;
  readonly provider?: ProviderName;
  readonly sourceRef?: ProviderMappingSourceRef;
}

export interface Artist {
  readonly id: ArtistId;
  readonly canonicalName: string;
  readonly image?: CatalogImage;
}

/** Catalog-owned Album/Work identity. Physical Release/Edition/Pressing are excluded. */
export interface Album {
  readonly id: AlbumId;
  readonly canonicalTitle: string;
  readonly artistIds: readonly ArtistId[];
  readonly recordingIds: readonly RecordingId[];
  readonly originalReleaseYear?: number;
  readonly cover?: CatalogImage;
}

export interface Recording {
  readonly id: RecordingId;
  readonly canonicalTitle: string;
  readonly artistIds: readonly ArtistId[];
  readonly durationMs?: number;
}

function catalogText(value: string, label: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value ||
    /\p{Cc}/u.test(value)
  ) {
    throw new CatalogInvariantError(
      'INVALID_CATALOG_TEXT',
      `${label} must be non-empty, trimmed text without control characters.`,
    );
  }

  return value;
}

function uniqueIds<TId extends string>(
  values: readonly TId[],
  validate: (value: string) => TId,
  label: string,
): readonly TId[] {
  const seen = new Set<string>();
  const copy = values.map((value) => {
    const valid = validate(value);
    if (seen.has(valid)) {
      throw new CatalogInvariantError(
        'DUPLICATE_CATALOG_REFERENCE',
        `${label} cannot contain duplicate canonical IDs.`,
      );
    }
    seen.add(valid);
    return valid;
  });

  return Object.freeze(copy);
}

function image(value: CatalogImage | undefined, label: string): CatalogImage | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object') {
    throw new CatalogInvariantError(
      'INVALID_CATALOG_IMAGE',
      `${label} must be structured image metadata.`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value.url);
  } catch {
    throw new CatalogInvariantError('INVALID_CATALOG_IMAGE', `${label} URL must be valid.`);
  }
  if (
    (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
    value.url.trim() !== value.url
  ) {
    throw new CatalogInvariantError(
      'INVALID_CATALOG_IMAGE',
      `${label} URL must use HTTP(S) and contain no surrounding whitespace.`,
    );
  }

  const hasProvider = value.provider !== undefined;
  const hasSourceRef = value.sourceRef !== undefined;
  if (hasProvider !== hasSourceRef) {
    throw new CatalogInvariantError(
      'INVALID_CATALOG_IMAGE',
      `${label} provider and sourceRef must either both be present or both be absent.`,
    );
  }

  return Object.freeze({
    url: value.url,
    ...(hasProvider
      ? {
          provider: providerName(value.provider as string),
          sourceRef: providerMappingSourceRef(value.sourceRef as string),
        }
      : {}),
  });
}

function originalReleaseYear(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value < 1000 || value > 9999) {
    throw new CatalogInvariantError(
      'INVALID_CATALOG_METADATA',
      'Album original release year must be an integer between 1000 and 9999.',
    );
  }
  return value;
}

function durationMs(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new CatalogInvariantError(
      'INVALID_CATALOG_METADATA',
      'Recording durationMs must be a positive safe integer.',
    );
  }
  return value;
}

export function createArtist(input: Artist): Artist {
  const artistImage = image(input.image, 'Artist image');
  return Object.freeze({
    id: artistId(input.id),
    canonicalName: catalogText(input.canonicalName, 'Artist canonical name'),
    ...(artistImage ? { image: artistImage } : {}),
  });
}

export function createAlbum(input: Album): Album {
  const year = originalReleaseYear(input.originalReleaseYear);
  const cover = image(input.cover, 'Album cover');
  return Object.freeze({
    id: albumId(input.id),
    canonicalTitle: catalogText(input.canonicalTitle, 'Album canonical title'),
    artistIds: uniqueIds(input.artistIds, artistId, 'Album artist references'),
    recordingIds: uniqueIds(input.recordingIds, recordingId, 'Album recording references'),
    ...(year === undefined ? {} : { originalReleaseYear: year }),
    ...(cover ? { cover } : {}),
  });
}

export function createRecording(input: Recording): Recording {
  const duration = durationMs(input.durationMs);
  return Object.freeze({
    id: recordingId(input.id),
    canonicalTitle: catalogText(input.canonicalTitle, 'Recording canonical title'),
    artistIds: uniqueIds(input.artistIds, artistId, 'Recording artist references'),
    ...(duration === undefined ? {} : { durationMs: duration }),
  });
}
