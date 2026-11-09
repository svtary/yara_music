import { sql, type Kysely } from 'kysely';
import { Migrator, type Migration } from 'kysely/migration';

import type { YaraDatabase } from './database-schema.js';

const stageZeroExtensionsMigration: Migration = {
  async up(database): Promise<void> {
    await sql`create extension if not exists pg_trgm`.execute(database);
    await sql`create extension if not exists vector`.execute(database);
  },
  async down(database): Promise<void> {
    // Extensions may be shared by future owner projections. Stage 0 never drops them automatically.
    await sql`select 1`.execute(database);
  },
};

const catalogFoundationMigration: Migration = {
  async up(database): Promise<void> {
    await sql`
      create schema if not exists catalog;

      create table catalog.artists (
        id text primary key,
        canonical_name text not null,
        constraint catalog_artists_id_valid check (
          length(id) between 1 and 256 and id !~ '[[:space:][:cntrl:]]'
        ),
        constraint catalog_artists_name_valid check (
          length(canonical_name) > 0
          and canonical_name = btrim(canonical_name)
          and canonical_name !~ '[[:cntrl:]]'
        )
      );

      create table catalog.releases (
        id text primary key,
        canonical_title text not null,
        constraint catalog_releases_id_valid check (
          length(id) between 1 and 256 and id !~ '[[:space:][:cntrl:]]'
        ),
        constraint catalog_releases_title_valid check (
          length(canonical_title) > 0
          and canonical_title = btrim(canonical_title)
          and canonical_title !~ '[[:cntrl:]]'
        )
      );

      create table catalog.recordings (
        id text primary key,
        canonical_title text not null,
        constraint catalog_recordings_id_valid check (
          length(id) between 1 and 256 and id !~ '[[:space:][:cntrl:]]'
        ),
        constraint catalog_recordings_title_valid check (
          length(canonical_title) > 0
          and canonical_title = btrim(canonical_title)
          and canonical_title !~ '[[:cntrl:]]'
        )
      );

      create table catalog.release_artists (
        release_id text not null references catalog.releases(id) on delete restrict,
        artist_id text not null references catalog.artists(id) on delete restrict,
        position integer not null check (position >= 0),
        primary key (release_id, artist_id),
        unique (release_id, position)
      );

      create table catalog.release_recordings (
        release_id text not null references catalog.releases(id) on delete restrict,
        recording_id text not null references catalog.recordings(id) on delete restrict,
        position integer not null check (position >= 0),
        primary key (release_id, recording_id),
        unique (release_id, position)
      );

      create table catalog.recording_artists (
        recording_id text not null references catalog.recordings(id) on delete restrict,
        artist_id text not null references catalog.artists(id) on delete restrict,
        position integer not null check (position >= 0),
        primary key (recording_id, artist_id),
        unique (recording_id, position)
      );

      create table catalog.provider_mappings (
        provider text not null,
        object_type text not null,
        external_id text not null,
        mapping_version integer not null,
        status text not null,
        provenance_source_ref text not null,
        canonical_artist_id text references catalog.artists(id) on delete restrict,
        canonical_release_id text references catalog.releases(id) on delete restrict,
        canonical_recording_id text references catalog.recordings(id) on delete restrict,
        primary key (provider, object_type, external_id, mapping_version),
        constraint catalog_provider_identity_valid check (
          object_type in ('artist', 'release', 'recording')
          and length(provider) between 1 and 256
          and provider !~ '[[:space:][:cntrl:]]'
          and length(external_id) between 1 and 256
          and external_id !~ '[[:space:][:cntrl:]]'
        ),
        constraint catalog_mapping_version_valid check (mapping_version > 0),
        constraint catalog_mapping_status_valid check (
          status in (
            'resolved', 'unresolved', 'ambiguous', 'superseded',
            'merged', 'split', 'correction_pending'
          )
        ),
        constraint catalog_mapping_provenance_valid check (
          length(provenance_source_ref) between 1 and 256
          and provenance_source_ref !~ '[[:space:][:cntrl:]]'
        ),
        constraint catalog_mapping_canonical_ref_valid check (
          (
            status in ('resolved', 'superseded', 'merged', 'correction_pending')
            and num_nonnulls(
              canonical_artist_id, canonical_release_id, canonical_recording_id
            ) = 1
            and (
              (object_type = 'artist' and canonical_artist_id is not null)
              or (object_type = 'release' and canonical_release_id is not null)
              or (object_type = 'recording' and canonical_recording_id is not null)
            )
          )
          or (
            status in ('unresolved', 'ambiguous', 'split')
            and num_nonnulls(
              canonical_artist_id, canonical_release_id, canonical_recording_id
            ) = 0
          )
        )
      );

      create index catalog_provider_mappings_current_lookup
        on catalog.provider_mappings (
          provider, object_type, external_id, mapping_version desc
        );

      create table catalog.provider_mapping_candidates (
        provider text not null,
        object_type text not null,
        external_id text not null,
        mapping_version integer not null,
        position integer not null check (position >= 0),
        candidate_artist_id text references catalog.artists(id) on delete restrict,
        candidate_release_id text references catalog.releases(id) on delete restrict,
        candidate_recording_id text references catalog.recordings(id) on delete restrict,
        primary key (provider, object_type, external_id, mapping_version, position),
        foreign key (provider, object_type, external_id, mapping_version)
          references catalog.provider_mappings (
            provider, object_type, external_id, mapping_version
          ) on delete cascade,
        constraint catalog_mapping_candidate_ref_valid check (
          num_nonnulls(
            candidate_artist_id, candidate_release_id, candidate_recording_id
          ) = 1
          and (
            (object_type = 'artist' and candidate_artist_id is not null)
            or (object_type = 'release' and candidate_release_id is not null)
            or (object_type = 'recording' and candidate_recording_id is not null)
          )
        )
      );

      create unique index catalog_mapping_candidate_artist_unique
        on catalog.provider_mapping_candidates (
          provider, object_type, external_id, mapping_version, candidate_artist_id
        ) where candidate_artist_id is not null;
      create unique index catalog_mapping_candidate_release_unique
        on catalog.provider_mapping_candidates (
          provider, object_type, external_id, mapping_version, candidate_release_id
        ) where candidate_release_id is not null;
      create unique index catalog_mapping_candidate_recording_unique
        on catalog.provider_mapping_candidates (
          provider, object_type, external_id, mapping_version, candidate_recording_id
        ) where candidate_recording_id is not null;

      create function catalog.validate_provider_mapping_candidate_count()
      returns trigger
      language plpgsql
      as $$
      declare
        target_provider text;
        target_object_type text;
        target_external_id text;
        target_mapping_version integer;
        target_status text;
        candidate_count integer;
      begin
        if tg_op = 'DELETE' then
          target_provider := old.provider;
          target_object_type := old.object_type;
          target_external_id := old.external_id;
          target_mapping_version := old.mapping_version;
        else
          target_provider := new.provider;
          target_object_type := new.object_type;
          target_external_id := new.external_id;
          target_mapping_version := new.mapping_version;
        end if;

        select status into target_status
        from catalog.provider_mappings
        where provider = target_provider
          and object_type = target_object_type
          and external_id = target_external_id
          and mapping_version = target_mapping_version;

        if not found then
          if tg_op = 'DELETE' then return old; else return new; end if;
        end if;

        select count(*) into candidate_count
        from catalog.provider_mapping_candidates
        where provider = target_provider
          and object_type = target_object_type
          and external_id = target_external_id
          and mapping_version = target_mapping_version;

        if target_status in ('ambiguous', 'split') and candidate_count < 2 then
          raise exception '% mapping requires at least two candidate references', target_status;
        elsif target_status = 'correction_pending' and candidate_count < 1 then
          raise exception 'correction_pending mapping requires at least one candidate reference';
        elsif target_status not in ('ambiguous', 'split', 'correction_pending')
          and candidate_count <> 0 then
          raise exception '% mapping cannot contain candidate references', target_status;
        end if;

        if tg_op = 'DELETE' then return old; else return new; end if;
      end;
      $$;

      create constraint trigger catalog_provider_mapping_candidate_count
        after insert or update on catalog.provider_mappings
        deferrable initially deferred
        for each row execute function catalog.validate_provider_mapping_candidate_count();

      create constraint trigger catalog_provider_mapping_candidate_mutation
        after insert or update or delete on catalog.provider_mapping_candidates
        deferrable initially deferred
        for each row execute function catalog.validate_provider_mapping_candidate_count();
    `.execute(database);
  },
  async down(database): Promise<void> {
    await sql`drop schema if exists catalog cascade`.execute(database);
  },
};

