import { createProviderIdentity } from '@yara/domain-catalog';

import { createCatalogCli } from './composition.js';

type IngestKind = 'artist' | 'album' | 'recording';

const [rawKind, externalId] = process.argv.slice(2).filter((argument) => argument !== '--');
if ((rawKind !== 'artist' && rawKind !== 'album' && rawKind !== 'recording') || !externalId) {
  throw new Error('Usage: catalog ingest <artist|album|recording> <MusicBrainz ID>');
}
const kind: IngestKind = rawKind;
const cli = await createCatalogCli();
try {
  const canonical =
    kind === 'artist'
      ? await cli.ingestion.ingestArtist(externalId)
      : kind === 'album'
        ? await cli.ingestion.ingestAlbum(externalId)
        : await cli.ingestion.ingestRecording(externalId);
  const providerIdentity = createProviderIdentity({
    provider: 'musicbrainz',
    externalObjectType: kind === 'album' ? 'release-group' : kind,
    externalId,
  });
  const mapping = await cli.catalogQuery.resolveProviderIdentity(providerIdentity);
  console.log(JSON.stringify({ providerIdentity, canonical, mapping }, null, 2));
} finally {
  await cli.database.destroy();
}
