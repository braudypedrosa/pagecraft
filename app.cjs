/* LiteSpeed's Node launcher loads the startup file with require(). Keep this tiny CommonJS
   bridge synchronous for the launcher, then enter Pagecraft's native ESM/TypeScript graph. */
import('./server/src/index.ts').catch(error => {
  console.error(error);
  process.exitCode = 1;
});
