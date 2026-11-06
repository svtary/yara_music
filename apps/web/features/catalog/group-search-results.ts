import type {
  AlbumSearchResultContract,
  ArtistSearchResultContract,
  CatalogSearchResultContract,
  RecordingSearchResultContract,
} from '@yara/contracts';

export interface CatalogResultGroups {
  readonly recordings: readonly RecordingSearchResultContract[];
  readonly albums: readonly AlbumSearchResultContract[];
  readonly artists: readonly ArtistSearchResultContract[];
}

export function groupCatalogSearchResults(
  results: readonly CatalogSearchResultContract[],
): CatalogResultGroups {
  return results.reduce<CatalogResultGroups>(
    (groups, result) => {
      if (result.kind === 'recording') {
        return { ...groups, recordings: [...groups.recordings, result] };
      }
      if (result.kind === 'album') return { ...groups, albums: [...groups.albums, result] };
      return { ...groups, artists: [...groups.artists, result] };
    },
    { recordings: [], albums: [], artists: [] },
  );
}
