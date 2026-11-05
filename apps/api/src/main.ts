import 'reflect-metadata';

import { readApiConfig } from '@yara/config';

import { createApplication } from './application.js';

const config = readApiConfig(process.env);
const application = await createApplication(config);
await application.listen({ host: config.host, port: config.port });
console.log(`Yara API listening on http://${config.host}:${config.port}`);
