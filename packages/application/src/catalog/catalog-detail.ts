import type { CatalogImage } from '@yara/domain-catalog';

import type { ArtistSummary, AlbumContextSummary } from '../search/catalog-search.js';

export interface ArtistDetail {
  readonly kind: 'artist';
  readonly id: string;
  readonly canonicalName: string;
  readonly image?: CatalogImage;
}

export interface RecordingDetailSummary {
  readonly id: string;
  readonly title: string;
  readonly artists: readonly ArtistSummary[];
  readonly durationMs?: number;
  readonly position: number;
}

export interface AlbumDetail {
  readonly kind: 'album';
  readonly id: string;
  readonly title: string;
  readonly artists: readonly ArtistSummary[];
  readonly originalReleaseYear?: number;
  readonly cover?: CatalogImage;
  readonly trackCount: number;
  readonly recordings: readonly RecordingDetailSummary[];
}

export interface RecordingDetail {
  readonly kind: 'recording';
  readonly id: string;
  readonly title: string;
  readonly artists: readonly ArtistSummary[];
  readonly durationMs?: number;
  readonly albumContexts: readonly AlbumContextSummary[];
}

export interface CatalogDetailQueryPort {
  getArtistDetail(id: string): Promise<ArtistDetail | null>;
  getAlbumDetail(id: string): Promise<AlbumDetail | null>;
  getRecordingDetail(id: string): Promise<RecordingDetail | null>;
}

export class CatalogDetailQuery {
  public constructor(private readonly port: CatalogDetailQueryPort) {}

  public getArtist(id: string): Promise<ArtistDetail | null> {
    return this.port.getArtistDetail(id);
  }

  public getAlbum(id: string): Promise<AlbumDetail | null> {
    return this.port.getAlbumDetail(id);
  }

  public getRecording(id: string): Promise<RecordingDetail | null> {
    return this.port.getRecordingDetail(id);
  }
}
