import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CatalogDetailQuery,
  SearchCatalogQuery,
  type CatalogDetailQueryPort,
  type CatalogSearchQueryPort,
} from '@yara/application';
import { describe, expect, it, vi } from 'vitest';

import { CatalogController } from './catalog.controller.js';
import { SearchController } from './search.controller.js';

describe('Catalog transport controllers', () => {
  it('maps malformed Search input to HTTP 400 semantics', async () => {
    const query = new SearchCatalogQuery({ search: vi.fn() });
    const controller = new SearchController(query);
    await expect(controller.search('   ', undefined, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('delegates Search to the Application query without provider access', async () => {
    const search = vi
      .fn<CatalogSearchQueryPort['search']>()
      .mockResolvedValue([{ kind: 'artist', id: 'artist:radiohead', name: 'Radiohead' }]);
    const controller = new SearchController(new SearchCatalogQuery({ search }));
    await expect(controller.search(' Radiohead ', '5', 'artist')).resolves.toEqual([
      { kind: 'artist', id: 'artist:radiohead', name: 'Radiohead' },
    ]);
    expect(search).toHaveBeenCalledWith({ query: 'Radiohead', limit: 5, kind: 'artist' });
  });

  it('returns typed detail and maps missing canonical objects to 404', async () => {
    const port: CatalogDetailQueryPort = {
      getArtistDetail: vi.fn().mockResolvedValue({
        kind: 'artist',
        id: 'artist:radiohead',
        canonicalName: 'Radiohead',
      }),
      getAlbumDetail: vi.fn().mockResolvedValue(null),
      getRecordingDetail: vi.fn().mockResolvedValue(null),
    };
    const controller = new CatalogController(new CatalogDetailQuery(port));
    await expect(controller.artist('artist:radiohead')).resolves.toEqual({
      kind: 'artist',
      id: 'artist:radiohead',
      canonicalName: 'Radiohead',
    });
    await expect(controller.album('album:missing')).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.recording('recording:missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
