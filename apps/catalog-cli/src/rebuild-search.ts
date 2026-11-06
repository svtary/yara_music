import { createCatalogCli } from './composition.js';

const cli = await createCatalogCli();
try {
  await cli.searchProjection.rebuild();
  console.log(JSON.stringify({ searchProjection: 'rebuilt' }));
} finally {
  await cli.database.destroy();
}
