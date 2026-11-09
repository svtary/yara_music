export type ServiceName = 'web' | 'api' | 'worker';

export type HealthStatus = 'ok' | 'degraded';

export interface HealthResponse {
  readonly service: ServiceName;
  readonly status: HealthStatus;
  readonly version: string;
  readonly timestamp: string;
  readonly checks?: Readonly<Record<string, HealthStatus>>;
}

export interface CatalogImageContract {
  readonly url: string;
  readonly provider?: string;
  readonly sourceRef?: string;
}

export interface ArtistSummaryContract {
  readonly id: string;
  readonly name: string;
}

export interface AlbumContextSummaryContract {
  readonly id: string;
  readonly title: string;
  readonly cover?: CatalogImageContract;
}

export interface ArtistSearchResultContract {
  readonly kind: 'artist';
  readonly id: string;
  readonly name: string;
  readonly image?: CatalogImageContract;
}

export interface AlbumSearchResultContract {
  readonly kind: 'album';
  readonly id: string;
  readonly title: string;
  readonly artists: readonly ArtistSummaryContract[];
  readonly originalReleaseYear?: number;
  readonly cover?: CatalogImageContract;
}

export interface RecordingSearchResultContract {
  readonly kind: 'recording';
  readonly id: string;
  readonly title: string;
  readonly artists: readonly ArtistSummaryContract[];
  readonly durationMs?: number;
  readonly albumContext?: AlbumContextSummaryContract;
  readonly artwork?: CatalogImageContract;
}

export type CatalogSearchResultContract =
  ArtistSearchResultContract | AlbumSearchResultContract | RecordingSearchResultContract;

export interface ArtistDetailContract {
  readonly kind: 'artist';
  readonly id: string;
  readonly canonicalName: string;
  readonly image?: CatalogImageContract;
}

export interface RecordingDetailSummaryContract {
  readonly id: string;
  readonly title: string;
  readonly artists: readonly ArtistSummaryContract[];
  readonly durationMs?: number;
  readonly position: number;
}

export interface AlbumDetailContract {
  readonly kind: 'album';
  readonly id: string;
  readonly title: string;
  readonly artists: readonly ArtistSummaryContract[];
  readonly originalReleaseYear?: number;
  readonly cover?: CatalogImageContract;
  readonly trackCount: number;
  readonly recordings: readonly RecordingDetailSummaryContract[];
}

export interface RecordingDetailContract {
  readonly kind: 'recording';
  readonly id: string;
  readonly title: string;
  readonly artists: readonly ArtistSummaryContract[];
  readonly durationMs?: number;
  readonly albumContexts: readonly AlbumContextSummaryContract[];
}

export type ConversationMessageRoleContract = 'user' | 'assistant';

export interface ConversationMessageContract {
  readonly id: string;
  readonly conversationId: string;
  readonly sequence: number;
  readonly role: ConversationMessageRoleContract;
  readonly content: string;
  readonly status: 'committed';
  readonly createdAt: string;
}

export interface YaraConversationContract {
  readonly id: string;
  readonly status: 'active' | 'archived';
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly messages: readonly ConversationMessageContract[];
  readonly activeRun?: AIExecutionRunContract;
}

export type AIExecutionRunStatusContract =
  'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AIExecutionRunContract {
  readonly id: string;
  readonly conversationId: string;
  readonly triggerMessageId: string;
  readonly status: AIExecutionRunStatusContract;
  readonly provider: string;
  readonly model: string;
  readonly failure?: { readonly code: string; readonly message: string };
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
}

export interface CreateConversationResponseContract {
  readonly conversation: YaraConversationContract;
}

export interface YaraConversationSummaryContract {
  readonly id: string;
  readonly updatedAt: string;
  readonly title: string;
  readonly preview: string;
  readonly messageCount: number;
  readonly lastMessageRole: ConversationMessageRoleContract;
  readonly activeRunId?: string;
  readonly activeRunStatus?: 'pending' | 'running';
}

export interface ListConversationsResponseContract {
  readonly conversations: readonly YaraConversationSummaryContract[];
}

export interface SendConversationMessageRequestContract {
  readonly content: string;
  readonly idempotencyKey: string;
}

export type StartConversationRequestContract = SendConversationMessageRequestContract;

export interface SendConversationMessageResponseContract {
  readonly conversationId: string;
  readonly messageId: string;
  readonly runId: string;
}

export interface AIExecutionRunResponseContract {
  readonly run: AIExecutionRunContract;
  readonly assistantMessage?: ConversationMessageContract;
}

export type YaraRunEventContract =
  | {
      readonly type: 'run.started';
      readonly data: {
        readonly provider: string;
        readonly model: string;
        readonly startedAt: string;
      };
    }
  | { readonly type: 'message.delta'; readonly data: { readonly delta: string } }
  | {
      readonly type: 'message.completed';
      readonly data: { readonly messageId: string; readonly createdAt: string };
    }
  | {
      readonly type: 'run.completed';
      readonly data: { readonly completedAt: string };
    }
  | {
      readonly type: 'run.failed';
      readonly data: { readonly code: string; readonly message: string; readonly failedAt: string };
    }
  | {
      readonly type: 'run.cancelled';
      readonly data: { readonly cancelledAt: string };
    };

export interface StoredYaraRunEventContract {
  readonly id: string;
  readonly sequence: number;
  readonly event: YaraRunEventContract;
  readonly createdAt: string;
}
