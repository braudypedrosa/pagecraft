# Task close — Partial Collection List native coverage

- Date: 2026-10-22, Asia/Manila.
- Project: Pagecraft customer QA.
- Status: partial bounded evidence; L01-L06 and selected L08 cases have native records, while L07 and untested portions of L04-L08 remain open.
- Environment: candidate83 native evidence in this directory; Desktop, Tablet, and Mobile records.
- No source, browser, build, database, Main checkout, commit, or deployment change was made for this documentation task.

## Evidence reconciled

- **L01 source/binding:** 18 published fixture titles repeat after reload at all three devices. Empty-source and no-source public states record zero lists/headings at all three devices. The setup record preserves the empty Bind-fields guidance and template-column insertion flow.
- **L02 layout:** Grid Wrap and Slider pass their recorded bounded states. Slider has `overflow-x:auto` and no page overflow. Grid No Wrap remains an intentional authored state, but its Mobile record has page overflow (`scrollWidth 395`, viewport width `374`); this is documented as an unresolved concern, not a pass.
- **L03 sorting:** CMS order, title A–Z, and title Z–A actual arrays match their expected arrays at Desktop, Tablet, and Mobile. The expected lexical order follows the renderer's `localeCompare` behavior.
- **Card basis setup:** `authored-card-basis-setup.json` records a manually authored Column Min basis of 280px and a 282px card at a 1200px list width. It is setup evidence only and does not prove candidate84's new palette List factory seed.

## Remaining acceptance

L04 filter/Test/Value, L05 pagination and limit precedence, and L06 responsive gap/alignment/wrap overrides have bounded records below; L07 repeated child/link edge cases and new factory-default card basis remain open. L08 has bounded identity, Visibility, and whole-list condition observations, but its per-item/edge-condition matrix remains open. The fixture does not provide mixed categories or numeric/date fields, so those cases need a different fixture or explicit native setup. Shared Motion/Hover/Focus and arbitrary-value coverage remain outside this bounded List record.

The machine-readable mapping is in `coverage.json`. No full List or customer QA completion claim is made.

## L04-L05 follow-up evidence

The persisted L04 records now cover category `is`, `is not`, `contains`, `has any value`, `is empty`, an unmatched Design value, boolean Include yes/no/has-any/empty, case-insensitive title `contains`, exact title non-substring behavior, dependent-control hiding, and filter clearing. All recorded device rows match their expected counts after reload. Fixture limits remain: category values are homogeneous Accessibility, and numeric/date schemas are absent.

The persisted L05 records cover limit 3, Items per page 1 and 2, per-page precedence over limit, clearing per-page back to limit 3, and Mobile pagination navigation through pages 2, 8, and 9. Counts and observed titles match each receipt. The preview route may retain a later page during native navigation, so these records do not claim first-page/reset state unless an explicit title or `aria-current` proof establishes it. The per1/per2 filenames and observed titles are retained as evidence labels, not stronger route claims.

Details are in `l04-l05-summary.json`. Fresh explicit first-page/reset proof, L07, and the listed L08 condition edge cases remain open.

## Numeric boundary follow-up

The new boundary receipts show `Items per page = 0` leaves per-page pagination disabled so `Show at most = 3` produces three items; `-2` is clamped by the nonnegative Unit control to the same disabled state; and `2.5` persists across reload while the renderer uses `parseInt`, producing two items per page and nine pages for 18 published items. A large value of 99 leaves all 18 published items on one page.

Source review confirms the mismatch: List `per`/`limit` controls at `app/src/core/index.ts:575-584` do not set `integer`, shared `UnitCtl` at `app/src/ui/inspector/Controls.tsx:164-203` therefore permits decimals, while `listItems`, `listPageCount`, and public rendering use integer `parseInt` semantics (`app/src/core/index.ts:4665-4669`, `5030-5036`, `8848-8853`). Zero/negative behavior is consistent with the existing `> 0` disabled policy; decimal persistence versus integer-only rendering is a real control/compiler contract inconsistency and remains pending a narrow product fix plus native retest.

The page-count and route caveat still applies: these records do not claim first-page/reset state without explicit titles or `aria-current` proof. `l05-fractional-page-size-native.json` additionally records the exact first-to-next transition: authored `2.5`, first item numbers `2, 3`, next item numbers `5, 6`, and nine pages, with no dropped transition. This confirms effective integer stepping while the displayed/persisted decimal remains inconsistent with the renderer. The candidate85 narrow fix and its all-device native retest are root-owned follow-up evidence; they are not promoted into this candidate83 receipt.

## L06/L08 follow-up evidence

L06 now has bounded native records for all five Vertical align options (`flex-start`, `center`, `flex-end`, `baseline`, `stretch`) across Desktop, Tablet, and Mobile. Gap overrides compute to 24px/16px/8px at Desktop/Tablet/Mobile with no overflow; zero computes to 0px at all three; clearing Mobile and Tablet restores inherited 16px and 24px values. These are representative values, not exhaustive spacing coverage.

L07 now has bounded repeated-content/link records: literal long title text with `<b>`, `&`, quotes, emoji, and no overflow; required empty title rejection with linked validation; restoration of the original 27-item source context with 18 published headings and unique IDs; 18 external links at all devices retaining query/hash, `_blank`, and `noopener`; unsafe `javascript:` omitted without activation; and link reset restoring 18 headings with zero anchors. Duplicate rows, missing images, unavailable references, alternate schemas, and remaining link edge values stay open.

L08 records identity/custom CSS persistence (`qa-list-native`, `qa-list-proof`, outline `rgb(21, 85, 119) solid 2px`) and each breakpoint Visibility hide state. Hidden Lists use `display:none` while retaining all 18 repeated items in the DOM.

The `has value` receipt shows the whole List (wrapper 1, 18 items). The earlier equality and restored-state receipts are rejected probes: the condition Value input uses `onChange`, but fill+Tab did not commit the typed value, and reload showed the field blank. The corrected category receipt now proves bounded whole-list behavior with `Accessibility` saved after reload (wrapper 1, 18 items) and `Design` saved after reload (wrapper 0, zero items) on Desktop, Tablet, and Mobile; `Always show` was restored. Source review indicates `renderNode()` evaluates a List node's condition before the List repeat loop, using the selected source preview item (`app/src/core/index.ts:5325-5337`, `5461-5478`, `8685-8694`, `8848-8856`). Boolean, nested child, blank/nonempty, legacy-invalid, and per-item condition cases remain open. A per-item condition would need to be authored on a repeated child/card descendant.

Details are in `l04-l05-summary.json`. L07 repeated child/link edge cases and factory-default card-basis acceptance remain open.
