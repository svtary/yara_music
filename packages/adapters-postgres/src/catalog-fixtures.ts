import {
  albumId,
  albumRef,
  artistId,
  artistRef,
  createAlbum,
  createArtist,
  createProviderIdentity,
  createProviderMapping,
  createRecording,
  providerMappingSourceRef,
  providerName,
  recordingId,
  recordingRef,
  type Album,
  type Artist,
  type CatalogEntityRef,
  type ProviderMapping,
  type Recording,
} from '@yara/domain-catalog';
import type { Insertable, Kysely, Transaction } from 'kysely';

import type {
  CatalogProviderMappingCandidateTable,
  CatalogProviderMappingTable,
  YaraDatabase,
} from './database-schema.js';

const fixtureProvider = providerName('fixture-metadata');
const radioheadId = artistId('artist:radiohead');
const bjorkId = artistId('artist:bjork');
const massiveAttackId = artistId('artist:massive-attack');

const paranoidAndroidId = recordingId('recording:paranoid-android');
const karmaPoliceId = recordingId('recording:karma-police');
const everythingInItsRightPlaceId = recordingId('recording:everything-in-its-right-place');
const jogaId = recordingId('recording:joga');
const bacheloretteId = recordingId('recording:bachelorette');
const teardropId = recordingId('recording:teardrop');
const angelId = recordingId('recording:angel');

const okComputerId = albumId('album:ok-computer');
const kidAId = albumId('album:kid-a');
const homogenicId = albumId('album:homogenic');
const mezzanineId = albumId('album:mezzanine');

function fixtureImage(path: string, source: string) {
  return {
    url: `https://fixtures.yara.test/images/${path}`,
    provider: fixtureProvider,
    sourceRef: providerMappingSourceRef(source),
  } as const;
}

const artists: readonly Artist[] = [
  createArtist({
    id: radioheadId,
    canonicalName: 'Radiohead',
    image: fixtureImage('artists/radiohead.jpg', 'fixture:image:artist:radiohead'),
  }),
  createArtist({
    id: bjorkId,
    canonicalName: 'Björk',
    image: fixtureImage('artists/bjork.jpg', 'fixture:image:artist:bjork'),
  }),
  createArtist({
    id: massiveAttackId,
    canonicalName: 'Massive Attack',
    image: fixtureImage('artists/massive-attack.jpg', 'fixture:image:artist:massive-attack'),
  }),
];

const recordings: readonly Recording[] = [
  createRecording({
    id: paranoidAndroidId,
    canonicalTitle: 'Paranoid Android',
    artistIds: [radioheadId],
    durationMs: 383_000,
  }),
  createRecording({
    id: karmaPoliceId,
    canonicalTitle: 'Karma Police',
    artistIds: [radioheadId],
    durationMs: 264_000,
  }),
  createRecording({
    id: everythingInItsRightPlaceId,
    canonicalTitle: 'Everything in Its Right Place',
    artistIds: [radioheadId],
    durationMs: 251_000,
  }),
  createRecording({
    id: jogaId,
    canonicalTitle: 'Jóga',
    artistIds: [bjorkId],
    durationMs: 300_000,
  }),
  createRecording({
    id: bacheloretteId,
    canonicalTitle: 'Bachelorette',
    artistIds: [bjorkId],
    durationMs: 312_000,
  }),
  createRecording({
    id: teardropId,
    canonicalTitle: 'Teardrop',
    artistIds: [massiveAttackId],
    durationMs: 331_000,
  }),
  createRecording({
    id: angelId,
    canonicalTitle: 'Angel',
    artistIds: [massiveAttackId],
    durationMs: 379_000,
  }),
];

const albums: readonly Album[] = [
  createAlbum({
    id: okComputerId,
    canonicalTitle: 'OK Computer',
    artistIds: [radioheadId],
    recordingIds: [paranoidAndroidId, karmaPoliceId],
    originalReleaseYear: 1997,
    cover: fixtureImage('albums/ok-computer.jpg', 'fixture:image:album:ok-computer'),
  }),
  createAlbum({
    id: kidAId,
    canonicalTitle: 'Kid A',
    artistIds: [radioheadId],
    recordingIds: [everythingInItsRightPlaceId],
    originalReleaseYear: 2000,
    cover: fixtureImage('albums/kid-a.jpg', 'fixture:image:album:kid-a'),
  }),
  createAlbum({
    id: homogenicId,
    canonicalTitle: 'Homogenic',
    artistIds: [bjorkId],
    recordingIds: [jogaId, bacheloretteId],
    originalReleaseYear: 1997,
    cover: fixtureImage('albums/homogenic.jpg', 'fixture:image:album:homogenic'),
  }),
  createAlbum({
    id: mezzanineId,
    canonicalTitle: 'Mezzanine',
    artistIds: [massiveAttackId],
    recordingIds: [teardropId, angelId],
    originalReleaseYear: 1998,
    cover: fixtureImage('albums/mezzanine.jpg', 'fixture:image:album:mezzanine'),
  }),
];

