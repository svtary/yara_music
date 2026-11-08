import type {
  ModelExecutionRequest,
  ModelProviderEvent,
  ModelProviderPort,
} from './model-provider.js';

export interface AgentRuntimePort {
  execute(request: ModelExecutionRequest): AsyncIterable<ModelProviderEvent>;
}

/** Stage 2 pass-through runtime. It owns no Conversation, Domain, Memory, tool, or result authority. */
export class ControlledAgentRuntime implements AgentRuntimePort {
  public constructor(private readonly modelProvider: ModelProviderPort) {}

  public execute(request: ModelExecutionRequest): AsyncIterable<ModelProviderEvent> {
    return this.modelProvider.stream(request);
  }
}
