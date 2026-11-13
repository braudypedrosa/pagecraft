# Responsive select reset clean verification

- Date: 2026-10-20
- Base: `d4b3dc89cdc5d06f020fcae8a6f4c2df6079fc2b`
- Archives: `/private/tmp/pagecraft-reset-resume-one-Y66W8f`, `/private/tmp/pagecraft-reset-resume-two-7uStpz`
- Overlay only: `app/src/ui/inspector/Controls.tsx` and `tests/inspector-responsive-select-readback.test.tsx`; both archive copies exactly match Main SHA-256 values recorded in `verification.json`.
- Dependencies: independent `npm ci` passed in both archives. Audit classification found one advisory propagated through three dev-only packages. Production-only audit is clean. See `npm-audit-assessment.md`; no dependency or lockfile changes were made.
- Full suite: `npm test` passed in archive one: 218 files passed, 2 skipped; 2,426 tests passed, 5 skipped; TypeScript and editor package build passed inside the command.
- Explicit builds: `npm run build`, `npm run build:editor-package`, and `node --experimental-strip-types tools/demo-site.mjs` passed in both archives. Required non-empty `index.html` and `dist/demo/index.html` checks passed.
- Dual output check: 10 of 11 requested outputs are byte-exact. `dist/demo/index.html` differs because each demo run generated 85 different element IDs; after replacing generated ID tokens, both files are byte-exact with normalized SHA-256 `7733876e07c2fa23ff71de65c5692bc423d993885e68117d226907e9d1ff8cf2`. See `verification.json` and `demo-normalized-comparison.json`.
- Main guard: all 11 Main generated files remain byte-exact against `qa-evidence/full-customer-retest-2026-10-14/generated-working-preservation-2026-10-17.json` `protectedBefore` values.
- Main was not built, tested, edited, staged, or committed by this verification.
- Remaining ownership: root agent handles integration, native browser checks, commit, deployment, and staging verification.

## Dependency follow-up

Clean archives now use the reviewed lock-only `vite-plugin-singlefile@2.3.4` resolution. Full post-fix evidence and exact lock delta are in `lock-fix-final.md`.

Commands:

```text
npm ci
npm test
npm run build
npm run build:editor-package
node --experimental-strip-types tools/demo-site.mjs
```