const catalogAlbumMetadataMigration: Migration = {
  async up(database): Promise<void> {
    await sql`
      drop trigger catalog_provider_mapping_candidate_count
        on catalog.provider_mappings;
      drop trigger catalog_provider_mapping_candidate_mutation
        on catalog.provider_mapping_candidates;

      alter table catalog.releases rename to albums;
      alter table catalog.release_artists rename to album_artists;
      alter table catalog.album_artists rename column release_id to album_id;
      alter table catalog.release_recordings rename to album_recordings;
      alter table catalog.album_recordings rename column release_id to album_id;

      alter table catalog.artists
        add column image_url text,
        add column image_provider text,
        add column image_source_ref text;

      alter table catalog.albums
        add column original_release_year smallint,
        add column original_release_year_source_ref text,
        add column cover_url text,
        add column cover_provider text,
        add column cover_source_ref text;

      alter table catalog.recordings
        add column duration_ms integer,
        add column duration_source_ref text;

      alter table catalog.provider_mappings
        rename column object_type to external_object_type;
      alter table catalog.provider_mappings
        rename column canonical_release_id to canonical_album_id;
      alter table catalog.provider_mappings
        add column canonical_kind text;

      update catalog.provider_mappings
      set canonical_kind = case external_object_type
        when 'release' then 'album'
        else external_object_type
      end;

      alter table catalog.provider_mappings
        alter column canonical_kind set not null;

      alter table catalog.provider_mapping_candidates
        rename column object_type to external_object_type;
      alter table catalog.provider_mapping_candidates
        rename column candidate_release_id to candidate_album_id;
      alter table catalog.provider_mapping_candidates
        add column canonical_kind text;

      update catalog.provider_mapping_candidates candidate
      set canonical_kind = mapping.canonical_kind
      from catalog.provider_mappings mapping
      where mapping.provider = candidate.provider
        and mapping.external_object_type = candidate.external_object_type
        and mapping.external_id = candidate.external_id
        and mapping.mapping_version = candidate.mapping_version;

      alter table catalog.provider_mapping_candidates
        alter column canonical_kind set not null;

      alter table catalog.artists
        add constraint catalog_artists_image_valid check (
          (
            image_url is null
            and image_provider is null
            and image_source_ref is null
          )
          or (
            image_url ~ '^https?://'
            and (
              (image_provider is null and image_source_ref is null)
              or (
                image_provider is not null
                and image_source_ref is not null
                and length(image_provider) between 1 and 256
                and image_provider !~ '[[:space:][:cntrl:]]'
                and length(image_source_ref) between 1 and 256
                and image_source_ref !~ '[[:space:][:cntrl:]]'
              )
            )
          )
        );

      alter table catalog.albums
        add constraint catalog_albums_original_year_valid check (
          (
            original_release_year is null
            and original_release_year_source_ref is null
          )
          or (
            original_release_year between 1000 and 9999
            and original_release_year_source_ref is not null
            and length(original_release_year_source_ref) between 1 and 256
            and original_release_year_source_ref !~ '[[:space:][:cntrl:]]'
          )
        ),
        add constraint catalog_albums_cover_valid check (
          (
            cover_url is null
            and cover_provider is null
            and cover_source_ref is null
          )
          or (
            cover_url ~ '^https?://'
            and (
              (cover_provider is null and cover_source_ref is null)
              or (
                cover_provider is not null
                and cover_source_ref is not null
                and length(cover_provider) between 1 and 256
                and cover_provider !~ '[[:space:][:cntrl:]]'
                and length(cover_source_ref) between 1 and 256
                and cover_source_ref !~ '[[:space:][:cntrl:]]'
              )
            )
          )
        );

      alter table catalog.recordings
        add constraint catalog_recordings_duration_valid check (
          (
            duration_ms is null
            and duration_source_ref is null
          )
          or (
            duration_ms > 0
            and duration_source_ref is not null
            and length(duration_source_ref) between 1 and 256
            and duration_source_ref !~ '[[:space:][:cntrl:]]'
          )
        );

      alter table catalog.provider_mappings
        drop constraint catalog_provider_identity_valid,
        drop constraint catalog_mapping_canonical_ref_valid;

      alter table catalog.provider_mappings
        add constraint catalog_provider_identity_valid check (
          length(provider) between 1 and 256
          and provider !~ '[[:space:][:cntrl:]]'
          and length(external_object_type) between 1 and 256
          and external_object_type !~ '[[:space:][:cntrl:]]'
          and length(external_id) between 1 and 256
          and external_id !~ '[[:space:][:cntrl:]]'
        ),
        add constraint catalog_mapping_canonical_kind_valid check (
          canonical_kind in ('artist', 'album', 'recording')
        ),
        add constraint catalog_mapping_canonical_ref_valid check (
          (
            status in ('resolved', 'superseded', 'merged', 'correction_pending')
            and num_nonnulls(
              canonical_artist_id, canonical_album_id, canonical_recording_id
            ) = 1
            and (
              (canonical_kind = 'artist' and canonical_artist_id is not null)
              or (canonical_kind = 'album' and canonical_album_id is not null)
              or (canonical_kind = 'recording' and canonical_recording_id is not null)
            )
          )
          or (
            status in ('unresolved', 'ambiguous', 'split')
            and num_nonnulls(
              canonical_artist_id, canonical_album_id, canonical_recording_id
            ) = 0
          )
        ),
        add constraint catalog_provider_mapping_identity_kind_unique unique (
          provider, external_object_type, external_id, mapping_version, canonical_kind
        );

      alter table catalog.provider_mapping_candidates
        drop constraint catalog_mapping_candidate_ref_valid;

      alter table catalog.provider_mapping_candidates
        add constraint catalog_mapping_candidate_kind_valid check (
          canonical_kind in ('artist', 'album', 'recording')
        ),
        add constraint catalog_mapping_candidate_ref_valid check (
          num_nonnulls(
            candidate_artist_id, candidate_album_id, candidate_recording_id
          ) = 1
          and (
            (canonical_kind = 'artist' and candidate_artist_id is not null)
            or (canonical_kind = 'album' and candidate_album_id is not null)
            or (canonical_kind = 'recording' and candidate_recording_id is not null)
          )
        ),
        add constraint catalog_mapping_candidate_kind_matches_parent foreign key (
          provider, external_object_type, external_id, mapping_version, canonical_kind
        ) references catalog.provider_mappings (
          provider, external_object_type, external_id, mapping_version, canonical_kind
        ) on delete cascade;

      alter index catalog.catalog_provider_mappings_current_lookup
        rename to catalog_provider_mappings_external_lookup;
      alter index catalog.catalog_mapping_candidate_release_unique
        rename to catalog_mapping_candidate_album_unique;

      create or replace function catalog.validate_provider_mapping_candidate_count()
      returns trigger
      language plpgsql
      as $$
      declare
        target_provider text;
        target_external_object_type text;
        target_external_id text;
        target_mapping_version integer;
        target_status text;
        candidate_count integer;
      begin
        if tg_op = 'DELETE' then
          target_provider := old.provider;
          target_external_object_type := old.external_object_type;
          target_external_id := old.external_id;
          target_mapping_version := old.mapping_version;
        else
          target_provider := new.provider;
          target_external_object_type := new.external_object_type;
          target_external_id := new.external_id;
          target_mapping_version := new.mapping_version;
        end if;

        select status into target_status
        from catalog.provider_mappings
        where provider = target_provider
          and external_object_type = target_external_object_type
          and external_id = target_external_id
          and mapping_version = target_mapping_version;

        if not found then
          if tg_op = 'DELETE' then return old; else return new; end if;
        end if;

        select count(*) into candidate_count
        from catalog.provider_mapping_candidates
        where provider = target_provider
          and external_object_type = target_external_object_type
          and external_id = target_external_id
          and mapping_version = target_mapping_version;

        if target_status in ('ambiguous', 'split') and candidate_count < 2 then
          raise exception '% mapping requires at least two candidate references', target_status;
        elsif target_status = 'correction_pending' and candidate_count < 1 then
          raise exception 'correction_pending mapping requires at least one candidate reference';
        elsif target_status not in ('ambiguous', 'split', 'correction_pending')
          and candidate_count <> 0 then
          raise exception '% mapping cannot contain candidate references', target_status;
        end if;

        if tg_op = 'DELETE' then return old; else return new; end if;
      end;
      $$;

      create constraint trigger catalog_provider_mapping_candidate_count
        after insert or update on catalog.provider_mappings
        deferrable initially deferred
        for each row execute function catalog.validate_provider_mapping_candidate_count();

      create constraint trigger catalog_provider_mapping_candidate_mutation
        after insert or update or delete on catalog.provider_mapping_candidates
        deferrable initially deferred
        for each row execute function catalog.validate_provider_mapping_candidate_count();
    `.execute(database);
  },
  async down(): Promise<void> {
    throw new Error(
      '0003_catalog_album_metadata is forward-only because it corrects canonical semantics.',
    );
  },
};

