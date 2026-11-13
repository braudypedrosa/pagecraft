/* A fixed CloudLinux app root loads its separately activated immutable release. */
import('./current/server/src/reports-index.ts').catch(() => {
  console.error('Founder reports startup failed; inspect its protected configuration.');
  process.exitCode = 1;
});
