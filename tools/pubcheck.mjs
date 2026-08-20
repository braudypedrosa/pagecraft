/* Is the published Artifact the copy this repo would produce?

   Publishing is an agent action with no CLI, so nothing can automate it. What can
   be automated is *knowing* — the live copy went stale twice, once by six commits,
   because "republish after changing builder.html" lived only in a note. This turns
   that note into a fact the build reports and a hook repeats.

   The record is `dist/PUBLISHED.json`, tracked, holding the sha256 of the
   `dist/artifact.html` that was actually published. The comparison is sound because
   `build.mjs` is byte-deterministic: the same `builder.html` and the same vendored
   fonts produce the same output, with no timestamps anywhere.

   One implementation, three callers:
     build.mjs               prints the one-line status after every build
     npm run publish:check   exits 1 when stale, so it can gate anything
     tools/hooks/post-commit prints it at the moment you would forget
*/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACT = join(here, 'dist', 'artifact.html');
const RECORD = join(here, 'dist', 'PUBLISHED.json');

const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');

/* git is a nicety here, not a dependency: a shallow clone, a missing history or no
   git at all costs the commit-distance line and nothing else. */
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
};

export function status() {
  if (!existsSync(ARTIFACT)) return { state: 'no-build' };
  const now = sha(ARTIFACT);
  if (!existsSync(RECORD)) return { state: 'never', now };

  let rec = null;
  try { rec = JSON.parse(readFileSync(RECORD, 'utf8')); } catch { return { state: 'unreadable', now }; }
  const head = git('rev-parse', '--short', 'HEAD');
  const behind = rec.commit ? git('rev-list', '--count', `${rec.commit}..HEAD`) : '';

  return {
    state: rec.sha256 === now ? 'current' : 'stale',
    now, head, behind, ...rec
  };
}

/* One line when there is nothing to do, and something you cannot miss when there is.
   The commit distance is what made this concrete the second time — "stale" reads as a
   nag, "six commits behind" reads as a fact. */
export function report(s = status()) {
  const S = '\x1b[0m', B = '\x1b[1m', Y = '\x1b[33m', G = '\x1b[32m', D = '\x1b[2m';
  if (s.state === 'no-build') return `${Y}Artifact: no dist/artifact.html — run the build first${S}`;
  if (s.state === 'current') {
    const from = s.commit ? ` from ${s.commit}` : '';
    return `${G}Artifact: up to date${S}${D} — published ${s.publishedAt || 'at some point'}${from}${S}`;
  }
  const lines = [];
  /* the distance is a nicety — git may be shallow or absent — so its clause drops out
     entirely rather than degrading to "STALE — out of date", which says it twice */
  const how = s.behind && s.behind !== '0'
    ? ` — ${s.behind} commit${s.behind === '1' ? '' : 's'} behind`
    : '';
  if (s.state === 'never') lines.push(`${Y}${B}Artifact: never published from this repo.${S}`);
  else if (s.state === 'unreadable') lines.push(`${Y}${B}Artifact: dist/PUBLISHED.json will not parse.${S}`);
  else lines.push(`${Y}${B}Artifact is STALE${how}${s.commit ? ` (published from ${s.commit})` : ''}.${S}`);
  if (s.url) lines.push(`${D}  live${S}   ${s.url}`);
  lines.push(`${D}  fix${S}    republish dist/artifact.html to that URL, then: npm run publish:stamp`);
  if (s.capabilities) lines.push(`${D}  keep${S}   capabilities ${JSON.stringify(s.capabilities)} · contract ${s.contract || '?'} · favicon ${s.favicon || '?'}`);
  return lines.join('\n');
}

/* Stamp only what is on disk right now. It records the hash of the file that was
   published, so running this without having published is the one way to make the
   check lie — which is why it is a separate, deliberate command and not part of
   the build. */
export function stamp(url) {
  const rec = existsSync(RECORD) ? JSON.parse(readFileSync(RECORD, 'utf8')) : {};
  const next = {
    url: url || rec.url || '',
    sha256: sha(ARTIFACT),
    /* The commit that last touched whatever actually feeds the artifact — not HEAD,
       so "published from X" stays true even when the stamp lands in a later commit
       of its own. That used to be builder.html alone; since the core moved to
       TypeScript it is both, and tracking only builder.html made this record name
       the wrong commit the first time a core-only change shipped. */
    commit: git('log', '-1', '--format=%h', '--', 'builder.html', 'app/src/core') || null,
    publishedAt: new Date().toISOString().slice(0, 10),
    favicon: rec.favicon || '📐',
    contract: rec.contract || '0.2.4',
    capabilities: rec.capabilities || ['downloads'],
    note: 'sha256 is of dist/artifact.html as published. build.mjs is byte-deterministic, so a mismatch means the live copy is behind. Written by `npm run publish:stamp`.'
  };
  writeFileSync(RECORD, JSON.stringify(next, null, 2) + '\n');
  return next;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2] || '';
  if (arg === 'stamp') {
    const url = (process.argv[3] || '').trim();
    const rec = stamp(url);
    if (!rec.url) {
      console.error('No artifact URL recorded. Pass one: npm run publish:stamp -- <url>');
      process.exit(1);
    }
    console.log(`Stamped ${rec.sha256.slice(0, 12)}… at ${rec.commit || 'unknown commit'} → ${rec.url}`);
    process.exit(0);
  }
  const s = status();
  console.log(report(s));
  /* --hook never fails: a post-commit hook that exits non-zero is noise, and the
     commit has already happened by then anyway. */
  if (arg !== '--hook' && s.state !== 'current') process.exit(1);
}