const catalogSearchProjectionMigration: Migration = {
  async up(database): Promise<void> {
    await sql`
      create schema if not exists search;

      create table search.catalog_documents (
        kind text not null,
        canonical_id text not null,
        display_title text not null,
        artists jsonb not null default '[]'::jsonb,
        original_release_year integer,
        image_url text,
        image_provider text,
        image_source_ref text,
        duration_ms integer,
        album_context jsonb,
        searchable_text text not null,
        search_vector tsvector generated always as (
          to_tsvector('simple', searchable_text)
        ) stored,
        projection_version integer not null default 1,
        updated_at timestamptz not null default now(),
        primary key (kind, canonical_id),
        constraint search_catalog_documents_kind_valid check (
          kind in ('artist', 'album', 'recording')
        ),
        constraint search_catalog_documents_id_valid check (
          length(canonical_id) between 1 and 256
          and canonical_id !~ '[[:space:][:cntrl:]]'
        ),
        constraint search_catalog_documents_title_valid check (
          length(display_title) > 0
          and display_title = btrim(display_title)
          and display_title !~ '[[:cntrl:]]'
        ),
        constraint search_catalog_documents_artists_valid check (
          jsonb_typeof(artists) = 'array'
        ),
        constraint search_catalog_documents_image_valid check (
          (
            image_url is null
            and image_provider is null
            and image_source_ref is null
          )
          or (
            image_url ~ '^https?://'
            and (
              (image_provider is null and image_source_ref is null)
              or (image_provider is not null and image_source_ref is not null)
            )
          )
        ),
        constraint search_catalog_documents_projection_version_valid check (
          projection_version > 0
        )
      );

      create index search_catalog_documents_fts
        on search.catalog_documents using gin (search_vector);
      create index search_catalog_documents_title_trgm
        on search.catalog_documents using gin (lower(display_title) gin_trgm_ops);
      create index search_catalog_documents_stable_order
        on search.catalog_documents (kind, lower(display_title), canonical_id);
    `.execute(database);
  },
  async down(database): Promise<void> {
    await sql`drop schema if exists search cascade`.execute(database);
  },
};

