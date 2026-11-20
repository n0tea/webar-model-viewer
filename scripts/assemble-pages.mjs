import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, join } from 'node:path';

// Each Pages deployment replaces the site. Always assemble both branches together.
const [mainArg, previewArg, outputArg] = process.argv.slice(2);
if (!mainArg || !previewArg || !outputArg) {
  throw new Error('Usage: node scripts/assemble-pages.mjs MAIN_DIST PREVIEW_DIST NEW_OUTPUT');
}
const main = resolve(mainArg), preview = resolve(previewArg), output = resolve(outputArg);
const contains = (parent, child) => {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
};
for (const input of [main, preview]) {
  if (!existsSync(join(input, 'index.html'))) throw new Error(`Missing built application: ${input}`);
  if (contains(input, output) || contains(output, input)) throw new Error('Output must be separate from input directories');
}
if (existsSync(output)) throw new Error('Output already exists; choose a fresh directory');

function copyApplication(input, target, excluded) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(input, { withFileTypes: true })) {
    if (excluded.includes(entry.name)) continue;
    cpSync(join(input, entry.name), join(target, entry.name), { recursive: true });
  }
}
copyApplication(main, output, ['pre-release']);
copyApplication(preview, join(output, 'pre-release'), ['pre-release', 'before-catalog']);
const version = {
  mainCommit: process.env.MAIN_COMMIT || 'local',
  previewCommit: process.env.PREVIEW_COMMIT || 'local',
};
writeFileSync(join(output, 'deployment.json'), JSON.stringify(version, null, 2) + '\n');
writeFileSync(join(output, 'pre-release', 'version.json'), JSON.stringify({
  sourceBranch: 'pre-release', sourceCommit: version.previewCommit, publication: 'branch-build',
}, null, 2) + '\n');
console.log('Assembled main at / and pre-release at /pre-release/');
