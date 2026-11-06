import type {
  Album,
  Artist,
  ArtistId,
  CatalogEntityKind,
  CatalogImage,
  ProviderIdentity,
  ProviderMappingSourceRef,
  Recording,
  RecordingId,
} from '@yara/domain-catalog';

import type { CatalogQueryPort } from './catalog-query-port.js';
import type { CatalogSearchProjectionPort } from '../search/catalog-search.js';

export interface ExternalArtistCandidate {
  readonly providerIdentity: ProviderIdentity;
  readonly provenanceSourceRef: ProviderMappingSourceRef;
  readonly canonicalName: string;
  readonly image?: CatalogImage;
}

export interface ExternalRecordingCandidate {
  readonly providerIdentity: ProviderIdentity;
  readonly provenanceSourceRef: ProviderMappingSourceRef;
  readonly canonicalTitle: string;
  readonly artists: readonly ExternalArtistCandidate[];
  readonly durationMs?: number;
  readonly durationSourceRef?: ProviderMappingSourceRef;
}

export interface ExternalAlbumCandidate {
  readonly providerIdentity: ProviderIdentity;
  readonly provenanceSourceRef: ProviderMappingSourceRef;
  readonly canonicalTitle: string;
  readonly artists: readonly ExternalArtistCandidate[];
  readonly recordings: readonly ExternalRecordingCandidate[];
  readonly originalReleaseYear?: number;
  readonly originalReleaseYearSourceRef?: ProviderMappingSourceRef;
  readonly cover?: CatalogImage;
}

export interface ExternalCatalogProviderPort {
  getArtist(externalId: string): Promise<ExternalArtistCandidate | null>;
  getAlbum(externalId: string): Promise<ExternalAlbumCandidate | null>;
  getRecording(externalId: string): Promise<ExternalRecordingCandidate | null>;
}

export interface AcceptArtistInput {
  readonly candidate: ExternalArtistCandidate;
}

export interface AcceptRecordingInput {
  readonly candidate: ExternalRecordingCandidate;
  readonly artistIds: readonly ArtistId[];
}

export interface AcceptAlbumInput {
  readonly candidate: ExternalAlbumCandidate;
  readonly artistIds: readonly ArtistId[];
  readonly recordingIds: readonly RecordingId[];
}

export interface CatalogWritePort {
  acceptArtist(input: AcceptArtistInput): Promise<Artist>;
  acceptRecording(input: AcceptRecordingInput): Promise<Recording>;
  acceptAlbum(input: AcceptAlbumInput): Promise<Album>;
}

export class CatalogIngestionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CatalogIngestionError';
  }
}

export class CatalogIngestionService {
  public constructor(
    private readonly provider: ExternalCatalogProviderPort,
    private readonly catalogQuery: CatalogQueryPort,
    private readonly catalogWrite: CatalogWritePort,
    private readonly searchProjection: CatalogSearchProjectionPort,
  ) {}

  public async ingestArtist(externalId: string): Promise<Artist> {
    const candidate = await this.provider.getArtist(externalId);
    if (!candidate) throw new CatalogIngestionError(`Provider artist ${externalId} was not found.`);
    const artist = await this.acceptArtist(candidate);
    await this.searchProjection.rebuild();
    return artist;
  }

  public async ingestRecording(externalId: string): Promise<Recording> {
    const candidate = await this.provider.getRecording(externalId);
    if (!candidate) {
      throw new CatalogIngestionError(`Provider recording ${externalId} was not found.`);
    }
    const recording = await this.acceptRecording(candidate);
    await this.searchProjection.rebuild();
    return recording;
  }

  public async ingestAlbum(externalId: string): Promise<Album> {
    const candidate = await this.provider.getAlbum(externalId);
    if (!candidate) throw new CatalogIngestionError(`Provider album ${externalId} was not found.`);

    const artistIds: ArtistId[] = [];
    for (const artistCandidate of candidate.artists) {
      artistIds.push((await this.acceptArtist(artistCandidate)).id);
    }
    const recordingIds: RecordingId[] = [];
    for (const recordingCandidate of candidate.recordings) {
      recordingIds.push((await this.acceptRecording(recordingCandidate)).id);
    }

    await this.assertExistingMapping(candidate.providerIdentity, 'album');
    const album = await this.catalogWrite.acceptAlbum({ candidate, artistIds, recordingIds });
    await this.searchProjection.rebuild();
    return album;
  }

  private async acceptArtist(candidate: ExternalArtistCandidate): Promise<Artist> {
    await this.assertExistingMapping(candidate.providerIdentity, 'artist');
    return this.catalogWrite.acceptArtist({ candidate });
  }

  private async acceptRecording(candidate: ExternalRecordingCandidate): Promise<Recording> {
    const artistIds: ArtistId[] = [];
    for (const artistCandidate of candidate.artists) {
      artistIds.push((await this.acceptArtist(artistCandidate)).id);
    }
    await this.assertExistingMapping(candidate.providerIdentity, 'recording');
    return this.catalogWrite.acceptRecording({ candidate, artistIds });
  }

  private async assertExistingMapping(
    identity: ProviderIdentity,
    expectedKind: CatalogEntityKind,
  ): Promise<void> {
    const mapping = await this.catalogQuery.resolveProviderIdentity(identity);
    if (!mapping) return;
    if (mapping.canonicalKind !== expectedKind) {
      throw new CatalogIngestionError(
        `Provider identity is already mapped to ${mapping.canonicalKind}, not ${expectedKind}.`,
      );
    }
    if (!['resolved', 'merged'].includes(mapping.status)) {
      throw new CatalogIngestionError(
        `Provider identity cannot be ingested while mapping status is ${mapping.status}.`,
      );
    }
  }
}