const yaraInteractionFoundationMigration: Migration = {
  async up(database): Promise<void> {
    await sql`
      create schema if not exists yara_interaction;

      create table yara_interaction.conversations (
        id text primary key,
        owner_ref text not null,
        status text not null default 'active',
        created_at timestamptz not null,
        updated_at timestamptz not null,
        constraint yara_conversations_id_valid check (
          id ~ '^conversation:yara:[0-9a-f-]{36}$'
        ),
        constraint yara_conversations_owner_valid check (
          length(owner_ref) between 1 and 256 and owner_ref !~ '[[:cntrl:]]'
        ),
        constraint yara_conversations_status_valid check (status in ('active', 'archived')),
        constraint yara_conversations_time_valid check (updated_at >= created_at)
      );

      create index yara_conversations_owner_updated
        on yara_interaction.conversations (owner_ref, updated_at desc, id);

      create table yara_interaction.conversation_messages (
        id text primary key,
        conversation_id text not null
          references yara_interaction.conversations(id) on delete restrict,
        sequence integer not null check (sequence > 0),
        role text not null check (role in ('user', 'assistant')),
        status text not null default 'committed' check (status = 'committed'),
        content text not null,
        created_at timestamptz not null,
        unique (conversation_id, sequence),
        constraint yara_messages_id_valid check (id ~ '^message:yara:[0-9a-f-]{36}$'),
        constraint yara_messages_content_valid check (
          length(content) between 1 and 20000
          and content = btrim(content)
        )
      );

      create table yara_interaction.ai_execution_runs (
        id text primary key,
        conversation_id text not null
          references yara_interaction.conversations(id) on delete restrict,
        trigger_message_id text not null
          references yara_interaction.conversation_messages(id) on delete restrict,
        assistant_message_id text
          references yara_interaction.conversation_messages(id) on delete restrict,
        status text not null,
        provider text not null,
        model text not null,
        provider_response_id text,
        usage jsonb,
        failure jsonb,
        created_at timestamptz not null,
        started_at timestamptz,
        finished_at timestamptz,
        updated_at timestamptz not null,
        constraint yara_runs_id_valid check (id ~ '^ai-run:yara:[0-9a-f-]{36}$'),
        constraint yara_runs_status_valid check (
          status in ('pending', 'running', 'completed', 'failed', 'cancelled')
        ),
        constraint yara_runs_provider_model_valid check (
          length(provider) between 1 and 128 and length(model) between 1 and 256
        ),
        constraint yara_runs_state_shape_valid check (
          (status = 'pending' and started_at is null and finished_at is null and failure is null)
          or (status = 'running' and started_at is not null and finished_at is null and failure is null)
          or (status = 'completed' and started_at is not null and finished_at is not null
            and failure is null and assistant_message_id is not null)
          or (status = 'failed' and started_at is not null and finished_at is not null
            and failure is not null and assistant_message_id is null)
          or (status = 'cancelled' and finished_at is not null and failure is null
            and assistant_message_id is null)
        )
      );

      create index yara_runs_conversation_created
        on yara_interaction.ai_execution_runs (conversation_id, created_at desc, id);

      create table yara_interaction.ai_execution_run_events (
        run_id text not null
          references yara_interaction.ai_execution_runs(id) on delete restrict,
        sequence integer not null check (sequence > 0),
        event_type text not null check (
          event_type in (
            'run.started', 'message.delta', 'message.completed',
            'run.completed', 'run.failed', 'run.cancelled'
          )
        ),
        payload jsonb not null,
        created_at timestamptz not null,
        primary key (run_id, sequence),
        constraint yara_run_event_payload_valid check (
          jsonb_typeof(payload) = 'object' and payload->>'type' = event_type
        )
      );
    `.execute(database);
  },
  async down(database): Promise<void> {
    await sql`drop schema if exists yara_interaction cascade`.execute(database);
  },
};

