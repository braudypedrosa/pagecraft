/* CloudLinux requires a physical application root for its Node environment.
   Only the release pointer inside that fixed root is switched. The original
   source remains available for rollback before the first successful release. */
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const entry = existsSync(join(__dirname, 'current/server/src/index.ts'))
  ? './current/server/src/index.ts'
  : './server/src/index.ts';
import(entry).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
