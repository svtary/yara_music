import { Module, type DynamicModule, type OnModuleDestroy } from '@nestjs/common';
import { createPostgresDatabase, type YaraDatabase } from '@yara/adapters-postgres';
import {
  PostgresCatalogDetailAdapter,
  PostgresCatalogQueryAdapter,
  PostgresCatalogSearchAdapter,
} from '@yara/adapters-postgres/catalog';
import { CatalogDetailQuery, SearchCatalogQuery } from '@yara/application';
import type { ApiConfig } from '@yara/config';
import type { Kysely } from 'kysely';

import { CatalogController } from './catalog.controller.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { SearchController } from './search.controller.js';
import {
  API_CONFIG,
  CATALOG_DETAIL_QUERY,
  CATALOG_QUERY_PORT,
  DATABASE,
  SEARCH_CATALOG_QUERY,
} from './tokens.js';

class DatabaseLifecycle implements OnModuleDestroy {
  public constructor(private readonly database: Kysely<YaraDatabase>) {}

  public async onModuleDestroy(): Promise<void> {
    await this.database.destroy();
  }
}

@Module({})
export class AppModule {
  public static register(config: ApiConfig): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, SearchController, CatalogController],
      providers: [
        HealthService,
        { provide: API_CONFIG, useValue: config },
        {
          provide: DATABASE,
          useFactory: () => createPostgresDatabase(config.databaseUrl),
        },
        {
          provide: CATALOG_QUERY_PORT,
          inject: [DATABASE],
          useFactory: (database: Kysely<YaraDatabase>) => new PostgresCatalogQueryAdapter(database),
        },
        {
          provide: SEARCH_CATALOG_QUERY,
          inject: [DATABASE],
          useFactory: (database: Kysely<YaraDatabase>) =>
            new SearchCatalogQuery(new PostgresCatalogSearchAdapter(database)),
        },
        {
          provide: CATALOG_DETAIL_QUERY,
          inject: [DATABASE],
          useFactory: (database: Kysely<YaraDatabase>) =>
            new CatalogDetailQuery(new PostgresCatalogDetailAdapter(database)),
        },
        {
          provide: DatabaseLifecycle,
          inject: [DATABASE],
          useFactory: (database: Kysely<YaraDatabase>) => new DatabaseLifecycle(database),
        },
      ],
    };
  }
}