const yaraInteractionReliabilityMigration: Migration = {
  async up(database): Promise<void> {
    await sql`
      create unique index yara_runs_one_active_per_conversation
        on yara_interaction.ai_execution_runs (conversation_id)
        where status in ('pending', 'running');

      create table yara_interaction.ai_execution_jobs (
        run_id text primary key
          references yara_interaction.ai_execution_runs(id) on delete restrict,
        status text not null default 'queued',
        attempt integer not null default 0 check (attempt >= 0),
        lease_owner text,
        lease_expires_at timestamptz,
        last_error text,
        created_at timestamptz not null,
        updated_at timestamptz not null,
        constraint yara_execution_jobs_status_valid check (
          status in (
            'queued', 'claimed', 'completed', 'failed', 'cancelled',
            'reconciliation_required'
          )
        ),
        constraint yara_execution_jobs_lease_valid check (
          (status = 'claimed' and lease_owner is not null and lease_expires_at is not null)
          or (status <> 'claimed' and lease_owner is null and lease_expires_at is null)
        )
      );

      create index yara_execution_jobs_claimable
        on yara_interaction.ai_execution_jobs (status, created_at, run_id);
      create index yara_execution_jobs_stale_lease
        on yara_interaction.ai_execution_jobs (lease_expires_at)
        where status = 'claimed';

      create table yara_interaction.command_idempotency (
        owner_ref text not null,
        command_scope text not null,
        idempotency_key text not null,
        semantic_fingerprint text not null,
        conversation_id text not null
          references yara_interaction.conversations(id) on delete restrict,
        message_id text not null
          references yara_interaction.conversation_messages(id) on delete restrict,
        run_id text not null
          references yara_interaction.ai_execution_runs(id) on delete restrict,
        created_at timestamptz not null,
        primary key (owner_ref, command_scope, idempotency_key),
        constraint yara_command_scope_valid check (
          command_scope in ('start_conversation', 'send_message')
        ),
        constraint yara_idempotency_key_valid check (
          length(idempotency_key) between 8 and 200
          and idempotency_key !~ '[[:cntrl:]]'
        ),
        constraint yara_semantic_fingerprint_valid check (
          semantic_fingerprint ~ '^[0-9a-f]{64}$'
        )
      );
    `.execute(database);
  },
  async down(database): Promise<void> {
    await sql`
      drop table if exists yara_interaction.command_idempotency;
      drop table if exists yara_interaction.ai_execution_jobs;
      drop index if exists yara_interaction.yara_runs_one_active_per_conversation;
    `.execute(database);
  },
};

