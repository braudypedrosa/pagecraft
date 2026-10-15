import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveEditorVersion } from './version.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
const editorVersion = resolveEditorVersion(packageJson.version);
const destinationFlag = process.argv.indexOf('--pack-destination');
const destination = resolve(destinationFlag >= 0 && process.argv[destinationFlag + 1]
  ? process.argv[destinationFlag + 1]
  : process.cwd());

execFileSync(process.execPath, [join(here, 'build.mjs')], { cwd: resolve(here, '../..'), stdio: 'inherit' });
mkdirSync(destination, { recursive: true });
const staging = mkdtempSync(join(tmpdir(), 'pagecraft-editor-pack-'));
try {
  writeFileSync(join(staging, 'package.json'), JSON.stringify({
    ...packageJson,
    version: editorVersion,
  }, null, 2) + '\n');
  cpSync(join(here, 'README.md'), join(staging, 'README.md'));
  cpSync(join(here, 'dist'), join(staging, 'dist'), { recursive: true });
  execFileSync('npm', ['pack', staging, '--pack-destination', destination], { stdio: 'inherit' });
} finally {
  rmSync(staging, { recursive: true, force: true });
}
