'use client';

import { CatalogApiError } from './catalog-api';
import { useArtistDetail } from './catalog-queries';
import { resolveDetailViewState } from './catalog-view-state';
import {
  CatalogBackButton,
  DetailErrorState,
  DetailLoadingState,
  DetailNotFoundState,
} from './detail-states';
import { MediaArtwork } from './media-artwork';

export function ArtistDetail({ id }: Readonly<{ id: string }>) {
  const query = useArtistDetail(id);
  const state = resolveDetailViewState({
    isPending: query.isPending,
    errorStatus: query.error instanceof CatalogApiError ? query.error.status : undefined,
    hasData: query.data !== undefined,
  });

  if (state === 'loading') return <DetailLoadingState />;
  if (state === 'not-found') return <DetailNotFoundState objectName="artist" />;
  if (state === 'error' || !query.data) {
    return <DetailErrorState onRetry={() => void query.refetch()} />;
  }

  return (
    <article className="catalog-page catalog-detail-page">
      <CatalogBackButton />
      <header className="catalog-detail-hero is-artist">
        <MediaArtwork
          className="catalog-detail-artwork"
          url={query.data.image?.url}
          alt={`${query.data.canonicalName} portrait`}
          shape="circle"
        />
        <div className="catalog-detail-copy">
          <span className="catalog-object-label">Artist</span>
          <h1>{query.data.canonicalName}</h1>
          <p className="catalog-detail-supporting">Canonical artist identity in Yara.</p>
        </div>
      </header>
    </article>
  );
}
