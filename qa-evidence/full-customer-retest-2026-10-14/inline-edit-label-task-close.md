# Task close — inline edit history and readable Rich text labels

- Date and timezone: 2026-10-17, Asia/Manila.
- Project/task: Pagecraft full customer retest in this chat.
- Status: local implementation and native candidate acceptance passed; staging and WordPress Preview37 acceptance pending.
- Scope: development/staging and local WordPress QA. Production promotion is excluded.
- Source: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft`, development, based on 4d23a5b.

## Confirmed failures and changes

Rich text displayed `Shared rooms & gardens <sample>.` on the canvas while its breadcrumb displayed literal `&amp;`. Element names now strip actual markup before decoding serializer-emitted common and numeric character references, normalize whitespace and apply the existing label limit. Escaped author text such as `<sample>` remains literal content; rendering still escapes labels. Unknown named character references remain literal by design. [Before](native/staging-rich-text-label-before.json).

Entering and leaving inline editing without typing created an empty Undo step. Inline editing now records the initial browser-normalized DOM value and defers the checkpoint until the first actual mutation, before writing the new value. Repeated input and formatting share one session checkpoint; view-only entry/exit does not save, rewrite normalized markup, or materialize an inherited component property. [Before](native/local-inline-edit-no-typing-before.json).

## Verification

| Check | Result | Evidence |
|---|---|---|
| Focused boot, customer regressions and core | 702/702 passed | `/tmp/pagecraft-rich-label-inline-37-build-comparison.json` |
| Full isolated suite | 2,282 passed, 5 skipped; 199 files passed, 2 skipped | `/tmp/pagecraft-rich-label-inline-37-full-test.log` |
| Typecheck and independent builds | Passed; 12 stable outputs byte-identical | `/tmp/pagecraft-rich-label-inline-37-build-comparison.json` |
| Native label editing, Navigator, breadcrumb and reload | Passed with `Garden & <sample>` | [Record](native/local-rich-text-label-fixed.json), [image](native/local-rich-text-label-reloaded.jpg) |
| Native inline entry/exit, continued typing, Undo/Redo, bold formatting and reload | Passed | [Record](native/local-inline-edit-undo-fixed.json), [image](native/local-inline-edit-undo-fixed.jpg) |
| Final built-in browser gallery | 30/30 behavior checks; all 24 images byte- and pixel-identical to reviewed baselines; manifest verifies 24 images/28 source files | [Behavior](gallery/rich-label-inline-final-behavior-checks.json), [comparison](gallery/rich-label-inline-final/exact-comparison.json) |
| Main unrelated generated working files | All 11 preserved exactly | Pre/post-commit preservation assertion |

Native authoring used the builder controls in a resettable loopback fixture with fictional accounts. No API or application-state authoring shortcuts were used. The native case covers the tested Rich text flow; component inherited-property and browser-normalization cases have focused automated coverage.

## Handoff

Commit the reviewed source and independent generated blobs without overwriting unrelated working files. Verify exact staging deployment and the installed WordPress Preview37 package, including the separate WordPress Add-access improvement. Full customer QA remains incomplete. Tracked duration is unknown; billing is not prepared or submitted.
