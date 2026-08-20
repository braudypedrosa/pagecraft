/* Separate from vite.config.ts on purpose: the build's root is `app/`, but the suite
   lives beside the code it covers at the package root. One file trying to be both
   was why the first run found no tests. */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,mts,mjs}'],
    /* the core is DOM-free, so node is right; a ported panel will ask for jsdom in
       its own file with a docblock pragma */
    environment: 'node'
  }
});
