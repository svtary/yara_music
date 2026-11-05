export type CatalogInvariantCode =
  | 'INVALID_CANONICAL_ID'
  | 'INVALID_PROVIDER_IDENTITY'
  | 'INVALID_CATALOG_TEXT'
  | 'INVALID_CATALOG_METADATA'
  | 'INVALID_CATALOG_IMAGE'
  | 'DUPLICATE_CATALOG_REFERENCE'
  | 'INVALID_MAPPING_VERSION'
  | 'INVALID_MAPPING_STATE'
  | 'MAPPING_TYPE_MISMATCH';

export class CatalogInvariantError extends Error {
  readonly code: CatalogInvariantCode;

  constructor(code: CatalogInvariantCode, message: string) {
    super(message);
    this.name = 'CatalogInvariantError';
    this.code = code;
  }
}
