import type {
  Artist,
  ArtistId,
  ProviderIdentity,
  ProviderMapping,
  Recording,
  RecordingId,
  Album,
  AlbumId,
} from '@yara/domain-catalog';

/**
 * Minimal Stage 1 read boundary. It exposes canonical Catalog queries without
 * committing to PostgreSQL, Kysely, provider SDKs, or a repository shape.
 */
export interface CatalogQueryPort {
  getArtistById(id: ArtistId): Promise<Artist | null>;
  getAlbumById(id: AlbumId): Promise<Album | null>;
  getRecordingById(id: RecordingId): Promise<Recording | null>;
  resolveProviderIdentity(identity: ProviderIdentity): Promise<ProviderMapping | null>;
}
