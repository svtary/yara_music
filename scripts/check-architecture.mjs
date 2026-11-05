import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';

const root = process.cwd();
const sourceRoots = ['apps', 'packages'];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs']);

const rules = [
  {
    applies: (file) => file.startsWith(`packages${sep}domain-`),
    forbidden: [
      /^@nestjs\//,
      /^@fastify\//,
      /^fastify$/,
      /^next(?:\/|$)/,
      /^react(?:\/|$)/,
      /^react-dom(?:\/|$)/,
      /^antd$/,
      /^@ant-design\//,
      /^kysely$/,
      /^pg$/,
      /^postgres$/,
      /^@yara\/(?:application|ai-runtime|adapters-)/,
    ],
    reason: 'Domain packages must remain framework-free and cannot depend on outer layers.',
  },
  {
    applies: (file) => file.startsWith(`packages${sep}application${sep}`),
    forbidden: [/^@nestjs\//, /^next(?:\/|$)/, /^kysely$/, /^pg$/, /^@yara\/adapters-/],
    reason: 'Application cannot depend on delivery or infrastructure adapters.',
  },
  {
    applies: (file) => file.startsWith(`packages${sep}ai-runtime${sep}`),
    forbidden: [/^@yara\/domain-/, /^@yara\/adapters-/, /^@nestjs\//, /^next(?:\/|$)/],
    reason: 'AI Runtime cannot import owner repositories or delivery frameworks.',
  },
  {
    applies: (file) => file.startsWith(`apps${sep}web${sep}`),
    forbidden: [/^@yara\/domain-/, /^@yara\/adapters-/, /^@yara\/ai-runtime$/],
    reason: 'The Web/BFF surface cannot own Domain or infrastructure behavior.',
  },
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (['dist', 'node_modules', '.next'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (sourceExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = (
  await Promise.all(sourceRoots.map((directory) => collectFiles(join(root, directory))))
).flat();
const violations = [];

for (const absoluteFile of files) {
  const file = relative(root, absoluteFile);
  const content = await readFile(absoluteFile, 'utf8');
  const imports = [...content.matchAll(/(?:from\s+|import\s*\()['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  );
  for (const rule of rules.filter((candidate) => candidate.applies(file))) {
    for (const dependency of imports) {
      if (dependency && rule.forbidden.some((pattern) => pattern.test(dependency))) {
        violations.push(`${file}: forbidden import '${dependency}' — ${rule.reason}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Architecture dependency check passed (${files.length} source files scanned).`);
}
