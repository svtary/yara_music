import { Module, type DynamicModule, type OnModuleDestroy } from '@nestjs/common';
import { OpenAIModelProviderAdapter } from '@yara/adapters-openai';
import { createPostgresDatabase, type YaraDatabase } from '@yara/adapters-postgres';
import {
  PostgresCatalogDetailAdapter,
  PostgresCatalogQueryAdapter,
  PostgresCatalogSearchAdapter,
} from '@yara/adapters-postgres/catalog';
import { PostgresYaraInteractionAdapter } from '@yara/adapters-postgres/yara-interaction';
import {
  ControlledAgentRuntime,
  UnavailableModelProvider,
  type AgentRuntimePort,
} from '@yara/ai-runtime';
import {
  CatalogDetailQuery,
  ConversationApplicationService,
  ConversationExecutionService,
  SearchCatalogQuery,
  type AIExecutionObservation,
  type AIExecutionObserverPort,
  type YaraInteractionPersistencePort,
} from '@yara/application';
import type { ApiConfig } from '@yara/config';
import type { Kysely } from 'kysely';

import { CatalogController } from './catalog.controller.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { SearchController } from './search.controller.js';
import { YaraController } from './yara.controller.js';
import {
  AGENT_RUNTIME,
  API_CONFIG,
  CATALOG_DETAIL_QUERY,
  CATALOG_QUERY_PORT,
  DATABASE,
  CONVERSATION_APPLICATION,
  CONVERSATION_EXECUTION,
  SEARCH_CATALOG_QUERY,
  YARA_INTERACTION_PERSISTENCE,
} from './tokens.js';

class DatabaseLifecycle implements OnModuleDestroy {
  public constructor(private readonly database: Kysely<YaraDatabase>) {}

  public async onModuleDestroy(): Promise<void> {
    await this.database.destroy();
  }
}

class SafeExecutionObserver implements AIExecutionObserverPort {
  public record(observation: AIExecutionObservation): void {
    console.info(JSON.stringify({ event: 'ai.execution', ...observation }));
  }
}

@Module({})
export class AppModule {
  public static register(config: ApiConfig): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, SearchController, CatalogController, YaraController],
      providers: [
        HealthService,
        SafeExecutionObserver,
        { provide: API_CONFIG, useValue: config },
        {
          provide: DATABASE,
          useFactory: () => createPostgresDatabase(config.databaseUrl),
        },
        {
          provide: YARA_INTERACTION_PERSISTENCE,
          inject: [DATABASE],
          useFactory: (database: Kysely<YaraDatabase>) =>
            new PostgresYaraInteractionAdapter(database),
        },
        {
          provide: AGENT_RUNTIME,
          useFactory: (): AgentRuntimePort => {
            const provider =
              config.modelProvider === 'openai' && config.modelApiKey
                ? new OpenAIModelProviderAdapter({
                    apiKey: config.modelApiKey,
                    timeoutMs: config.modelTimeoutMs,
                    ...(config.modelBaseUrl ? { baseURL: config.modelBaseUrl } : {}),
                  })
                : new UnavailableModelProvider();
            return new ControlledAgentRuntime(provider);
          },
        },
        {
          provide: CONVERSATION_APPLICATION,
          inject: [YARA_INTERACTION_PERSISTENCE],
          useFactory: (persistence: YaraInteractionPersistencePort) =>
            new ConversationApplicationService(persistence, {
              provider: config.modelProvider,
              model: config.modelName,
            }),
        },
        {
          provide: CONVERSATION_EXECUTION,
          inject: [YARA_INTERACTION_PERSISTENCE, AGENT_RUNTIME, SafeExecutionObserver],
          useFactory: (
            persistence: YaraInteractionPersistencePort,
            runtime: AgentRuntimePort,
            observer: AIExecutionObserverPort,
          ) => new ConversationExecutionService(persistence, runtime, observer),
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
