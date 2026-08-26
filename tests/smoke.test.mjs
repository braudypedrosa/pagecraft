/* The production smoke is intentionally read-only. A session cookie exists only after a real
   magic-link callback, so it cannot truthfully verify Secure without authenticating. This small
   contract test prevents the old vacuous check (`no cookie` counted as success) from returning. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('the read-only smoke marks Secure-cookie verification as unverified', () => {
  const source = readFileSync(join(root, 'tools', 'smoke.mjs'), 'utf8');
  a.match(source, /skip\('the session cookie is Secure'/,
    'a read-only probe must report the authenticated cookie check as skipped');
  a.doesNotMatch(source, /!set\s*\|\|\s*\/Secure/,
    'an absent Set-Cookie header must never count as proof of Secure');
  a.match(source, /covered by server\/tests\/auth\.test\.ts/,
    'the smoke must point at the authenticated in-process regression');
});
