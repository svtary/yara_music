import { describe, expect, it, vi } from 'vitest';

import {
  CatalogSearchInputError,
  SearchCatalogQuery,
  type CatalogSearchQueryPort,
} from './catalog-search.js';

describe('SearchCatalogQuery', () => {
  it('normalizes input and delegates only a bounded typed query', async () => {
    const search = vi.fn<CatalogSearchQueryPort['search']>().mockResolvedValue([]);
    const query = new SearchCatalogQuery({ search });
    await expect(
      query.execute({ query: '  Radiohead  ', limit: 5, kind: 'artist' }),
    ).resolves.toEqual([]);
    expect(search).toHaveBeenCalledWith({ query: 'Radiohead', limit: 5, kind: 'artist' });
  });

  it.each([
    [{ query: '' }, /must not be empty/u],
    [{ query: 'x'.repeat(121) }, /at most 120/u],
    [{ query: 'ok', limit: 0 }, /between 1 and 50/u],
    [{ query: 'ok', limit: 51 }, /between 1 and 50/u],
    [{ query: 'ok', limit: 1.5 }, /integer/u],
    [{ query: 'ok', kind: 'playlist' }, /artist, album, or recording/u],
  ])('rejects malformed search input %#', async (input, message) => {
    const query = new SearchCatalogQuery({ search: vi.fn() });
    await expect(query.execute(input)).rejects.toThrowError(CatalogSearchInputError);
    await expect(query.execute(input)).rejects.toThrowError(message);
  });
});
