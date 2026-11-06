import type {
  ExternalAlbumCandidate,
  ExternalArtistCandidate,
  ExternalRecordingCandidate,
} from '@yara/application';
import type { CatalogImage } from '@yara/domain-catalog';
import { createProviderIdentity, providerMappingSourceRef } from '@yara/domain-catalog';

import type {
  MusicBrainzArtistDto,
  MusicBrainzRecordingDto,
  MusicBrainzReleaseGroupDto,
} from './musicbrainz-dto.js';

function sourceRef(type: string, id: string) {
  return providerMappingSourceRef(`musicbrainz:${type}:${id}`);
}

export function normalizeMusicBrainzArtist(dto: MusicBrainzArtistDto): ExternalArtistCandidate {
  return {
    providerIdentity: createProviderIdentity({
      provider: 'musicbrainz',
      externalObjectType: 'artist',
      externalId: dto.id,
    }),
    provenanceSourceRef: sourceRef('artist', dto.id),
    canonicalName: dto.name,
  };
}

function creditedArtists(
  credits: MusicBrainzRecordingDto['artist-credit'] | MusicBrainzReleaseGroupDto['artist-credit'],
): readonly ExternalArtistCandidate[] {
  const seen = new Set<string>();
  const artists: ExternalArtistCandidate[] = [];
  for (const credit of credits ?? []) {
    if (!seen.has(credit.artist.id)) {
      seen.add(credit.artist.id);
      artists.push(normalizeMusicBrainzArtist(credit.artist));
    }
  }
  return artists;
}

export function normalizeMusicBrainzRecording(
  dto: MusicBrainzRecordingDto,
  fallbackArtists: readonly ExternalArtistCandidate[] = [],
): ExternalRecordingCandidate {
  const artists = creditedArtists(dto['artist-credit']);
  const durationMs = dto.length ?? undefined;
  return {
    providerIdentity: createProviderIdentity({
      provider: 'musicbrainz',
      externalObjectType: 'recording',
      externalId: dto.id,
    }),
    provenanceSourceRef: sourceRef('recording', dto.id),
    canonicalTitle: dto.title,
    artists: artists.length > 0 ? artists : fallbackArtists,
    ...(durationMs === undefined
      ? {}
      : { durationMs, durationSourceRef: sourceRef('recording', dto.id) }),
  };
}

export function normalizeMusicBrainzReleaseGroup(
  dto: MusicBrainzReleaseGroupDto,
  cover?: CatalogImage,
): ExternalAlbumCandidate {
  const artists = creditedArtists(dto['artist-credit']);
  const recordings = new Map<string, ExternalRecordingCandidate>();
  for (const release of dto.releases ?? []) {
    for (const medium of release.media ?? []) {
      for (const track of medium.tracks ?? []) {
        if (!recordings.has(track.recording.id)) {
          recordings.set(
            track.recording.id,
            normalizeMusicBrainzRecording(track.recording, artists),
          );
        }
      }
    }
  }

  const yearMatch = /^(\d{4})(?:-|$)/u.exec(dto['first-release-date'] ?? '');
  const originalReleaseYear = yearMatch ? Number(yearMatch[1]) : undefined;
  return {
    providerIdentity: createProviderIdentity({
      provider: 'musicbrainz',
      externalObjectType: 'release-group',
      externalId: dto.id,
    }),
    provenanceSourceRef: sourceRef('release-group', dto.id),
    canonicalTitle: dto.title,
    artists,
    recordings: [...recordings.values()],
    ...(originalReleaseYear === undefined
      ? {}
      : {
          originalReleaseYear,
          originalReleaseYearSourceRef: sourceRef('release-group', dto.id),
        }),
    ...(cover ? { cover } : {}),
  };
}
