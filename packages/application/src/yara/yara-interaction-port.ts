import type {
  AIExecutionFailure,
  AIExecutionRun,
  AIExecutionRunId,
  ModelUsage,
} from '@yara/ai-runtime';
import type {
  ConversationId,
  ConversationMessage,
  MessageId,
  YaraConversation,
} from '@yara/domain-yara-interaction';

export type YaraRunEvent =
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
      readonly data: { readonly completedAt: string; readonly usage?: ModelUsage };
    }
  | {
      readonly type: 'run.failed';
      readonly data: {
        readonly code: string;
        readonly message: string;
        readonly failedAt: string;
      };
    }
  | {
      readonly type: 'run.cancelled';
      readonly data: { readonly cancelledAt: string };
    };

export interface StoredYaraRunEvent {
  readonly runId: AIExecutionRunId;
  readonly sequence: number;
  readonly event: YaraRunEvent;
  readonly createdAt: Date;
}

export interface AIExecutionRunView {
  readonly run: AIExecutionRun;
  readonly assistantMessage?: ConversationMessage;
}

export interface YaraConversationSummaryView {
  readonly id: ConversationId;
  readonly updatedAt: Date;
  readonly title: string;
  readonly preview: string;
  readonly messageCount: number;
  readonly lastMessageRole: 'user' | 'assistant';
}

export interface YaraInteractionPersistencePort {
  createConversation(ownerRef: string, conversation: YaraConversation): Promise<void>;
  getConversation(conversationId: ConversationId): Promise<YaraConversation | null>;
  getConversationForOwner(
    ownerRef: string,
    conversationId: ConversationId,
  ): Promise<YaraConversation | null>;
  listMeaningfulConversationsForOwner(
    ownerRef: string,
    limit: number,
  ): Promise<readonly YaraConversation[]>;
  acceptUserMessageAndRun(input: {
    readonly ownerRef: string;
    readonly messageId: MessageId;
    readonly conversationId: ConversationId;
    readonly content: string;
    readonly createdAt: Date;
    readonly run: AIExecutionRun;
  }): Promise<{ readonly message: ConversationMessage; readonly run: AIExecutionRun }>;
  getRun(runId: AIExecutionRunId): Promise<AIExecutionRunView | null>;
  getRunForOwner(ownerRef: string, runId: AIExecutionRunId): Promise<AIExecutionRunView | null>;
  startRun(runId: AIExecutionRunId, startedAt: Date): Promise<AIExecutionRun | null>;
  appendRunEvent(
    runId: AIExecutionRunId,
    event: YaraRunEvent,
    createdAt: Date,
  ): Promise<StoredYaraRunEvent | null>;
  completeRunWithAssistantMessage(input: {
    readonly runId: AIExecutionRunId;
    readonly messageId: MessageId;
    readonly content: string;
    readonly finishedAt: Date;
    readonly providerResponseId?: string;
    readonly usage?: ModelUsage;
  }): Promise<AIExecutionRunView | null>;
  failRun(
    runId: AIExecutionRunId,
    failure: AIExecutionFailure,
    finishedAt: Date,
  ): Promise<AIExecutionRun | null>;
  cancelRunForOwner(
    ownerRef: string,
    runId: AIExecutionRunId,
    finishedAt: Date,
  ): Promise<AIExecutionRunView | null>;
  listRunEventsForOwner(input: {
    readonly ownerRef: string;
    readonly runId: AIExecutionRunId;
    readonly afterSequence: number;
    readonly limit: number;
  }): Promise<readonly StoredYaraRunEvent[]>;
}

export interface AIExecutionObservation {
  readonly conversationId: string;
  readonly runId: string;
  readonly provider: string;
  readonly model: string;
  readonly status: 'running' | 'completed' | 'failed' | 'cancelled';
  readonly durationMs?: number;
  readonly failureCode?: string;
}

export interface AIExecutionObserverPort {
  record(observation: AIExecutionObservation): void;
}
