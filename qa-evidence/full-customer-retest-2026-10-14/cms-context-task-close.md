# Task record — Collection selection and source changes

- Date: 2026-10-17, Asia/Manila.
- Project: Pagecraft full customer retest.
- Status: implementation, independent builds, full tests, and reviewed gallery complete; native Collection acceptance, commit, staging deployment, and WordPress synchronization pending.
- Scope: development/staging and local WordPress QA only. Production remains excluded.
- Working source: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft`, branch `development`, parent `b10d85da5fcd5648df8c2f17152426cc237fc60f`.

## Confirmed failures

Selecting Community Garden in a repeated Collection card displayed Courtyard in its bound Heading control. The shared node identifier retained the template identity but lost the clicked CMS item. The HUD, outline, and parent selection could also jump to the first copy. Before evidence: [selection context](native/staging-list-binding-context-before.json).

Changing the Collection to a different schema reused collection-relative field IDs. An Image consequently received a Number as its source and a Date as its alternative text. Before evidence: [source change](native/staging-collection-source-swap-before.json). The original source and settings were restored before implementation.

## Changes

Editor-only repeat hooks identify the validated collection and item that rendered each addressable copy. Selection records the nested CMS context without changing document content or history. Bound controls, HUD, outline, parent selection, and reveal follow that copy; stale or deleted identities fall back safely. Public markup has no authoring hooks.

Both source selectors now change the source and its dependent bindings, conditions, sort and filter settings in one Undo checkpoint. Unique matching field names, full reference paths, and field types preserve compatible connections; incompatible choices return to authored fallbacks. Matching preserves punctuation, currencies, diacritics, and scripts. Independent nested sources and property bindings remain untouched.

Shared component definitions are read-only. A source change requiring their direct CMS connections to be rewritten is refused before history or document mutation. Compatible same-path definitions remain usable; component properties allow instance-local remapping. Both controls restore their displayed selection when a change is refused. Clearing a source retains disconnected data for Undo recovery.

## Verification and limits

Two independent clean b10 exports received the exact eight-file source overlay and independent dependency installs. Their eleven generated outputs matched byte for byte. After the required gallery review, the full isolated suite passed: 2,301 tests passed, five skipped; 201 test files passed, two skipped. [Build record](cms-context-build.json).

The native candidate gallery passed all 30 behaviors. Fresh captures of the previously reviewed b10 revision were repeated twice in the current built-in browser, with 30 behaviors passing each time. All 24 A/B comparisons passed the existing threshold and retained equal dimensions, source identities, PNG signatures and available runtime metadata. Twenty-two were pixel-identical; the remaining differences were 40 and two pixels. Candidate versus fresh reviewed b10 passed all 24 comparisons, with 23 pixel-identical; the remaining difference was the focused input caret. The two older narrow menu captures differed by one pixel in height and the legacy set showed different colour rendering. Because the unchanged reviewed revision reproduced those differences, this was treated as a capture migration after explicit review, without claiming an exact browser/colour-pipeline cause. All 24 candidate images and schema-2 metadata were recorded together. No comparison threshold or fixture styling changed. [Comparison](gallery/cms-context-comparison.json).

One worker accidentally invoked the package prebuild in the shared checkout. Six generated working files changed; all eleven protected original files were restored to their exact pre-task SHA-256 values before continuing. A new sealed copy of every original was retained. No deployment, database, or running application was changed by that command. [Recovery record](cms-context-generated-recovery.json).

The broader full customer retest is incomplete. This record does not claim every module, provider, account workflow, or production release is accepted.
