# Save rejection and confirmed restoration recovery

Local candidate only, based on Cloud c20caf3096ca7e11cec39edc17fee000994c0582. No commit, push, browser, database, installed runtime, Core source, WordPress adapter, or preview-pin changes.

The shared editor now distinguishes HTTP 400/422 validation rejection from unknown or network save outcomes. Known validation reasons are mapped to fixed customer-facing guidance. Unknown reasons are not displayed, preventing arbitrary response HTML, authored content, credentials and diagnostics from reaching the recovery dialog. Backup, explicit retry, preserved document version, unsaved draft and unload protection remain intact. Existing conflict, busy, compiler reload, nonce/session, and network branches remain unchanged.

Both History restoration surfaces now use the existing deliberate reload helper only after the server confirms success. This releases failed-save unload guards and cancels queued replay so the stale failed draft cannot overwrite the restored revision. A failed restore retains draft protection.

## Verification

- Source-derived WordPress contract at 08686905d90b6a790369ec29e8f66349a2c39f4c: RestController returns PackageException as HTTP 400 with `error`; host transport preserves status/payload. No adapter change needed.
- RED: all five rejection cases failed against the initial editor; both successful restoration cases separately failed the unload-guard assertion. Failed restoration controls passed.
- GREEN: 33 focused save/recovery tests passed. Nine new regressions cover safe validation reasons, hostile/unknown payload suppression, no automatic replay, exact explicit retry, and both History surfaces with successful/failed restore.
- TypeScript check passed.
- Initial `npm test`: 2,722 passed, 5 skipped, two failures (pending visual fingerprint gate and submissions timeout) plus a CMS teardown error. Narrow submissions/CMS rerun passed 27 tests without errors.
- Complete rerun excluding only `tests/ui-baselines.test.mjs`, with four workers: 260 files passed, 2 skipped; 2,720 tests passed, 5 skipped; no unhandled errors. Native visual baseline gate remains pending, not waived.
- Two final ordered editor builds match for all 10 generated artifacts. Compiler and runtime behavior are unchanged; source-path comments in generated bundles reflect this isolated checkout's dependency symlink. Root should integrate the two source/test files and rebuild in its canonical environment.
- Design detector reports two pre-existing, unrelated warnings (layout transition and boot-progress marquee). Neither belongs to the changed recovery UI.

The later root review, full-green test result and canonical-depth rebuild supersede the pending baseline status above. See `canonical-path-handoff.md`. Root still owns installed WordPress modal/recovery acceptance. No claim of exhaustive full QA completion, production readiness or deployment is made.

## Files

`builder.html`, `tests/editor-save-rejection.test.mjs`, and this evidence directory. `source-freeze.json` records exact owned source hashes; `generated-pair{1,2}.sha256` records final generated artifact hashes. Root's native bug evidence is in the WordPress evidence tree at `qa-evidence/facade-only-guard-2026-10-22/native-after/inert-script-save-rejected.png`.
