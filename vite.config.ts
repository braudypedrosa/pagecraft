/* The new build, alongside the old one.
   `build.mjs` still produces the shipping artifact from builder.html; this produces
   the Preact/TypeScript successor into dist/next/. Both exist until the port is
   finished, which is the point of a strangler — neither has to be broken to make
   progress on the other.

   `viteSingleFile` is not optional. The product is one HTML file you can open with
   no build step, running inside a CSP-locked iframe with no external requests; a
   normal Vite build emitting separate JS and CSS would lose the thing that makes it
   work at all. */
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: 'app',
  plugins: [preact(), viteSingleFile()],
  build: {
    outDir: '../dist/next',
    emptyOutDir: true,
    /* everything inline, nothing fetched */
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    target: 'es2022'
  }
});
