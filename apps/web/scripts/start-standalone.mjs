import { spawn } from 'node:child_process';
import { cp, mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const webRoot = process.cwd();
const standaloneWebRoot = resolve(webRoot, '.next/standalone/apps/web');
const serverEntry = resolve(standaloneWebRoot, 'server.js');

async function copyIfPresent(source, destination) {
  try {
    await stat(source);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  await cp(source, destination, { recursive: true, force: true });
}

await stat(serverEntry);
await mkdir(resolve(standaloneWebRoot, '.next'), { recursive: true });
await copyIfPresent(resolve(webRoot, '.next/static'), resolve(standaloneWebRoot, '.next/static'));
await copyIfPresent(resolve(webRoot, 'public'), resolve(standaloneWebRoot, 'public'));

const child = spawn(process.execPath, [serverEntry], {
  env: {
    ...process.env,
    HOSTNAME: process.env.HOSTNAME ?? '0.0.0.0',
    PORT: process.env.WEB_PORT ?? process.env.PORT ?? '3000',
  },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => child.kill(signal));
}

child.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