const yearSourceRefs = new Map(
  albums.map((album) => [album.id, providerMappingSourceRef(`fixture:year:${album.id}`)]),
);
const durationSourceRefs = new Map(
  recordings.map((recording) => [
    recording.id,
    providerMappingSourceRef(`fixture:duration:${recording.id}`),
  ]),
);

const provenance = { sourceRef: providerMappingSourceRef('fixture:catalog:v2') };
const providerMappings: readonly ProviderMapping[] = [
  createProviderMapping({
    providerIdentity: createProviderIdentity({
      provider: fixtureProvider,
      externalObjectType: 'release-group',
      externalId: 'release-group:ok-computer',
    }),
    canonicalKind: 'album',
    status: 'resolved',
    canonicalRef: albumRef(okComputerId),
    mappingVersion: 1,
    provenance,
  }),
  createProviderMapping({
    providerIdentity: createProviderIdentity({
      provider: fixtureProvider,
      externalObjectType: 'artist',
      externalId: 'artist:unknown',
    }),
    canonicalKind: 'artist',
    status: 'unresolved',
    mappingVersion: 1,
    provenance,
  }),
  createProviderMapping({
    providerIdentity: createProviderIdentity({
      provider: fixtureProvider,
      externalObjectType: 'release-group',
      externalId: 'release-group:ambiguous-radiohead',
    }),
    canonicalKind: 'album',
    status: 'ambiguous',
    candidateRefs: [albumRef(okComputerId), albumRef(kidAId)],
    mappingVersion: 1,
    provenance,
  }),
  createProviderMapping({
    providerIdentity: createProviderIdentity({
      provider: fixtureProvider,
      externalObjectType: 'track',
      externalId: 'track:legacy-paranoid-android',
    }),
    canonicalKind: 'recording',
    status: 'superseded',
    canonicalRef: recordingRef(paranoidAndroidId),
    mappingVersion: 1,
    provenance,
  }),
  createProviderMapping({
    providerIdentity: createProviderIdentity({
      provider: fixtureProvider,
      externalObjectType: 'artist',
      externalId: 'artist:duplicate-bjork',
    }),
    canonicalKind: 'artist',
    status: 'merged',
    canonicalRef: artistRef(bjorkId),
    mappingVersion: 1,
    provenance,
  }),
  createProviderMapping({
    providerIdentity: createProviderIdentity({
      provider: fixtureProvider,
      externalObjectType: 'release-group',
      externalId: 'release-group:legacy-radiohead-bundle',
    }),
    canonicalKind: 'album',
    status: 'split',
    candidateRefs: [albumRef(okComputerId), albumRef(kidAId)],
    mappingVersion: 1,
    provenance,
  }),
  createProviderMapping({
    providerIdentity: createProviderIdentity({
      provider: fixtureProvider,
      externalObjectType: 'recording',
      externalId: 'recording:pending-correction',
    }),
    canonicalKind: 'recording',
    status: 'correction_pending',
    canonicalRef: recordingRef(karmaPoliceId),
    candidateRefs: [recordingRef(paranoidAndroidId)],
    mappingVersion: 2,
    provenance,
  }),
];

export const catalogFixtures = Object.freeze({ artists, recordings, albums, providerMappings });

function canonicalColumns(
  reference: CatalogEntityRef | undefined,
): Pick<
  CatalogProviderMappingTable,
  'canonical_artist_id' | 'canonical_album_id' | 'canonical_recording_id'
> {
  return {
    canonical_artist_id: reference?.kind === 'artist' ? reference.id : null,
    canonical_album_id: reference?.kind === 'album' ? reference.id : null,
    canonical_recording_id: reference?.kind === 'recording' ? reference.id : null,
  };
}

function candidateColumns(
  reference: CatalogEntityRef,
): Pick<
  CatalogProviderMappingCandidateTable,
  'candidate_artist_id' | 'candidate_album_id' | 'candidate_recording_id'
