/* Separate from vite.config.ts on purpose: the build's root is `app/`, but the suite
   lives beside the code it covers at the package root. One file trying to be both
   was why the first run found no tests. */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx,mts,mjs}', 'server/tests/**/*.test.ts'],
    /* Several suites initialize independent PGlite databases. On a full parallel run their
       schema boots contend for CPU even though focused runs finish in milliseconds; keep the
       runner bounded without turning ordinary integration startup into a false timeout. */
    testTimeout: 15_000,
    /* the core is DOM-free, so node is the default; the component files opt into jsdom
       with a `@vitest-environment jsdom` docblock, so the 371 core cases keep running in
       node and pay nothing for a DOM they never touch */
    environment: 'node'
  }
});
