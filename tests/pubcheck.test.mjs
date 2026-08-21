/* Tests for tools/pubcheck.mjs — the thing that tells you the published Artifact has
   gone stale. It had none, which was the last untested piece of logic added in this
   session, and untested logic is exactly what produced the `snippet` offset bug.

   `report()` is pure — a status object in, a string out — so most of this needs no
   fixtures. The exit codes are the contract `npm run publish:check` and the
   post-commit hook depend on, so those are checked by actually running the CLI.

   What is still not covered, deliberately: the fs and git plumbing inside `status()`
   for the missing-file and unparseable-record paths. Reaching those means either
   moving the real dist/ aside or making the paths injectable, and neither is worth
   it for two branches whose messages are asserted below anyway. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { status, report } from '../tools/pubcheck.mjs';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
/* the messages carry terminal colour, which is not what any of these assert */
const plain = s => s.replace(/\x1b\[\d+m/g, '');
const say = s => plain(report(s));

const BASE = {
  url: 'https://example.com/hosted/abc',
  sha256: 'a'.repeat(64),
  commit: 'deadbee',
  publishedAt: '2026-08-20',
  favicon: '📐',
  contract: '0.2.4',
  capabilities: ['downloads']
};

test('up to date says so in one line, and names what it was published from', () => {
  const out = say({ ...BASE, state: 'current' });
  a.match(out, /^Artifact: up to date/);
  a.match(out, /published 2026-08-20 from deadbee/);
  a.equal(out.split('\n').length, 1, 'nothing to do, so nothing to read');
  a.equal(/STALE|republish/.test(out), false);
});

test('stale carries the distance, the URL, the fix and the things that live only on the artifact', () => {
  const out = say({ ...BASE, state: 'stale', behind: '3' });
  a.match(out, /Artifact is STALE — 3 commits behind \(published from deadbee\)/);
  a.match(out, /https:\/\/example\.com\/hosted\/abc/);
  a.match(out, /npm run publish:stamp/);
  /* favicon, contract and capabilities exist nowhere in the repo, so the one moment
     they are needed is the moment you are about to republish */
  a.match(out, /capabilities \["downloads"\] · contract 0\.2\.4 · favicon 📐/);
});

test('one commit behind is not "1 commits"', () => {
  a.match(say({ ...BASE, state: 'stale', behind: '1' }), /1 commit behind/);
  a.match(say({ ...BASE, state: 'stale', behind: '2' }), /2 commits behind/);
});

test('with no commit distance the clause drops out rather than saying it twice', () => {
  /* git is a nicety here: a shallow clone or no git at all costs this line and
     nothing else. It must not read as "0 commits behind", and it must not read as
     "STALE — out of date" either, which is the same thing said twice. */
  ['0', '', undefined].forEach(behind => {
    const out = say({ ...BASE, state: 'stale', behind });
    a.match(out, /^Artifact is STALE \(published from deadbee\)\.$/m);
    a.equal(/out of date/.test(out), false);
    a.equal(/behind/.test(out), false);
  });
});

test('a record with no commit does not claim one', () => {
  const out = say({ ...BASE, commit: null, state: 'stale', behind: '2' });
  a.equal(/published from/.test(out), false);
  a.match(out, /2 commits behind\./);
});

test('never published, and an unreadable record, each say which', () => {
  a.match(say({ ...BASE, state: 'never' }), /never published from this repo/);
  a.match(say({ ...BASE, state: 'unreadable' }), /dist\/PUBLISHED\.json will not parse/);
  /* both still tell you what to do next */
  a.match(say({ ...BASE, state: 'never' }), /npm run publish:stamp/);
});

test('no build at all is its own message, and does not talk about staleness', () => {
  const out = say({ state: 'no-build' });
  a.match(out, /no dist\/artifact\.html — run the build first/);
  a.equal(/STALE|publish:stamp/.test(out), false);
});

test('a status with no url or capabilities omits those lines rather than printing blanks', () => {
  const out = say({ state: 'stale', sha256: 'x', behind: '1' });
  a.equal(/live/.test(out), false);
  a.equal(/capabilities/.test(out), false);
  a.match(out, /npm run publish:stamp/, 'the fix is always worth saying');
});

/* ---- against the real repo -------------------------------------------
   These assert the *relationship* between the record and the file, never that the
   artifact happens to be published right now. Asserting 'current' would make
   `npm test` fail the moment anyone edits builder.html — which is precisely the
   coupling the staleness check was kept out of `npm test` to avoid. A stale artifact
   is a chore, not a broken build. */
test('status() hashes the file that is actually on disk', () => {
  const s = status();
  const onDisk = createHash('sha256').update(readFileSync(join(here, 'dist', 'artifact.html'))).digest('hex');
  a.equal(s.now, onDisk, 'no stale cache, no second implementation of the hash');
  /* an absolute URL is the invariant; pinning the host would make the suite fail the
     day the copy is published somewhere else */
  a.match(s.url, /^https:\/\/\S+$/, 'the record carries an absolute URL');
});

test('the state is exactly whether the record matches the file', () => {
  const s = status();
  a.equal(s.state, s.sha256 === s.now ? 'current' : 'stale',
    'nothing else decides it — not the commit distance, not the date');
  a.ok(['current', 'stale'].includes(s.state), 'the repo has both a build and a record');
});

test('--hook never fails, whatever the state', () => {
  /* the commit has already happened by the time a post-commit hook runs, so a
     non-zero exit is pure noise. This one holds even when the artifact is stale. */
  const run = args => {
    try {
      execFileSync('node', [join(here, 'tools', 'pubcheck.mjs'), ...args], { cwd: here, stdio: 'pipe' });
      return 0;
    } catch (e) { return e.status; }
  };
  a.equal(run(['--hook']), 0);
  /* and the gating form agrees with the state rather than always passing */
  a.equal(run([]), status().state === 'current' ? 0 : 1);
});
