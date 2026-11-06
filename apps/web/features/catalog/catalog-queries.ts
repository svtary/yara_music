'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  readAlbumDetail,
  readArtistDetail,
  readRecordingDetail,
  searchCatalog,
} from './catalog-api';

export const catalogQueryKeys = {
  search: (query: string) => ['catalog', 'search', { query }] as const,
  artist: (id: string) => ['catalog', 'artist', id] as const,
  album: (id: string) => ['catalog', 'album', id] as const,
  recording: (id: string) => ['catalog', 'recording', id] as const,
};

export function useCatalogSearch(query: string) {
  return useQuery({
    queryKey: catalogQueryKeys.search(query),
    queryFn: ({ signal }) => searchCatalog(query, signal),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useArtistDetail(id: string) {
  return useQuery({
    queryKey: catalogQueryKeys.artist(id),
    queryFn: ({ signal }) => readArtistDetail(id, signal),
  });
}

export function useAlbumDetail(id: string) {
  return useQuery({
    queryKey: catalogQueryKeys.album(id),
    queryFn: ({ signal }) => readAlbumDetail(id, signal),
  });
}

export function useRecordingDetail(id: string) {
  return useQuery({
    queryKey: catalogQueryKeys.recording(id),
    queryFn: ({ signal }) => readRecordingDetail(id, signal),
  });
}
