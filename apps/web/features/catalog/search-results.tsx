import type {
  AlbumSearchResultContract,
  ArtistSearchResultContract,
  CatalogSearchResultContract,
  RecordingSearchResultContract,
} from '@yara/contracts';
import Link from 'next/link';

import { catalogDetailHref } from './catalog-routes';
import { formatDuration } from './format-duration';
import { groupCatalogSearchResults } from './group-search-results';
import { MediaArtwork } from './media-artwork';

function artistNames(artists: readonly { readonly name: string }[]) {
  return artists.map((artist) => artist.name).join(', ');
}

export function RecordingSearchResult({
  result,
}: {
  readonly result: RecordingSearchResultContract;
}) {
  const duration = formatDuration(result.durationMs);
  return (
    <Link
      className="catalog-track-row catalog-focusable"
      href={catalogDetailHref('recording', result.id)}
    >
      <MediaArtwork
        className="catalog-row-artwork"
        url={result.artwork?.url ?? result.albumContext?.cover?.url}
        alt={result.albumContext ? `${result.albumContext.title} cover` : `${result.title} context`}
      />
      <span className="catalog-row-copy">
        <strong>{result.title}</strong>
        <span>
          {artistNames(result.artists)}
          {result.albumContext ? ` · ${result.albumContext.title}` : ''}
        </span>
      </span>
      {duration ? <span className="catalog-row-duration">{duration}</span> : null}
      <span aria-hidden="true" className="catalog-row-arrow">
        →
      </span>
    </Link>
  );
}

export function AlbumSearchResult({ result }: { readonly result: AlbumSearchResultContract }) {
  return (
    <Link
      className="catalog-object-card catalog-focusable"
      href={catalogDetailHref('album', result.id)}
    >
      <MediaArtwork url={result.cover?.url} alt={`${result.title} cover`} />
      <span className="catalog-card-copy">
        <span className="catalog-object-label">Album</span>
        <strong>{result.title}</strong>
        <span>
          {artistNames(result.artists)}
          {result.originalReleaseYear ? ` · ${result.originalReleaseYear}` : ''}
        </span>
      </span>
    </Link>
  );
}

export function ArtistSearchResult({ result }: { readonly result: ArtistSearchResultContract }) {
  return (
    <Link
      className="catalog-artist-card catalog-focusable"
      href={catalogDetailHref('artist', result.id)}
    >
      <MediaArtwork url={result.image?.url} alt={`${result.name} portrait`} shape="circle" />
      <span className="catalog-card-copy">
        <span className="catalog-object-label">Artist</span>
        <strong>{result.name}</strong>
      </span>
    </Link>
  );
}

export function SearchResults({
  results,
}: {
  readonly results: readonly CatalogSearchResultContract[];
}) {
  const groups = groupCatalogSearchResults(results);

  return (
    <div className="catalog-result-groups">
      {groups.recordings.length > 0 ? (
        <section className="catalog-result-section" aria-labelledby="recording-results-heading">
          <div className="catalog-section-heading">
            <span>Music</span>
            <h2 id="recording-results-heading">Tracks</h2>
          </div>
          <div className="catalog-track-list">
            {groups.recordings.map((result) => (
              <RecordingSearchResult key={result.id} result={result} />
            ))}
          </div>
        </section>
      ) : null}

      {groups.albums.length > 0 ? (
        <section className="catalog-result-section" aria-labelledby="album-results-heading">
          <div className="catalog-section-heading">
            <span>Discography</span>
            <h2 id="album-results-heading">Albums</h2>
          </div>
          <div className="catalog-card-grid">
            {groups.albums.map((result) => (
              <AlbumSearchResult key={result.id} result={result} />
            ))}
          </div>
        </section>
      ) : null}

      {groups.artists.length > 0 ? (
        <section className="catalog-result-section" aria-labelledby="artist-results-heading">
          <div className="catalog-section-heading">
            <span>People</span>
            <h2 id="artist-results-heading">Artists</h2>
          </div>
          <div className="catalog-artist-grid">
            {groups.artists.map((result) => (
              <ArtistSearchResult key={result.id} result={result} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
