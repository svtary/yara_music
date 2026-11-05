import { lstat, readdir, realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const canonicalFiles = [
  'AGENTS.md',
  'PLANS.md',
  'docs/INDEX.md',
  'docs/product/YARA_MASTER_CONTEXT.md',
  'docs/product/DECISIONS.md',
  'docs/project/CURRENT_TASK.md',
  'docs/design/execution/08_HIGHFI_EXECUTION_BASELINE.md',
  'docs/design/assets/generated/yara-home-hero-shoegaze.png',
  'docs/reference/SOURCE_INDEX.md',
  'docs/technical/Yara-Technical-Design.md',
  'docs/technical/TECHNICAL_DESIGN_TOC.md',
];

const expectedBaselines = [
  '01_ARCHITECTURE_BASELINE.md',
  '02_PAGE_ARCHITECTURE.md',
  '03_NAVIGATION_SPEC.md',
  '04_USER_FLOWS.md',
  '05_BUSINESS_FLOWS.md',
  '06_LOWFI_SPEC.md',
  '07_SIGNATURE_UI.md',
];

const legacyAliases = new Map([
  ['YARA_MASTER_CONTEXT.md', 'docs/product/YARA_MASTER_CONTEXT.md'],
  ['DECISIONS.md', 'docs/product/DECISIONS.md'],
  ['CURRENT_TASK.md', 'docs/project/CURRENT_TASK.md'],
  ['baselines', 'docs/product/baselines'],
  ['execution', 'docs/design/execution'],
  ['assets', 'docs/design/assets'],
  ['reference', 'docs/reference'],
]);

const failures = [];

for (const path of canonicalFiles) {
  try {
    const metadata = await stat(resolve(root, path));
    if (!metadata.isFile() || metadata.size === 0) failures.push(`${path}: missing file content`);
  } catch {
    failures.push(`${path}: missing canonical file`);
  }
}

try {
  const actualBaselines = (await readdir(resolve(root, 'docs/product/baselines')))
    .filter((name) => name.endsWith('.md'))
    .sort();
  if (JSON.stringify(actualBaselines) !== JSON.stringify(expectedBaselines)) {
    failures.push(
      `docs/product/baselines: expected ${expectedBaselines.join(', ')}, found ${actualBaselines.join(', ')}`,
    );
  }
} catch {
  failures.push('docs/product/baselines: missing canonical baseline directory');
}

for (const [alias, target] of legacyAliases) {
  try {
    const aliasPath = resolve(root, alias);
    const targetPath = resolve(root, target);
    const aliasMetadata = await lstat(aliasPath);
    if (!aliasMetadata.isSymbolicLink()) {
      failures.push(`${alias}: expected a compatibility symlink`);
      continue;
    }
    if ((await realpath(aliasPath)) !== (await realpath(targetPath))) {
      failures.push(`${alias}: does not resolve to ${target}`);
    }
  } catch {
    failures.push(`${alias}: missing or broken compatibility alias for ${target}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Context integrity check passed (${canonicalFiles.length} canonical files, ${expectedBaselines.length} product baselines, ${legacyAliases.size} compatibility aliases).`,
  );
}
