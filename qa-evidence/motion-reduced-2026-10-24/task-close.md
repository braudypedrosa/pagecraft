# Reduced-motion animation lifecycle

- Date: 2026-10-24, Asia/Manila.
- Status: isolated local fix, awaiting root native acceptance and integration.
- Base: Cloud8f1a3b1e9064f5f2a2806c8658e0dc9ca2717511.
- Source scope: anim.ts, animation-runtime.test.ts and explicitly approved signed golden regeneration.

## Change

Initial, manually triggered and dynamically observed animations settle visible/done under reduced motion without arming an animationend listener. A preference change to reduced motion settles connected visible/active presets, removes their own listener and timing overrides, and restoring the preference does nothing. WeakMap ownership avoids retaining detached elements. Normal entrance completion, authored opacity/transform release, Once/repeat behavior and normal legacy Fade out semantics remain intact.

## Verification

- Original RED:5 failed,11 passed. Final focused:17 passed; typecheck passes. Includes initial entry/no listener, Once, repeat re-entry, manual/dynamic paths, active cancellation, late events, legacy media listeners and detached-element safety/re-entry. Detached regression does not claim garbage-collection measurement.
- Two ordered builder/editor pairs produce identical generated10 hashes. Golden regeneration and final full suite leave these generated hashes exact.
- First full suite:2809 passed,5 skipped,1 sole expected signed-golden failure. Preserved without weakening assertions.
- Root approved the repository regeneration flag. New golden matches the read-only preapproved diagnostic exactly:19 fixture leaves change, consisting only of three exact ANIM_JS replacements and derived script identities/source hashes/signed envelopes. All four routes HTML/head/CSS, nonanimated route, animation CSS and sourceVersion7 remain exact.
- Final ordinary npm test with two workers and no update flag:2810 passed,5 existing skips;274 files passed,2 skipped. Includes official build-order gate and typecheck.
- New runtime SHA76a0a68d4d9cf825661eb3fcef708107e916a039541eec1bbd067edc6424fdf8 intentionally replaces80e. GeneratedCore/compiler also change. Contract/templates/fixtureZIP2 remain exact. Coreindex source7b68 and schema unchanged.
- Gallery manifest,24 PNG bytes and all historical capture provenance exact. No gallery refresh or new capture claimed.
- Main11 working bytes and Git index unchanged; PHP12 read-only baseline exact. No browser or database access.

## Handoff

Root owns native repaired Preview/export acceptance, integration, commit/deployment and later WordPress parity. Source3 and scoped evidence may copy; generated8 must stage index-only while Main11 working bytes stay exact, compiler2 excluded. No Main/canonical/live/runtime install/commit/push actions by this worker. This bounded repair does not close full builder QA.
