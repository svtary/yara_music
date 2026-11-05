import type { CatalogEntityKind, ProviderMappingStatus } from '@yara/domain-catalog';

export interface CatalogArtistTable {
  id: string;
  canonical_name: string;
  image_url: string | null;
  image_provider: string | null;
  image_source_ref: string | null;
}

export interface CatalogAlbumTable {
  id: string;
  canonical_title: string;
  original_release_year: number | null;
  original_release_year_source_ref: string | null;
  cover_url: string | null;
  cover_provider: string | null;
  cover_source_ref: string | null;
}

export interface CatalogRecordingTable {
  id: string;
  canonical_title: string;
  duration_ms: number | null;
  duration_source_ref: string | null;
}

export interface CatalogAlbumArtistTable {
  album_id: string;
  artist_id: string;
  position: number;
}

export interface CatalogAlbumRecordingTable {
  album_id: string;
  recording_id: string;
  position: number;
}

export interface CatalogRecordingArtistTable {
  recording_id: string;
  artist_id: string;
  position: number;
}

export interface CatalogProviderMappingTable {
  provider: string;
  external_object_type: string;
  external_id: string;
  canonical_kind: CatalogEntityKind;
  mapping_version: number;
  status: ProviderMappingStatus;
  provenance_source_ref: string;
  canonical_artist_id: string | null;
  canonical_album_id: string | null;
  canonical_recording_id: string | null;
}

export interface CatalogProviderMappingCandidateTable {
  provider: string;
  external_object_type: string;
  external_id: string;
  canonical_kind: CatalogEntityKind;
  mapping_version: number;
  position: number;
  candidate_artist_id: string | null;
  candidate_album_id: string | null;
  candidate_recording_id: string | null;
}

/** Kysely row types remain adapter-local and never become Domain entities. */
export interface YaraDatabase {
  'catalog.artists': CatalogArtistTable;
  'catalog.albums': CatalogAlbumTable;
  'catalog.recordings': CatalogRecordingTable;
  'catalog.album_artists': CatalogAlbumArtistTable;
  'catalog.album_recordings': CatalogAlbumRecordingTable;
  'catalog.recording_artists': CatalogRecordingArtistTable;
  'catalog.provider_mappings': CatalogProviderMappingTable;
  'catalog.provider_mapping_candidates': CatalogProviderMappingCandidateTable;
}
