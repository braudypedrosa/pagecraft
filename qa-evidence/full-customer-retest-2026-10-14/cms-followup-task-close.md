# Task record — Collection history context and typed filter values

- Date: 2026-10-17, Asia/Manila.
- Project: Pagecraft full customer retest.
- Status: implementation and reviewed gallery complete; isolated final suite complete; commit, staging deployment, native acceptance and WordPress synchronization pending.
- Authorized scope: development/staging and local WordPress QA only. Production remains excluded.
- Working source: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft`, branch `development`, parent `c411d4db34d514e7d216ec8ff9948be7d0bb0b3f`.

## Confirmed failures and changes

The c411 native source-swap retest found a combined history edge: after changing a Collection source, clicking a fallback Image and undoing, the outline adopted Community Garden while the bound Image inspector still read Courtyard. The new canvas DOM now reconciles selection context before the inspector renders. Valid nested context remains intact; a removed branch adopts the same visible fallback in the outline and inspector. This changes UI context only, with no document, history or save mutation. [Before evidence](native/staging-c411-source-undo-context-before.json).

The scalar matrix found that typing the displayed Boolean values No or false returned no matching entries; the internal value 0 worked. Collection filters now use field-specific controls: Yes/No choices, configured options, reference item labels, native numbers and native dates. Contains retains free text for all field types. Unavailable legacy values stay visible, malformed saved Number/Date values remain editable, and rendering does not silently rewrite saved values. Boolean equality recognizes the six established aliases without treating blanks or unknown values as No. [Before evidence](native/staging-c411-boolean-filter-before.json).

## Verification

Focused selection tests (4), filter tests (10), TypeScript and diff checks passed. Two independent source exports received the exact five-file overlay. The full suite passed with four workers: 2,312 tests passed and five skipped, across 202 passing test files and two skipped. The default-concurrency attempt timed out in two server tests; both passed separately (35 tests), then the full suite passed without source or timeout changes. Final full-suite and output receipts are maintained in [build record](cms-followup-build.json).

The candidate passed 30 gallery behaviors and produced all 24 captures. The physical capture display changed from 1512×982, 30-bit HDR/P3 to 2560×1440, 24-bit SDR without P3; actual schema-2 runtime metadata records this. Two clean previously reviewed b10 SDR runs each passed 30 behaviors, and their 24 images were byte- and pixel-identical. Candidate versus both reviewed runs passed the unchanged 0.1% / channel-delta-20 threshold for all 24 images; 23 were exact, with a tiny focused-field capture delta. Candidate source identities differ as expected in builder.html and Inspector.tsx; the A/B reviewed source identities match. All 24 candidate images were inspected in contact sheets and recorded together with their provenance. No threshold, fixture styling or production setting changed. [Comparison](gallery/cms-followup-comparison.json).

Native deployed acceptance remains pending. Preview41 was packaged from c411 but never installed; Preview40 remains installed until this follow-up is verified and synchronized. Protected original generated working bytes are preserved separately; no build or full test may run in the shared checkout.

## Limits and next action

Full customer QA is incomplete. Continue with the exact failed native Undo and Boolean flows, typed filter save/reload checks, matching WordPress package and guarded local acceptance, then the remaining native coverage queue. Production remains at cc026d65d275f16374eb356d0331cebb93430c85.

Tracked duration is unknown; no time entry was prepared or submitted.