> {
  return {
    candidate_artist_id: reference.kind === 'artist' ? reference.id : null,
    candidate_album_id: reference.kind === 'album' ? reference.id : null,
    candidate_recording_id: reference.kind === 'recording' ? reference.id : null,
  };
}

async function clearCatalog(transaction: Transaction<YaraDatabase>): Promise<void> {
  await transaction.deleteFrom('catalog.provider_mapping_candidates').execute();
  await transaction.deleteFrom('catalog.provider_mappings').execute();
  await transaction.deleteFrom('catalog.album_recordings').execute();
  await transaction.deleteFrom('catalog.album_artists').execute();
  await transaction.deleteFrom('catalog.recording_artists').execute();
  await transaction.deleteFrom('catalog.albums').execute();
  await transaction.deleteFrom('catalog.recordings').execute();
  await transaction.deleteFrom('catalog.artists').execute();
}

async function insertMappings(transaction: Transaction<YaraDatabase>): Promise<void> {
  for (const mapping of providerMappings) {
    const canonicalRef = 'canonicalRef' in mapping ? mapping.canonicalRef : undefined;
    const row: Insertable<CatalogProviderMappingTable> = {
      provider: mapping.providerIdentity.provider,
      external_object_type: mapping.providerIdentity.externalObjectType,
      external_id: mapping.providerIdentity.externalId,
      canonical_kind: mapping.canonicalKind,
      mapping_version: mapping.mappingVersion,
      status: mapping.status,
      provenance_source_ref: mapping.provenance.sourceRef,
      ...canonicalColumns(canonicalRef),
    };
    await transaction.insertInto('catalog.provider_mappings').values(row).execute();

    if ('candidateRefs' in mapping) {
      const candidates: Insertable<CatalogProviderMappingCandidateTable>[] =
        mapping.candidateRefs.map((reference, position) => ({
          provider: mapping.providerIdentity.provider,
          external_object_type: mapping.providerIdentity.externalObjectType,
          external_id: mapping.providerIdentity.externalId,
          canonical_kind: mapping.canonicalKind,
          mapping_version: mapping.mappingVersion,
          position,
          ...candidateColumns(reference),
        }));
      await transaction
        .insertInto('catalog.provider_mapping_candidates')
        .values(candidates)
        .execute();
    }
  }
}

/** Development fixtures replace only the Catalog-owned fixture dataset in one transaction. */
export async function seedCatalogFixtures(database: Kysely<YaraDatabase>): Promise<void> {
  await database.transaction().execute(async (transaction) => {
    await clearCatalog(transaction);
    await transaction
      .insertInto('catalog.artists')
      .values(
        artists.map((artist) => ({
          id: artist.id,
          canonical_name: artist.canonicalName,
          image_url: artist.image?.url ?? null,
          image_provider: artist.image?.provider ?? null,
          image_source_ref: artist.image?.sourceRef ?? null,
        })),
      )
      .execute();
    await transaction
      .insertInto('catalog.recordings')
      .values(
        recordings.map((recording) => ({
          id: recording.id,
          canonical_title: recording.canonicalTitle,
          duration_ms: recording.durationMs ?? null,
          duration_source_ref: durationSourceRefs.get(recording.id) ?? null,
        })),
      )
      .execute();
    await transaction
      .insertInto('catalog.albums')
      .values(
        albums.map((album) => ({
          id: album.id,
          canonical_title: album.canonicalTitle,
          original_release_year: album.originalReleaseYear ?? null,
          original_release_year_source_ref: yearSourceRefs.get(album.id) ?? null,
          cover_url: album.cover?.url ?? null,
          cover_provider: album.cover?.provider ?? null,
          cover_source_ref: album.cover?.sourceRef ?? null,
        })),
      )
      .execute();

    for (const recording of recordings) {
      await transaction
        .insertInto('catalog.recording_artists')
        .values(
          recording.artistIds.map((artistIdValue, position) => ({
            recording_id: recording.id,
            artist_id: artistIdValue,
            position,
          })),
        )
        .execute();
    }
    for (const album of albums) {
      await transaction
        .insertInto('catalog.album_artists')
        .values(
          album.artistIds.map((artistIdValue, position) => ({
            album_id: album.id,
            artist_id: artistIdValue,
            position,
          })),
        )
        .execute();
      await transaction
        .insertInto('catalog.album_recordings')
        .values(
          album.recordingIds.map((recordingIdValue, position) => ({
            album_id: album.id,
            recording_id: recordingIdValue,
            position,
          })),
        )
        .execute();
    }
    await insertMappings(transaction);
  });
}
