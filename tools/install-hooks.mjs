/* Points git at tools/hooks, which is tracked — .git/hooks is not, so a clone has
   no hooks until someone asks for them.

   `core.hooksPath` is a whole-repository setting, so this refuses rather than clobbers: if a
   hooks path is already configured, or .git/hooks holds anything real, it says what it found
   and changes nothing. Losing someone's pre-commit hook to a convenience script would be a
   poor trade for a staleness warning. (It used to share a repository with an unrelated Next.js
   app, which is where that caution came from; the caution outlived the arrangement.) */
import { readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...a) => {
  try {
    return execFileSync('git', a, { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
};

const root = git('rev-parse', '--show-toplevel');
if (!root) {
  console.error('Not a git repository — nothing to install into.');
  process.exit(1);
}
const want = relative(root, join(here, 'tools', 'hooks')).split('\\').join('/');
const have = git('config', '--get', 'core.hooksPath');

if (have === want) {
  console.log(`Already installed: core.hooksPath -> ${want}`);
  process.exit(0);
}
if (have) {
  console.error(`core.hooksPath is already set to "${have}".`);
  console.error(`Refusing to change it. Add a post-commit line to that directory yourself:`);
  console.error(`  node ${want.replace('/hooks', '')}/pubcheck.mjs --hook`);
  process.exit(1);
}

const dir = join(root, '.git', 'hooks');
const real = existsSync(dir)
  ? readdirSync(dir).filter(f => !f.endsWith('.sample'))
  : [];
if (real.length) {
  console.error(`.git/hooks already holds: ${real.join(', ')}`);
  console.error(`Setting core.hooksPath would stop those running. Refusing.`);
  console.error(`Add this to .git/hooks/post-commit instead:`);
  console.error(`  node "$(git rev-parse --show-toplevel)"/${want.replace('/hooks', '')}/pubcheck.mjs --hook`);
  process.exit(1);
}

git('config', 'core.hooksPath', want);
if (git('config', '--get', 'core.hooksPath') !== want) {
  console.error('git config did not take. Nothing installed.');
  process.exit(1);
}
console.log(`Installed: core.hooksPath -> ${want}`);
console.log('post-commit now warns when a commit changes builder.html while the published Artifact still shows the old one.');
