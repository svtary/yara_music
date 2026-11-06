'use client';

import type { ArtistSummaryContract } from '@yara/contracts';
import Link from 'next/link';

import { CatalogApiError } from './catalog-api';
import { useAlbumDetail } from './catalog-queries';
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

function ArtistLinks({ artists }: Readonly<{ artists: readonly ArtistSummaryContract[] }>) {
  return (
    <span className="catalog-inline-links">
      {artists.map((artist, index) => (
        <span key={artist.id}>
          {index > 0 ? ', ' : null}
          <Link href={catalogDetailHref('artist', artist.id)}>{artist.name}</Link>
        </span>
      ))}
    </span>
  );
}

export function AlbumDetail({ id }: Readonly<{ id: string }>) {
  const query = useAlbumDetail(id);
  const state = resolveDetailViewState({
    isPending: query.isPending,
    errorStatus: query.error instanceof CatalogApiError ? query.error.status : undefined,
    hasData: query.data !== undefined,
  });

  if (state === 'loading') return <DetailLoadingState />;
  if (state === 'not-found') return <DetailNotFoundState objectName="album" />;
  if (state === 'error' || !query.data) {
    return <DetailErrorState onRetry={() => void query.refetch()} />;
  }

  const album = query.data;
  return (
    <article className="catalog-page catalog-detail-page">
      <CatalogBackButton />
      <header className="catalog-detail-hero">
        <MediaArtwork
          className="catalog-detail-artwork"
          url={album.cover?.url}
          alt={`${album.title} cover`}
        />
        <div className="catalog-detail-copy">
          <span className="catalog-object-label">Album</span>
          <h1>{album.title}</h1>
          <p className="catalog-detail-meta">
            <ArtistLinks artists={album.artists} />
            {album.originalReleaseYear ? ` · ${album.originalReleaseYear}` : ''}
          </p>
          <p className="catalog-detail-supporting">
            {album.trackCount} {album.trackCount === 1 ? 'track' : 'tracks'}
          </p>
        </div>
      </header>

      <section className="catalog-detail-section" aria-labelledby="album-tracklist-heading">
        <div className="catalog-section-heading">
          <span>Sequence</span>
          <h2 id="album-tracklist-heading">Tracklist</h2>
        </div>
        {album.recordings.length > 0 ? (
          <ol className="catalog-tracklist">
            {album.recordings.map((recording) => {
              const duration = formatDuration(recording.durationMs);
              return (
                <li key={recording.id} value={recording.position}>
                  <Link
                    className="catalog-tracklist-row catalog-focusable"
                    href={catalogDetailHref('recording', recording.id)}
                  >
                    <span className="catalog-track-position">{recording.position}</span>
                    <span className="catalog-row-copy">
                      <strong>{recording.title}</strong>
                      <span>{recording.artists.map((artist) => artist.name).join(', ')}</span>
                    </span>
                    {duration ? <span className="catalog-row-duration">{duration}</span> : null}
                    <span aria-hidden="true" className="catalog-row-arrow">
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="catalog-optional-empty">No ordered recordings are available.</p>
        )}
      </section>
    </article>
  );
}
