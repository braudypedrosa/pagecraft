# CMS disconnected source recovery guidance

- Date: 2026-10-24, Asia/Manila.
- Status: isolated local candidate, awaiting root integration and native acceptance.
- Base: Cloud371dcb612c217f1f20e5b03988670297ab1e603e.
- Scope: cms-source-change.ts plus its existing focused test. No Controls, builder source, Core, schema, PHP, SVG or runtime changes.

## Change

A blocked shared-component source selection with no prior effective collection now returns internal disconnected metadata. The existing toast explains that Undo or version history can restore the previous source and that a new source requires component-property connections. A known-source incompatible change retains its original result object and message. All guard decisions remain unchanged.

## Verification

- RED:2 failed,12 passed before product change. GREEN focused:14 passed. Typecheck and whitespace checks pass.
- Actual changeContentSource A to None to A and real Inspector selection/toast regression: definition and document bytes preserved; no checkpoint on blocked change; invalid requested ID does not invent recovery metadata; Undo restores the exact connected document.
- Two ordered builder then editor package pairs produce identical generated10 hashes. Final full suite leaves them exact.
- Full npm test with two workers:2804 passed,5 existing skips;274 files passed,2 skipped. Includes official build-order check and typecheck.
- Core7b68, runtime80e, schema, golden, builder/Controls sources, complete gallery manifest,24 PNGs and all provenance unchanged. No baseline update required.
- Main11 working bytes and index exact. WordPress PHP12 read-only baseline hash check passes; no database access.

## Handoff

Only source2 and scoped evidence may copy into Main. Generated8 must stage index-only; compiler2 remain untracked and excluded. Root owns integration, commit/deployment, native toast acceptance and subsequent WP113 parity. No Main/canonical writes, browser, database, install, commit or push by this worker. Full builder QA remains open.
