# Follow navigation candidate independent verification

- Base: `c73b97a1548d7448074678f73907441c0fe6b3c0`.
- Exports: `/private/tmp/pagecraft-mobile-follow-one-c73-v1` and `/private/tmp/pagecraft-mobile-follow-two-c73-v1`.
- Scope: exactly seven reviewed candidate overlays. The eighth module-control test was already committed and matched main.
- Core verification: npm ci, editor package build, demo build, TypeScript, 99 focused tests, and unchanged WordPress golden passed in both exports.
- Initial expected blocker retained: ONE full suite had only the stale `Inspector.tsx` UI-baseline fingerprint failure; TWO independently reported the same.
- Root gallery review: 30/30 interaction checks; 24/24 screenshots pixel-exact with zero changed pixels; manually reviewed cloud fields 1440, builder menus 1440, cloud dialogs 768, and builder fields 768. The first 15-check run used the origin rather than `/internal/components`, reached Sites, and is retained as harness evidence rather than a product failure; the corrected run passed all 30 checks.
- Reviewed baselines: recorded in ONE, then all 25 files copied byte-exact to TWO. No main baseline files were written.
- Final verification: ONE full suite passed 2408 tests across 216 files, with 5 tests and 2 files skipped. TWO independently verified 24 baseline images and 28 source files.
- Determinism: 11/11 generated outputs still match byte-for-byte across exports. Main protected generated files remain 11/11 exact. Candidate sources remain exact in both exports.
- Pending: root’s actual Follow builder UI acceptance in loopback and any later main integration/package/staging work.
