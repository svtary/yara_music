import { Module, type DynamicModule, type OnModuleDestroy } from '@nestjs/common';
import { createPostgresDatabase, type YaraDatabase } from '@yara/adapters-postgres';
import { PostgresCatalogQueryAdapter } from '@yara/adapters-postgres/catalog';
import type { ApiConfig } from '@yara/config';
import type { Kysely } from 'kysely';

import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { API_CONFIG, CATALOG_QUERY_PORT, DATABASE } from './tokens.js';

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
      controllers: [HealthController],
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
          provide: DatabaseLifecycle,
          inject: [DATABASE],
          useFactory: (database: Kysely<YaraDatabase>) => new DatabaseLifecycle(database),
        },
      ],
    };
  }
}
