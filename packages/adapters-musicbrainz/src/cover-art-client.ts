import type { CatalogImage } from '@yara/domain-catalog';
import { providerMappingSourceRef, providerName } from '@yara/domain-catalog';

import { coverArtArchiveDtoSchema } from './musicbrainz-dto.js';
import { ProviderHttpClient, type ProviderHttpClientOptions } from './provider-http-client.js';

export class CoverArtArchiveClient {
  private readonly http: ProviderHttpClient;

  public constructor(options: ProviderHttpClientOptions) {
    this.http = new ProviderHttpClient({ minimumIntervalMs: 0, ...options });
  }

  public async getReleaseGroupCover(releaseGroupId: string): Promise<CatalogImage | undefined> {
    const payload = await this.http.getJson(
      `release-group/${encodeURIComponent(releaseGroupId)}`,
      coverArtArchiveDtoSchema,
    );
    if (!payload) return undefined;

    const selected =
      payload.images.find((image) => image.front && image.approved) ??
      payload.images.find((image) => image.front) ??
      payload.images.find((image) => image.approved) ??
      payload.images[0];
    if (!selected) return undefined;
    return {
      url: selected.thumbnails?.['500'] ?? selected.thumbnails?.['250'] ?? selected.image,
      provider: providerName('coverartarchive'),
      sourceRef: providerMappingSourceRef(
        `coverartarchive:release-group:${releaseGroupId}:image:${selected.id}`,
      ),
    };
  }
}
