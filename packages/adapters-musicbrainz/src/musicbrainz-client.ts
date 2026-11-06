import {
  musicBrainzArtistDtoSchema,
  musicBrainzRecordingDtoSchema,
  musicBrainzReleaseDtoSchema,
  musicBrainzReleaseGroupDtoSchema,
  type MusicBrainzArtistDto,
  type MusicBrainzRecordingDto,
  type MusicBrainzReleaseGroupDto,
} from './musicbrainz-dto.js';
import { ProviderHttpClient, type ProviderHttpClientOptions } from './provider-http-client.js';

export class MusicBrainzClient {
  private readonly http: ProviderHttpClient;

  public constructor(options: ProviderHttpClientOptions) {
    this.http = new ProviderHttpClient({ minimumIntervalMs: 1_000, ...options });
  }

  public getArtist(id: string): Promise<MusicBrainzArtistDto | null> {
    return this.http.getJson(
      `artist/${encodeURIComponent(id)}?fmt=json`,
      musicBrainzArtistDtoSchema,
    );
  }

  public getReleaseGroup(id: string): Promise<MusicBrainzReleaseGroupDto | null> {
    return this.getReleaseGroupWithRepresentativeTracklist(id);
  }

  public getRecording(id: string): Promise<MusicBrainzRecordingDto | null> {
    return this.http.getJson(
      `recording/${encodeURIComponent(id)}?fmt=json&inc=artist-credits`,
      musicBrainzRecordingDtoSchema,
    );
  }

  private async getReleaseGroupWithRepresentativeTracklist(
    id: string,
  ): Promise<MusicBrainzReleaseGroupDto | null> {
    const releaseGroup = await this.http.getJson(
      `release-group/${encodeURIComponent(id)}?fmt=json&inc=artist-credits+releases`,
      musicBrainzReleaseGroupDtoSchema,
    );
    if (!releaseGroup) return null;
    const representative = [...(releaseGroup.releases ?? [])].sort((left, right) => {
      const officialDifference =
        Number(right.status === 'Official') - Number(left.status === 'Official');
      if (officialDifference !== 0) return officialDifference;
      const dateDifference = (left.date ?? '9999').localeCompare(right.date ?? '9999');
      return dateDifference !== 0 ? dateDifference : left.id.localeCompare(right.id);
    })[0];
    if (!representative) return releaseGroup;
    const release = await this.http.getJson(
      `release/${encodeURIComponent(representative.id)}?fmt=json&inc=recordings+artist-credits`,
      musicBrainzReleaseDtoSchema,
    );
    return release ? { ...releaseGroup, releases: [release] } : releaseGroup;
  }
}
