import { Controller, Get, Inject, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { HealthResponse } from '@yara/contracts';
import type { FastifyReply } from 'fastify';

import { HealthService } from './health.service.js';

class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: ['api'] })
  public service!: 'api';

  @ApiProperty({ enum: ['ok', 'degraded'] })
  public status!: 'ok' | 'degraded';

  @ApiProperty()
  public version!: string;

  @ApiProperty({ format: 'date-time' })
  public timestamp!: string;

  @ApiProperty({
    required: false,
    type: Object,
    additionalProperties: { type: 'string', enum: ['ok', 'degraded'] },
  })
  public checks?: Readonly<Record<string, 'ok' | 'degraded'>>;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  public constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Process liveness' })
  @ApiOkResponse({ type: HealthResponseDto })
  public live(): HealthResponse {
    return this.healthService.live();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Database and extension readiness' })
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiServiceUnavailableResponse({ type: HealthResponseDto })
  public async ready(@Res({ passthrough: true }) response: FastifyReply): Promise<HealthResponse> {
    const health = await this.healthService.ready();
    if (health.status !== 'ok') response.status(503);
    return health;
  }
}
