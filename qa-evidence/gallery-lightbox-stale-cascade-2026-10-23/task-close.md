# Gallery lightbox stale cascade repair

## Change

- Kept structural control declarations on the bare `.pagecraft-lightbox-btn` selector and moved only resting paint to a scoped `.pagecraft-lightbox .pagecraft-lightbox-btn` rule.
- Scoped hover and keyboard focus selectors beneath `.pagecraft-lightbox`.
- Kept every declaration value, runtime behavior, hidden rule, positioning rule, and Theme asset order unchanged.
- Added specificity checks plus an actual JSDOM cascade regression with historical CSS appended. Close remains `top:14px`, `right:14px`, and `transform:none`; controls remain 46px, dark-painted, and hidden when requested.
- Regenerated the signed WordPress golden. All four route CSS values changed only by the structural/paint split and two scoped state selectors; remaining changes are derived hashes and signatures.

## Verification

- Initial RED: focused test failed 3 of 4 tests because the scoped rules were absent.
- Close-position RED after review: actual computed `top` was `50%` instead of `14px`.
- Corrected GREEN: focused test passed 5 of 5, including actual historical cascade behavior.
- Related Core, keyboard runtime, and golden check before regeneration: 694 passed, one expected golden mismatch.
- Updated golden: 30 passed.
- Full suite: 2,725 passed and 5 skipped; one unrelated submissions test timed out at 30 seconds. Its isolated rerun passed 16 of 16 in 6.9 seconds.
- Final focused plus keyboard runtime plus golden: 37 passed.
- Two ordered `build.mjs` then `packages/editor/build.mjs` pairs exited 0. All ten generated files exist and both hash manifests match exactly.
- Existing UI baseline manifest, accepted builder source, and accepted save rejection regression remain byte exact to deployed `3bf5b4b`.

## Open

- Native WordPress cascade acceptance remains with root.
- Mixed-version generic foundation and regional stylesheet ordering remains open. This patch makes no generic ordering claim.
