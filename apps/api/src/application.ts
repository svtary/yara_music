import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { ApiConfig } from '@yara/config';

import { AppModule } from './app.module.js';

export async function createApplication(config: ApiConfig): Promise<NestFastifyApplication> {
  const application = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(config),
    new FastifyAdapter({ logger: false }),
  );
  application.enableShutdownHooks();

  const openApiConfig = new DocumentBuilder()
    .setTitle('Yara API')
    .setDescription('MVP-0 canonical API contract baseline')
    .setVersion('0.0.0')
    .build();
  const document = SwaggerModule.createDocument(application, openApiConfig);
  SwaggerModule.setup('docs', application, document, { jsonDocumentUrl: 'docs/openapi.json' });

  return application;
}
