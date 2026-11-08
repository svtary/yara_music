import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Sse,
  UnprocessableEntityException,
  type MessageEvent,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  AIExecutionRunNotFoundError,
  ConversationInputError,
  ConversationNotFoundError,
} from '@yara/application';
import type {
  ConversationApplicationService,
  ConversationExecutionService,
} from '@yara/application';
import type { ApiConfig } from '@yara/config';
import type {
  AIExecutionRunResponseContract,
  CreateConversationResponseContract,
  ListConversationsResponseContract,
  SendConversationMessageResponseContract,
} from '@yara/contracts';
import { Observable } from 'rxjs';

import { API_CONFIG, CONVERSATION_APPLICATION, CONVERSATION_EXECUTION } from './tokens.js';
import {
  AIExecutionRunResponseDto,
  CreateConversationResponseDto,
  ListConversationsResponseDto,
  SendConversationMessageDto,
  SendConversationMessageResponseDto,
  YaraConversationDto,
} from './yara.dto.js';
import { presentConversation, presentConversationSummary, presentRun } from './yara.presenter.js';

function cursor(value: string | undefined): number {
  if (value === undefined || value === '') return 0;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new UnprocessableEntityException('Last-Event-ID must be a non-negative integer.');
  }
  return parsed;
}

function historyLimit(value: string | undefined): number {
  if (value === undefined || value === '') return 20;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new UnprocessableEntityException('Conversation history limit must be between 1 and 50.');
  }
  return parsed;
}

function translateError(error: unknown): never {
  if (error instanceof ConversationNotFoundError || error instanceof AIExecutionRunNotFoundError) {
    throw new NotFoundException(error.message);
  }
  if (error instanceof ConversationInputError) {
    throw new UnprocessableEntityException(error.message);
  }
  throw error;
}

@ApiTags('yara')
@Controller()
export class YaraController {
  public constructor(
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    @Inject(CONVERSATION_APPLICATION)
    private readonly conversations: ConversationApplicationService,
    @Inject(CONVERSATION_EXECUTION)
    private readonly execution: ConversationExecutionService,
  ) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Create an owned Yara conversation' })
  @ApiCreatedResponse({ type: CreateConversationResponseDto })
  public async createConversation(): Promise<CreateConversationResponseContract> {
    return {
      conversation: presentConversation(await this.conversations.create(this.config.yaraActorRef)),
    };
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List recent meaningful Yara conversations for the current owner' })
  @ApiQuery({ name: 'limit', required: false, type: Number, minimum: 1, maximum: 50 })
  @ApiOkResponse({ type: ListConversationsResponseDto })
  public async listConversations(
    @Query('limit') limit?: string,
  ): Promise<ListConversationsResponseContract> {
    return {
      conversations: (
        await this.conversations.list(this.config.yaraActorRef, historyLimit(limit))
      ).map(presentConversationSummary),
    };
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Read durable committed conversation state' })
  @ApiOkResponse({ type: YaraConversationDto })
  @ApiNotFoundResponse()
  public async getConversation(@Param('id') id: string) {
    try {
      return presentConversation(await this.conversations.get(this.config.yaraActorRef, id));
    } catch (error) {
      return translateError(error);
    }
  }

  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Commit a user message and start a separate AI execution run' })
  @ApiAcceptedResponse({ type: SendConversationMessageResponseDto })
  @ApiBody({ type: SendConversationMessageDto })
  public async sendMessage(
    @Param('id') id: string,
    @Body() body: SendConversationMessageDto,
  ): Promise<SendConversationMessageResponseContract> {
    try {
      const receipt = await this.conversations.send(this.config.yaraActorRef, id, body.content);
      void this.execution.execute(receipt.runId).catch(() => {
        console.error(
          JSON.stringify({ event: 'ai.execution.dispatch_failed', runId: receipt.runId }),
        );
      });
      return receipt;
    } catch (error) {
      return translateError(error);
    }
  }

  @Get('ai-runs/:id')
  @ApiOperation({ summary: 'Poll the authoritative AI execution run state' })
  @ApiOkResponse({ type: AIExecutionRunResponseDto })
  public async getRun(@Param('id') id: string): Promise<AIExecutionRunResponseContract> {
    try {
      return presentRun(await this.conversations.getRun(this.config.yaraActorRef, id));
    } catch (error) {
      return translateError(error);
    }
  }

  @Post('ai-runs/:id/cancel')
  @ApiOperation({
    summary: 'Cancel a pending or running execution without treating disconnect as cancel',
  })
  @ApiOkResponse({ type: AIExecutionRunResponseDto })
  public async cancelRun(@Param('id') id: string): Promise<AIExecutionRunResponseContract> {
    try {
      const view = await this.conversations.cancel(this.config.yaraActorRef, id);
      this.execution.abort(view.run.id);
      return presentRun(view);
    } catch (error) {
      return translateError(error);
    }
  }

  @Sse('ai-runs/:id/events')
  @ApiOperation({ summary: 'Stream replayable Yara-owned run events using SSE sequence cursors' })
  public streamRun(
    @Param('id') id: string,
    @Headers('last-event-id') lastEventId?: string,
  ): Observable<MessageEvent> {
    const initialCursor = cursor(lastEventId);
    return new Observable<MessageEvent>((subscriber) => {
      let afterSequence = initialCursor;
      let closed = false;
      let polling = false;

      const poll = async (): Promise<void> => {
        if (closed || polling) return;
        polling = true;
        try {
          const events = await this.conversations.listEvents(
            this.config.yaraActorRef,
            id,
            afterSequence,
          );
          for (const stored of events) {
            afterSequence = stored.sequence;
            subscriber.next({
              id: String(stored.sequence),
              type: stored.event.type,
              data: stored.event,
            });
            if (
              stored.event.type === 'run.completed' ||
              stored.event.type === 'run.failed' ||
              stored.event.type === 'run.cancelled'
            ) {
              closed = true;
              subscriber.complete();
              return;
            }
          }
        } catch (error) {
          closed = true;
          subscriber.error(error);
        } finally {
          polling = false;
        }
      };

      void poll();
      const pollTimer = setInterval(() => void poll(), 250);
      const heartbeatTimer = setInterval(() => {
        if (!closed)
          subscriber.next({ type: 'heartbeat', data: { timestamp: new Date().toISOString() } });
      }, 15_000);
      return () => {
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
      };
    });
  }
}