export type YaraMigrationName =
  | '0001_stage_zero_extensions'
  | '0002_catalog_foundation'
  | '0003_catalog_album_metadata'
  | '0004_catalog_search_projection'
  | '0005_yara_interaction_foundation'
  | '0006_yara_interaction_reliability';

function createYaraMigrator(database: Kysely<YaraDatabase>): Migrator {
  return new Migrator({
    db: database,
    provider: {
      async getMigrations() {
        return {
          '0001_stage_zero_extensions': stageZeroExtensionsMigration,
          '0002_catalog_foundation': catalogFoundationMigration,
          '0003_catalog_album_metadata': catalogAlbumMetadataMigration,
          '0004_catalog_search_projection': catalogSearchProjectionMigration,
          '0005_yara_interaction_foundation': yaraInteractionFoundationMigration,
          '0006_yara_interaction_reliability': yaraInteractionReliabilityMigration,
        };
      },
    },
  });
}

function assertMigrationResult(result: Awaited<ReturnType<Migrator['migrateToLatest']>>): void {
  const failure = result.results?.find((migration) => migration.status === 'Error');
  if (result.error || failure) {
    throw result.error ?? new Error(`Migration ${failure?.migrationName ?? 'unknown'} failed`);
  }
}

export async function migrateYaraDatabase(database: Kysely<YaraDatabase>): Promise<void> {
  assertMigrationResult(await createYaraMigrator(database).migrateToLatest());
}

/** Integration/rehearsal helper for proving an already-applied migration can move forward safely. */
export async function migrateYaraDatabaseTo(
  database: Kysely<YaraDatabase>,
  migrationName: YaraMigrationName,
): Promise<void> {
  assertMigrationResult(await createYaraMigrator(database).migrateTo(migrationName));
}

/** @deprecated Compatibility alias; new code should use migrateYaraDatabase. */
export const migrateStageZero = migrateYaraDatabase;
