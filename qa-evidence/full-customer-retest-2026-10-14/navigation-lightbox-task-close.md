# Task close — Navigator targets and Gallery keyboard containment

- Date and timezone: 2026-10-17, Asia/Manila
- Project: Pagecraft; autonomous customer retest and fixes requested in this chat.
- Status: implementation verified locally; staging native acceptance and WordPress delivery pending.
- Authorized scope: source fixes, tests, development push, staging deploy, matching guarded local WordPress QA package; no production promotion.
- Working source: /Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft, development, parent 1c6043fdd30faa790964ce304710563db5a0908e.

## Work performed

Navigator now reserves action space before hover, preventing the label from moving underneath Hide. Gallery lightbox wraps Tab and Shift+Tab at visible enabled control boundaries, including single-image Close. Existing arrows, native Escape/Close, and opener focus restoration remain intact.

Root reproduced the Navigator click changing visibility twice and restored it with Undo. Root reproduced Gallery Shift+Tab reaching Publish while the iframe dialog remained open; Escape alone closed correctly, so no independent Escape defect is claimed.

## Verification

| Check | Environment or scope | Result | Evidence |
|---|---|---|---|
| Red/green keyboard regression | Isolated runtime | Two expected red failures; final focused green | tests-gallery-lightbox-keyboard-red-20261017.log and green log |
| Independent clean exports | /tmp/pagecraft-navigation-lightbox-one-1c and two-1c | All 11 outputs deterministic | navigation-lightbox-build.json |
| Full suite | Export ONE | 2,371 passed, 5 skipped; 209 files passed, 2 skipped | tests-navigation-lightbox-reviewed-20261017.log |
| Signed WordPress fixture | Both exports; root reviewed 19 derived changed leaves | Schema and normalized non-derived content exact; identical 296-byte lightbox insertion across three routes | Approved golden SHA 7a82ffbef5e75ce2673ff81928bc0fd07f86a5b27bb8bd46bc5ca203878fff80 |
| Built-in browser components | Local disposable MemoryStore gallery, 1440px/768px | 30/30 behaviors, 24/24 captures pixel exact, four actual captures reviewed | gallery/navigation-lightbox-final/ |
| Main generated preservation | Original protected working 11 | Byte exact; generated results staged from isolate only | generated-working-preservation-2026-10-17.json |

Initial gallery behavior invocation omitted /internal/components and failed 0/15; preserved as a harness route error. The corrected route passed 30/30. No threshold or fixture was weakened.

## Time evidence

Tracked total unknown; billing not prepared. Test timing is not a work timer.

## Next action and handoff

Push exact development commit, verify CI/deploy and served revision, then native Navigator selection/action geometry and Gallery Tab/Shift+Tab/Close/Escape at desktop and mobile. Prepare Preview48 only from that exact commit. Existing saved WordPress pages retain immutable upload runtime until native Save/reimport/Generated Output refresh, so an install-only check is insufficient. Protected 15 posts stay exact; use a separate disposable Gallery fixture for the supported refresh test.

Full customer QA remains incomplete with 15 broader areas open. No production-readiness claim.
