# Task close — Partial Collection List native coverage

- Date: 2026-10-22, Asia/Manila.
- Project: Pagecraft customer QA.
- Status: partial bounded evidence; L01-L03 have native records, L04-L08 remain unverified or setup-only.
- Environment: candidate83 native evidence in this directory; Desktop, Tablet, and Mobile records.
- No source, browser, build, database, Main checkout, commit, or deployment change was made for this documentation task.

## Evidence reconciled

- **L01 source/binding:** 18 published fixture titles repeat after reload at all three devices. Empty-source and no-source public states record zero lists/headings at all three devices. The setup record preserves the empty Bind-fields guidance and template-column insertion flow.
- **L02 layout:** Grid Wrap and Slider pass their recorded bounded states. Slider has `overflow-x:auto` and no page overflow. Grid No Wrap remains an intentional authored state, but its Mobile record has page overflow (`scrollWidth 395`, viewport width `374`); this is documented as an unresolved concern, not a pass.
- **L03 sorting:** CMS order, title A–Z, and title Z–A actual arrays match their expected arrays at Desktop, Tablet, and Mobile. The expected lexical order follows the renderer's `localeCompare` behavior.
- **Card basis setup:** `authored-card-basis-setup.json` records a manually authored Column Min basis of 280px and a 282px card at a 1200px list width. It is setup evidence only and does not prove candidate84's new palette List factory seed.

## Remaining acceptance

L04 filter/Test/Value, L05 pagination and limit precedence, L06 responsive gap/alignment/wrap overrides and resets, L07 repeated child/link edge cases and new factory-default card basis, and L08 Advanced/Visibility/condition behavior remain unverified. The fixture does not provide mixed categories or numeric/date fields, so those cases need a different fixture or explicit native setup. Shared Motion/Hover/Focus and arbitrary-value coverage remain outside this bounded List record.

The machine-readable mapping is in `coverage.json`. No full List or customer QA completion claim is made.
