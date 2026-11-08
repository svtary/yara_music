import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConversationMessageDto {
  @ApiProperty() id!: string;
  @ApiProperty() conversationId!: string;
  @ApiProperty() sequence!: number;
  @ApiProperty({ enum: ['user', 'assistant'] }) role!: 'user' | 'assistant';
  @ApiProperty() content!: string;
  @ApiProperty({ enum: ['committed'] }) status!: 'committed';
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class YaraConversationDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['active', 'archived'] }) status!: 'active' | 'archived';
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: () => [ConversationMessageDto] }) messages!: ConversationMessageDto[];
}

export class CreateConversationResponseDto {
  @ApiProperty({ type: () => YaraConversationDto }) conversation!: YaraConversationDto;
}

export class YaraConversationSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty() title!: string;
  @ApiProperty() preview!: string;
  @ApiProperty({ minimum: 1 }) messageCount!: number;
  @ApiProperty({ enum: ['user', 'assistant'] }) lastMessageRole!: 'user' | 'assistant';
}

export class ListConversationsResponseDto {
  @ApiProperty({ type: () => [YaraConversationSummaryDto] })
  conversations!: YaraConversationSummaryDto[];
}

export class SendConversationMessageDto {
  @ApiProperty({ minLength: 1, maxLength: 4000, example: 'Why does this song feel so spacious?' })
  content!: string;
}

export class SendConversationMessageResponseDto {
  @ApiProperty() conversationId!: string;
  @ApiProperty() messageId!: string;
  @ApiProperty() runId!: string;
}

export class AIExecutionFailureDto {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
}

export class AIExecutionRunDto {
  @ApiProperty() id!: string;
  @ApiProperty() conversationId!: string;
  @ApiProperty() triggerMessageId!: string;
  @ApiProperty({ enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] })
  status!: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  @ApiProperty() provider!: string;
  @ApiProperty() model!: string;
  @ApiPropertyOptional({ type: () => AIExecutionFailureDto }) failure?: AIExecutionFailureDto;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiPropertyOptional({ format: 'date-time' }) startedAt?: string;
  @ApiPropertyOptional({ format: 'date-time' }) finishedAt?: string;
}

export class AIExecutionRunResponseDto {
  @ApiProperty({ type: () => AIExecutionRunDto }) run!: AIExecutionRunDto;
  @ApiPropertyOptional({ type: () => ConversationMessageDto })
  assistantMessage?: ConversationMessageDto;
}
