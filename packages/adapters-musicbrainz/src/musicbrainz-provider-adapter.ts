import type {
  ExternalAlbumCandidate,
  ExternalArtistCandidate,
  ExternalCatalogProviderPort,
  ExternalRecordingCandidate,
} from '@yara/application';

import type { CoverArtArchiveClient } from './cover-art-client.js';
import type { MusicBrainzClient } from './musicbrainz-client.js';
import {
  normalizeMusicBrainzArtist,
  normalizeMusicBrainzRecording,
  normalizeMusicBrainzReleaseGroup,
} from './normalization.js';

export class MusicBrainzProviderAdapter implements ExternalCatalogProviderPort {
  public constructor(
    private readonly musicBrainz: MusicBrainzClient,
    private readonly coverArtArchive: CoverArtArchiveClient,
  ) {}

  public async getArtist(externalId: string): Promise<ExternalArtistCandidate | null> {
    const dto = await this.musicBrainz.getArtist(externalId);
    return dto ? normalizeMusicBrainzArtist(dto) : null;
  }

  public async getAlbum(externalId: string): Promise<ExternalAlbumCandidate | null> {
    const dto = await this.musicBrainz.getReleaseGroup(externalId);
    if (!dto) return null;
    let cover;
    try {
      cover = await this.coverArtArchive.getReleaseGroupCover(externalId);
    } catch {
      // Artwork is optional display metadata; provider failure must not reject Catalog acceptance.
      cover = undefined;
    }
    return normalizeMusicBrainzReleaseGroup(dto, cover);
  }

  public async getRecording(externalId: string): Promise<ExternalRecordingCandidate | null> {
    const dto = await this.musicBrainz.getRecording(externalId);
    return dto ? normalizeMusicBrainzRecording(dto) : null;
  }
}
