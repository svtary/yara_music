import type {
  AlbumDetailContract,
  CatalogSearchResultContract,
  RecordingDetailContract,
} from '@yara/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CatalogApiError,
  isAlbumDetail,
  isCatalogSearchResponse,
  isRecordingDetail,
  searchCatalog,
} from './catalog-api';
import { catalogDetailHref, exploreHref, normalizeSearchQuery } from './catalog-routes';
import { resolveDetailViewState, resolveSearchViewState } from './catalog-view-state';
import { formatDuration } from './format-duration';
import { groupCatalogSearchResults } from './group-search-results';
import { decodeCatalogPathId } from '../../lib/catalog-id';

const searchResults: readonly CatalogSearchResultContract[] = [
  { kind: 'artist', id: 'artist:yara:a1', name: 'Radiohead' },
  {
    kind: 'album',
    id: 'album:yara:b1',
    title: 'OK Computer',
    artists: [{ id: 'artist:yara:a1', name: 'Radiohead' }],
    originalReleaseYear: 1997,
  },
  {
    kind: 'recording',
    id: 'recording:yara:r1',
    title: 'Airbag',
    artists: [{ id: 'artist:yara:a1', name: 'Radiohead' }],
    durationMs: 284_000,
    albumContext: { id: 'album:yara:b1', title: 'OK Computer' },
  },
];

afterEach(() => vi.unstubAllGlobals());

describe('Explore search behavior', () => {
  it('normalizes URL-addressable queries and does not invent an idle query', () => {
    expect(normalizeSearchQuery('  Radiohead  ')).toBe('Radiohead');
    expect(exploreHref('  Radiohead  ')).toBe('/explore?q=Radiohead');
    expect(exploreHref('   ')).toBe('/explore');
  });

  it('maps idle, loading, error, empty, and results as distinct states', () => {
    expect(
      resolveSearchViewState({ query: '', isPending: false, hasError: false, results: undefined }),
    ).toBe('idle');
    expect(
      resolveSearchViewState({
        query: 'Airbag',
        isPending: true,
        hasError: false,
        results: undefined,
      }),
    ).toBe('loading');
    expect(
      resolveSearchViewState({
        query: 'Airbag',
        isPending: false,
        hasError: true,
        results: undefined,
      }),
    ).toBe('error');
    expect(
      resolveSearchViewState({ query: 'Airbag', isPending: false, hasError: false, results: [] }),
    ).toBe('empty');
    expect(
      resolveSearchViewState({
        query: 'Airbag',
        isPending: false,
        hasError: false,
        results: searchResults,
      }),
    ).toBe('results');
  });

  it('branches the discriminated union into Artist, Album, and Recording groups', () => {
    const groups = groupCatalogSearchResults(searchResults);
    expect(groups.artists.map((result) => result.name)).toEqual(['Radiohead']);
    expect(groups.albums.map((result) => result.title)).toEqual(['OK Computer']);
    expect(groups.recordings.map((result) => result.title)).toEqual(['Airbag']);
  });

  it('calls the bounded BFF search route with an encoded query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(searchResults), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(searchCatalog('Radiohead & Airbag')).resolves.toEqual(searchResults);
    expect(fetchMock).toHaveBeenCalledWith('/api/catalog/search?q=Radiohead%20%26%20Airbag', {
      headers: { accept: 'application/json' },
    });
  });

  it('rejects malformed API responses instead of leaking unknown shapes into UI', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify([{ id: 'missing-kind' }]), { status: 200 })),
    );

    await expect(searchCatalog('broken')).rejects.toMatchObject({
      name: 'CatalogApiError',
      status: 502,
    });
    expect(isCatalogSearchResponse([{ id: 'missing-kind' }])).toBe(false);
  });
});

describe('Canonical navigation', () => {
  it.each([
    ['artist', 'artist:yara:a1', '/artists/artist%3Ayara%3Aa1'],
    ['album', 'album:yara:b1', '/albums/album%3Ayara%3Ab1'],
    ['recording', 'recording:yara:r1', '/recordings/recording%3Ayara%3Ar1'],
  ] as const)('routes %s results with the exact encoded canonical ID', (kind, id, expected) => {
    expect(catalogDetailHref(kind, id)).toBe(expected);
    expect(decodeCatalogPathId(expected.split('/').at(-1) ?? '')).toBe(id);
  });

  it('rejects malformed path encoding at the Web route boundary', () => {
    expect(decodeCatalogPathId('%E0%A4%A')).toBeNull();
  });
});

describe('Catalog detail behavior', () => {
  const album: AlbumDetailContract = {
    kind: 'album',
    id: 'album:yara:b1',
    title: 'OK Computer',
    artists: [{ id: 'artist:yara:a1', name: 'Radiohead' }],
    originalReleaseYear: 1997,
    trackCount: 2,
    recordings: [
      {
        id: 'recording:yara:r2',
        title: 'Paranoid Android',
        artists: [{ id: 'artist:yara:a1', name: 'Radiohead' }],
        position: 2,
      },
      {
        id: 'recording:yara:r1',
        title: 'Airbag',
        artists: [{ id: 'artist:yara:a1', name: 'Radiohead' }],
        position: 1,
      },
    ],
  };

  const recording: RecordingDetailContract = {
    kind: 'recording',
    id: 'recording:yara:r1',
    title: 'Airbag',
    artists: [{ id: 'artist:yara:a1', name: 'Radiohead' }],
    durationMs: 284_000,
    albumContexts: [{ id: 'album:yara:b1', title: 'OK Computer' }],
  };

  it('accepts Artist/Album/Recording contracts and preserves backend track order', () => {
    expect(
      isCatalogSearchResponse([{ kind: 'artist', id: 'artist:yara:a1', name: 'Radiohead' }]),
    ).toBe(true);
    expect(isAlbumDetail(album)).toBe(true);
    expect(album.recordings.map((item) => item.position)).toEqual([2, 1]);
    expect(isRecordingDetail(recording)).toBe(true);
  });

  it('formats duration once and handles missing values without fabrication', () => {
    expect(formatDuration(222_000)).toBe('3:42');
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(-1)).toBeNull();
  });

  it('distinguishes ready, loading, not-found, and transport error behavior', () => {
    expect(resolveDetailViewState({ isPending: true, hasData: false })).toBe('loading');
    expect(resolveDetailViewState({ isPending: false, errorStatus: 404, hasData: false })).toBe(
      'not-found',
    );
    expect(resolveDetailViewState({ isPending: false, errorStatus: 503, hasData: false })).toBe(
      'error',
    );
    expect(resolveDetailViewState({ isPending: false, hasData: true })).toBe('ready');
    expect(new CatalogApiError('missing', 404).status).toBe(404);
  });
});
