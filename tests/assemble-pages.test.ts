import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

test('combined publication keeps production and preview separate', (t) => {
  const temp = realpathSync(tmpdir());
  const fixture = mkdtempSync(join(temp, 'webar-pages-test-'));
  t.after(() => {
    const target = realpathSync(fixture);
    const name = relative(temp, target);
    assert(name.startsWith('webar-pages-test-') && !name.includes(sep));
    rmSync(target, { recursive: true });
  });
  const main = join(fixture, 'main'), preview = join(fixture, 'preview'), output = join(fixture, 'published');
  const write = (path: string, value: string) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); };
  write(join(main, 'index.html'), 'stable application');
  write(join(main, 'assets', 'app.js'), 'stable code');
  write(join(main, 'pre-release', 'index.html'), 'outdated snapshot');
  write(join(main, 'before-catalog', 'index.html'), 'historical application');
  write(join(preview, 'index.html'), 'preview application');
  write(join(preview, 'assets', 'app.js'), 'preview code');
  write(join(preview, 'pre-release', 'index.html'), 'nested snapshot');
  write(join(preview, 'before-catalog', 'index.html'), 'duplicate history');
  const script = fileURLToPath(new URL('../scripts/assemble-pages.mjs', import.meta.url));
  execFileSync(process.execPath, [script, main, preview, output], {
    env: { ...process.env, MAIN_COMMIT: 'stable-sha', PREVIEW_COMMIT: 'preview-sha' },
  });
  const read = (...path: string[]) => readFileSync(join(output, ...path), 'utf8');
  assert.equal(read('index.html'), 'stable application');
  assert.equal(read('assets', 'app.js'), 'stable code');
  assert.equal(read('pre-release', 'index.html'), 'preview application');
  assert.equal(read('pre-release', 'assets', 'app.js'), 'preview code');
  assert.equal(read('before-catalog', 'index.html'), 'historical application');
  assert(!existsSync(join(output, 'pre-release', 'pre-release')));
  assert(!existsSync(join(output, 'pre-release', 'before-catalog')));
  assert.deepEqual(JSON.parse(read('deployment.json')), { mainCommit: 'stable-sha', previewCommit: 'preview-sha' });
  assert.equal(JSON.parse(read('pre-release', 'version.json')).sourceCommit, 'preview-sha');
  assert.throws(() => execFileSync(process.execPath, [script, main, preview, output], { stdio: 'pipe' }));
  assert.throws(() => execFileSync(process.execPath, [script, main, preview, join(main, 'nested')], { stdio: 'pipe' }));
});
