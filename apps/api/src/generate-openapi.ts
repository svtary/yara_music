import 'reflect-metadata';

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { SwaggerModule } from '@nestjs/swagger';
import { readApiConfig } from '@yara/config';

import { createApplication } from './application.js';

const config = readApiConfig({
  ...process.env,
  DATABASE_URL:
    process.env['DATABASE_URL'] ?? 'postgresql://openapi:openapi@localhost:5432/openapi',
});
const application = await createApplication(config);
await application.init();

const document = SwaggerModule.createDocument(application, {
  openapi: '3.0.0',
  info: { title: 'Yara API', version: '0.0.0' },
});
const outputDirectory = resolve(process.cwd(), '../../packages/contracts/openapi');
const outputFile = resolve(outputDirectory, 'yara.openapi.json');
await mkdir(outputDirectory, { recursive: true });
await writeFile(outputFile, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
await application.close();
console.log(outputFile);
