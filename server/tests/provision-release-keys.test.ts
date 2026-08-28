import { strict as a } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const tool = join(here, '..', 'tools', 'provision-release-keys.mjs');

test('test release keys are written once to a protected file without printing secrets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pagecraft-release-keys-'));
  const output = join(directory, 'test-release.json');
  try {
    const first = spawnSync(process.execPath, [tool, '--profile', 'test', '--output', output], {
      encoding: 'utf8'
    });
    a.equal(first.status, 0, first.stderr);
    a.match(first.stdout, /written securely for the test profile/);
    a.doesNotMatch(first.stdout, /PRIVATE|PAGECRAFT_RELEASE_PRIVATE_KEY|rootPrivateKey/);
    a.equal(statSync(output).mode & 0o777, 0o600);

    const record = JSON.parse(readFileSync(output, 'utf8')) as Record<string, any>;
    a.equal(record.profile, 'test');
    a.equal(record.importer.rootKeyId, 'pagecraft-test-root-v1');
    a.equal(record.runtime.PAGECRAFT_RELEASE_KEY_ID, 'pagecraft-test-release-v1');
    a.equal(typeof record.runtime.PAGECRAFT_KEYSET_ENVELOPE_BASE64URL, 'string');
    a.equal(record.runtime.PAGECRAFT_KEYSET_ENVELOPE, undefined);
    const envelope = JSON.parse(Buffer.from(
      record.runtime.PAGECRAFT_KEYSET_ENVELOPE_BASE64URL, 'base64url'
    ).toString('utf8')) as Record<string, unknown>;
    a.equal(envelope.rootKeyId, 'pagecraft-test-root-v1');
    a.equal(typeof record.offline.rootPrivateKey, 'string');
    a.equal(typeof record.runtime.PAGECRAFT_RELEASE_PRIVATE_KEY, 'string');

    const second = spawnSync(process.execPath, [tool, '--profile', 'test', '--output', output], {
      encoding: 'utf8'
    });
    a.notEqual(second.status, 0, 'the provisioning tool must never overwrite an existing trust file');

    const unsafe = spawnSync(process.execPath, [tool, '--profile', 'test'], { encoding: 'utf8' });
    a.notEqual(unsafe.status, 0, 'secret material must never be printed when --output is omitted');
    a.equal(unsafe.stdout, '');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
