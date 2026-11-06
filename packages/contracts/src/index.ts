export type ServiceName = 'web' | 'api' | 'worker';

export type HealthStatus = 'ok' | 'degraded';

export interface HealthResponse {
  readonly service: ServiceName;
  readonly status: HealthStatus;
  readonly version: string;
  readonly timestamp: string;
  readonly checks?: Readonly<Record<string, HealthStatus>>;
}

export interface CatalogImageContract {
  readonly url: string;
  readonly provider?: string;
  readonly sourceRef?: string;
}

export interface ArtistSummaryContract {
  readonly id: string;
  readonly name: string;
}

export interface AlbumContextSummaryContract {
  readonly id: string;
  readonly title: string;
  readonly cover?: CatalogImageContract;
}

export interface ArtistSearchResultContract {
  readonly kind: 'artist';
  readonly id: string;
  readonly name: string;
  readonly image?: CatalogImageContract;
}

export interface AlbumSearchResultContract {
  readonly kind: 'album';
  readonly id: string;
  readonly title: string;
  readonly artists: readonly ArtistSummaryContract[];
  readonly originalReleaseYear?: number;
  readonly cover?: CatalogImageContract;
}

export interface RecordingSearchResultContract {
  readonly kind: 'recording';
  readonly id: string;
  readonly title: string;
  readonly artists: readonly ArtistSummaryContract[];
  readonly durationMs?: number;
  readonly albumContext?: AlbumContextSummaryContract;
  readonly artwork?: CatalogImageContract;
}

export type CatalogSearchResultContract =
  ArtistSearchResultContract | AlbumSearchResultContract | RecordingSearchResultContract;

export interface ArtistDetailContract {
  readonly kind: 'artist';
  readonly id: string;
  readonly canonicalName: string;
  readonly image?: CatalogImageContract;
}

export interface RecordingDetailSummaryContract {
  readonly id: string;
  readonly title: string;
  readonly artists: readonly ArtistSummaryContract[];
  readonly durationMs?: number;
  readonly position: number;
}

export interface AlbumDetailContract {
  readonly kind: 'album';
  readonly id: string;
  readonly title: string;
  readonly artists: readonly ArtistSummaryContract[];
  readonly originalReleaseYear?: number;
  readonly cover?: CatalogImageContract;
  readonly trackCount: number;
  readonly recordings: readonly RecordingDetailSummaryContract[];
}

export interface RecordingDetailContract {
  readonly kind: 'recording';
  readonly id: string;
  readonly title: string;
  readonly artists: readonly ArtistSummaryContract[];
  readonly durationMs?: number;
  readonly albumContexts: readonly AlbumContextSummaryContract[];
}
