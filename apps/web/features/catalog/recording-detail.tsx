'use client';

import Link from 'next/link';

import { CatalogApiError } from './catalog-api';
import { useRecordingDetail } from './catalog-queries';
import { catalogDetailHref } from './catalog-routes';
import { resolveDetailViewState } from './catalog-view-state';
import {
  CatalogBackButton,
  DetailErrorState,
  DetailLoadingState,
  DetailNotFoundState,
} from './detail-states';
import { formatDuration } from './format-duration';
import { MediaArtwork } from './media-artwork';

export function RecordingDetail({ id }: Readonly<{ id: string }>) {
  const query = useRecordingDetail(id);
  const state = resolveDetailViewState({
    isPending: query.isPending,
    errorStatus: query.error instanceof CatalogApiError ? query.error.status : undefined,
    hasData: query.data !== undefined,
  });

  if (state === 'loading') return <DetailLoadingState />;
  if (state === 'not-found') return <DetailNotFoundState objectName="recording" />;
  if (state === 'error' || !query.data) {
    return <DetailErrorState onRetry={() => void query.refetch()} />;
  }

  const recording = query.data;
  const primaryAlbum = recording.albumContexts[0];
  const duration = formatDuration(recording.durationMs);

  return (
    <article className="catalog-page catalog-detail-page">
      <CatalogBackButton />
      <header className="catalog-detail-hero">
        <MediaArtwork
          className="catalog-detail-artwork"
          url={primaryAlbum?.cover?.url}
          alt={primaryAlbum ? `${primaryAlbum.title} cover` : `${recording.title} context`}
        />
        <div className="catalog-detail-copy">
          <span className="catalog-object-label">Track</span>
          <h1>{recording.title}</h1>
          <p className="catalog-detail-meta">
            {recording.artists.map((artist, index) => (
              <span key={artist.id}>
                {index > 0 ? ', ' : null}
                <Link href={catalogDetailHref('artist', artist.id)}>{artist.name}</Link>
              </span>
            ))}
            {duration ? ` · ${duration}` : ''}
          </p>
        </div>
      </header>

      <section className="catalog-detail-section" aria-labelledby="recording-albums-heading">
        <div className="catalog-section-heading">
          <span>Context</span>
          <h2 id="recording-albums-heading">Album context</h2>
        </div>
        {recording.albumContexts.length > 0 ? (
          <div className="catalog-card-grid">
            {recording.albumContexts.map((album) => (
              <Link
                className="catalog-object-card catalog-focusable"
                href={catalogDetailHref('album', album.id)}
                key={album.id}
              >
                <MediaArtwork url={album.cover?.url} alt={`${album.title} cover`} />
                <span className="catalog-card-copy">
                  <span className="catalog-object-label">Album</span>
                  <strong>{album.title}</strong>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="catalog-optional-empty">No album context is currently available.</p>
        )}
      </section>
    </article>
  );
}
