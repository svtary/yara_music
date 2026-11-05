import { CatalogInvariantError } from './catalog-error.js';

declare const artistIdBrand: unique symbol;
declare const albumIdBrand: unique symbol;
declare const recordingIdBrand: unique symbol;
declare const providerNameBrand: unique symbol;
declare const providerExternalObjectTypeBrand: unique symbol;
declare const providerExternalIdBrand: unique symbol;
declare const providerMappingSourceRefBrand: unique symbol;

export type ArtistId = string & { readonly [artistIdBrand]: 'ArtistId' };
export type AlbumId = string & { readonly [albumIdBrand]: 'AlbumId' };
export type RecordingId = string & { readonly [recordingIdBrand]: 'RecordingId' };
export type ProviderName = string & { readonly [providerNameBrand]: 'ProviderName' };
export type ProviderExternalObjectType = string & {
  readonly [providerExternalObjectTypeBrand]: 'ProviderExternalObjectType';
};
export type ProviderExternalId = string & {
  readonly [providerExternalIdBrand]: 'ProviderExternalId';
};
export type ProviderMappingSourceRef = string & {
  readonly [providerMappingSourceRefBrand]: 'ProviderMappingSourceRef';
};

export type CatalogEntityKind = 'artist' | 'album' | 'recording';

export interface ArtistRef {
  readonly kind: 'artist';
  readonly id: ArtistId;
}

export interface AlbumRef {
  readonly kind: 'album';
  readonly id: AlbumId;
}

export interface RecordingRef {
  readonly kind: 'recording';
  readonly id: RecordingId;
}

export type CatalogEntityRef = ArtistRef | AlbumRef | RecordingRef;

export interface ProviderIdentity {
  readonly provider: ProviderName;
  readonly externalObjectType: ProviderExternalObjectType;
  readonly externalId: ProviderExternalId;
}

const maximumOpaqueIdentifierLength = 256;
const controlCharacters = /\p{Cc}/u;
const whitespace = /\s/u;

function parseOpaqueIdentifier(
  value: string,
  code: 'INVALID_CANONICAL_ID' | 'INVALID_PROVIDER_IDENTITY',
  label: string,
): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximumOpaqueIdentifierLength ||
    whitespace.test(value) ||
    controlCharacters.test(value)
  ) {
    throw new CatalogInvariantError(
      code,
      `${label} must be a non-empty opaque identifier without whitespace or control characters.`,
    );
  }

  return value;
}

export function artistId(value: string): ArtistId {
  return parseOpaqueIdentifier(value, 'INVALID_CANONICAL_ID', 'ArtistId') as ArtistId;
}

export function albumId(value: string): AlbumId {
  return parseOpaqueIdentifier(value, 'INVALID_CANONICAL_ID', 'AlbumId') as AlbumId;
}

export function recordingId(value: string): RecordingId {
  return parseOpaqueIdentifier(value, 'INVALID_CANONICAL_ID', 'RecordingId') as RecordingId;
}

export function providerName(value: string): ProviderName {
  return parseOpaqueIdentifier(value, 'INVALID_PROVIDER_IDENTITY', 'Provider name') as ProviderName;
}

export function providerExternalObjectType(value: string): ProviderExternalObjectType {
  return parseOpaqueIdentifier(
    value,
    'INVALID_PROVIDER_IDENTITY',
    'Provider external object type',
  ) as ProviderExternalObjectType;
}

export function providerExternalId(value: string): ProviderExternalId {
  return parseOpaqueIdentifier(
    value,
    'INVALID_PROVIDER_IDENTITY',
    'Provider external ID',
  ) as ProviderExternalId;
}

export function providerMappingSourceRef(value: string): ProviderMappingSourceRef {
  return parseOpaqueIdentifier(
    value,
    'INVALID_PROVIDER_IDENTITY',
    'Provider mapping source reference',
  ) as ProviderMappingSourceRef;
}

export function artistRef(id: ArtistId): ArtistRef {
  artistId(id);
  return Object.freeze({ kind: 'artist', id });
}

export function albumRef(id: AlbumId): AlbumRef {
  albumId(id);
  return Object.freeze({ kind: 'album', id });
}

export function recordingRef(id: RecordingId): RecordingRef {
  recordingId(id);
  return Object.freeze({ kind: 'recording', id });
}

export function createProviderIdentity(input: {
  readonly provider: string;
  readonly externalObjectType: string;
  readonly externalId: string;
}): ProviderIdentity {
  return Object.freeze({
    provider: providerName(input.provider),
    externalObjectType: providerExternalObjectType(input.externalObjectType),
    externalId: providerExternalId(input.externalId),
  });
}

export function assertCatalogEntityKind(value: unknown): asserts value is CatalogEntityKind {
  if (value !== 'artist' && value !== 'album' && value !== 'recording') {
    throw new CatalogInvariantError(
      'INVALID_PROVIDER_IDENTITY',
      'Catalog object type must be artist, album, or recording.',
    );
  }
}

export function assertProviderIdentity(value: unknown): asserts value is ProviderIdentity {
  if (!value || typeof value !== 'object') {
    throw new CatalogInvariantError(
      'INVALID_PROVIDER_IDENTITY',
      'Provider identity must be a structured value.',
    );
  }

  const candidate = value as Partial<ProviderIdentity>;
  providerName(candidate.provider as string);
  providerExternalObjectType(candidate.externalObjectType as string);
  providerExternalId(candidate.externalId as string);
}

export function assertCatalogEntityRef(value: unknown): asserts value is CatalogEntityRef {
  if (!value || typeof value !== 'object') {
    throw new CatalogInvariantError(
      'INVALID_CANONICAL_ID',
      'Canonical reference must be a structured value.',
    );
  }

  const candidate = value as Partial<CatalogEntityRef>;
  switch (candidate.kind) {
    case 'artist':
      artistId(candidate.id as string);
      return;
    case 'album':
      albumId(candidate.id as string);
      return;
    case 'recording':
      recordingId(candidate.id as string);
      return;
    default:
      throw new CatalogInvariantError(
        'INVALID_CANONICAL_ID',
        'Canonical reference kind must be artist, album, or recording.',
      );
  }
}
