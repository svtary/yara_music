import type { AlbumContextSummary, ArtistSummary } from '@yara/application';
import type { CatalogEntityKind, ProviderMappingStatus } from '@yara/domain-catalog';
import type { AIExecutionFailure, AIExecutionRunStatus, ModelUsage } from '@yara/ai-runtime';
import type { ConversationMessageRole, ConversationStatus } from '@yara/domain-yara-interaction';
import type { YaraRunEvent } from '@yara/application';

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

export interface CatalogSearchDocumentTable {
  kind: CatalogEntityKind;
  canonical_id: string;
  display_title: string;
  artists: readonly ArtistSummary[];
  original_release_year: number | null;
  image_url: string | null;
  image_provider: string | null;
  image_source_ref: string | null;
  duration_ms: number | null;
  album_context: AlbumContextSummary | null;
  searchable_text: string;
  projection_version: number;
  updated_at: Date;
}

export interface YaraConversationTable {
  id: string;
  owner_ref: string;
  status: ConversationStatus;
  created_at: Date;
  updated_at: Date;
}

export interface YaraConversationMessageTable {
  id: string;
  conversation_id: string;
  sequence: number;
  role: ConversationMessageRole;
  status: 'committed';
  content: string;
  created_at: Date;
}

export interface YaraAIExecutionRunTable {
  id: string;
  conversation_id: string;
  trigger_message_id: string;
  assistant_message_id: string | null;
  status: AIExecutionRunStatus;
  provider: string;
  model: string;
  provider_response_id: string | null;
  usage: ModelUsage | null;
  failure: AIExecutionFailure | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  updated_at: Date;
}

export interface YaraAIExecutionRunEventTable {
  run_id: string;
  sequence: number;
  event_type: YaraRunEvent['type'];
  payload: YaraRunEvent;
  created_at: Date;
}

export type YaraExecutionJobStatus =
  'queued' | 'claimed' | 'completed' | 'failed' | 'cancelled' | 'reconciliation_required';

export interface YaraAIExecutionJobTable {
  run_id: string;
  status: YaraExecutionJobStatus;
  attempt: number;
  lease_owner: string | null;
  lease_expires_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface YaraCommandIdempotencyTable {
  owner_ref: string;
  command_scope: 'start_conversation' | 'send_message';
  idempotency_key: string;
  semantic_fingerprint: string;
  conversation_id: string;
  message_id: string;
  run_id: string;
  created_at: Date;
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
  'search.catalog_documents': CatalogSearchDocumentTable;
  'yara_interaction.conversations': YaraConversationTable;
  'yara_interaction.conversation_messages': YaraConversationMessageTable;
  'yara_interaction.ai_execution_runs': YaraAIExecutionRunTable;
  'yara_interaction.ai_execution_run_events': YaraAIExecutionRunEventTable;
  'yara_interaction.ai_execution_jobs': YaraAIExecutionJobTable;
  'yara_interaction.command_idempotency': YaraCommandIdempotencyTable;
}
