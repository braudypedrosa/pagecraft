# Finite native setting backlog reconciliation

Date: 2026-10-23

## Scope and method

This is a read-only reconciliation of named native evidence. It does not count unit tests, generated output checks, gallery baselines, source inspection, or automated browser assertions as native setting coverage.

The finite source inventory contains 24 canonical module types and 231 direct descriptors: 127 Content and 104 Style. The separate catalogues contain 12 shared Style descriptors, 8 fixed Advanced descriptors, 12 runtime families, 18 composite families, and 48 host cases. Those separate catalogues are not included in the 231 count.

For this report, a direct descriptor is in the covered lower bound only when named native records explicitly exercise every direct descriptor listed for that module at least once. This means representative setting coverage. It does not mean every value, combination, device, state, or host passed.

## Traceable result

- 16 of 24 module types, containing 144 direct descriptors, have named native evidence that explicitly spans all direct descriptors at least once.
- 8 module types, containing 87 direct descriptors, remain uncertain at direct-descriptor level. Each has some named native evidence, but its own receipt says coverage is partial, historical, not mapped to current source, or does not include every direct control.
- 0 module types have no named native evidence at all. This does not reduce the 87 uncertain descriptors because partial module evidence cannot identify every untouched descriptor reliably.
- No exact split of the 87 into individually covered and individually unverified descriptors is defensible from current receipts. Promoting a partial module receipt to individual descriptor coverage would infer facts that the evidence does not state.

### Covered lower bound, representative direct settings

| Module | Direct descriptors | Named native basis | Remaining boundary |
|---|---:|---|---|
| Section | 3 | Native106, both hosts | Representative nested case only. Shared states, Motion, arbitrary nesting remain open. |
| Row | 5 | Native102, both hosts | Representative gap values. Gutter drag, touch and shared controls remain open. |
| Collection list | 12 | L01-L08 plus releases84, 86, 89, CMS107 and CMS108 | WordPress has no native Cloud Collection authoring. Larger datasets, missing references and more query combinations remain open. |
| Column | 5 | Native106, both hosts | Slider-child conditional branch is Cloud-only. Arbitrary nested combinations remain open. |
| Box | 9 | Native106, both hosts | Representative Stacked, Flex, Grid, link and tag branches. Shared states and Motion remain open. |
| Quote | 14 | Q01-Q06 native82 | Representative values only. Motion and wider Hover/Focus combinations remain open. |
| Video | 10 | Local direct matrix plus releases94, 95 and 96 | Vimeo, physical iOS, uploads and the full provider/flag matrix remain open. |
| Spacer | 1 | Local direct matrix plus native104 both hosts | Five units and percentage contexts are bounded cases, not every parent/layout combination. |
| Divider | 4 | Local direct matrix | Current both-host all-value acceptance remains open. |
| Breadcrumb | 8 | B01-B06 native82 | Deep trails, arbitrary rows and common states remain open. |
| Code | 16 | C01-C07 native83 | Copy permission failure and current saved WordPress breadth remain open. |
| Table | 14 | T01-T07 plus native101 both hosts | Sticky movement in a tall parent and arbitrary layout/state combinations remain open. |
| Tabs | 10 | T01-T09 plus release91 | Saved WordPress public keyboard/focus proof remains narrower than Cloud/editor evidence. |
| Accordion | 14 | Candidate85 local A/S matrix | Direct settings are local-only as a complete matrix. Both-host module acceptance remains open. |
| Icon | 10 | I01-I07 native82 | Link-mode reload is not a full three-device matrix. Wider state combinations remain open. |
| Gallery | 9 | Local nine-family matrix plus releases98, 100 and later load-recovery evidence | Library reuse, arbitrary values and broader shared state combinations remain open. |

Covered lower-bound arithmetic: `3 + 5 + 12 + 5 + 9 + 14 + 10 + 1 + 4 + 8 + 16 + 14 + 10 + 14 + 10 + 9 = 144`.

### Uncertain direct-descriptor modules

| Module | Direct descriptors | What named native evidence proves | Why all direct descriptors remain uncertain |
|---|---:|---|---|
| Slider | 5 | Runtime movement, long-track behavior and nested Slider-child layout cases | Every Slides-in-view choice, controls position, arrows, Region name, authored reorder and current save/reload are not mapped. |
| Heading | 12 | Historical control roundtrip | Receipt is not reconciled to current source or a current saved WordPress host matrix. |
| Rich text | 8 | List/link safety, toolbar slices and responsive typography Update/Detach | Existing receipts explicitly do not cover every Rich text inspector control or shared typography combination. |
| Image | 15 | Decorative image and link behavior | Source upload/replace/library/remove/missing, intrinsic Detect, full Fit/filter, lazy loading and current saved WordPress controls remain open. |
| Button | 14 | B01-B13 mixed typography/surface, responsive, variants/icons, link, position, focus/hover, two instances | Button task close explicitly says every direct Content/Style control remains open. Later mixed host evidence is still a bounded combination, not all 14 descriptors. |
| Nav menu | 13 | Historical native menu modes/runtime | Full links/nesting/rel, collapse thresholds, dropdown/fullscreen, Follow/custom layout, Menu background and current WordPress persistence remain open. |
| Form | 18 | Historical Form/Embed slice and WordPress date/select host proof | Eight field branches, width/grid, duplicate names, conditional controls, handling destinations, validation/error/success and most Style controls remain open. |
| Embed | 2 | Historical ratio and inner-frame proof | Current saved WordPress source/sandbox, empty/long/static/nested iframe and sanitization states are not reconciled. |

Uncertain arithmetic: `5 + 12 + 8 + 15 + 14 + 13 + 18 + 2 = 87`. Covered and uncertain totals reconcile to `144 + 87 = 231`.

## Latest CMS evidence

CMS108 is a bounded dynamic-case addition. Named staging evidence covers Boolean Yes, No, Empty and `is not Yes`; deletion of an active Category filter and Score sort while on page 2 resets to page 1; warnings exclude unrelated same-ID image bindings; unrelated pages/bindings stay intact; the full fixture is restored. WordPress103 proves packaged code plus native Save, reload, public rendering and History restore, but not every CMS authoring journey. CMS108 does not add direct descriptors to the 144 lower bound because Collection list was already in that lower bound.

## Shared Style and Advanced round109 status

Round109 remains ongoing and is not promoted to accepted coverage here. Current staging and WordPress matrices record one bounded Box/Heading flow with responsive padding, background, max width, overflow, Hover opacity, Focus transform, state-specific reset behavior, save/reload and public or Preview Desktop/Tablet/Mobile output. Cloud full-project restoration is recorded byte-exact. Final both-host restoration audit and task-close acceptance are still pending.

Round109 also does not prove all 12 shared Style descriptors or all 8 fixed Advanced descriptors. Those 20 descriptors remain outside the 231 direct count and need their own finite matrix.

## Next three bounded customer journeys

1. Close round109 without expanding it. Verify the named responsive Resting, Hover and Focus reset flow on saved public Desktop, Tablet and Mobile output for both hosts. Finish WordPress and Cloud restoration audit. Record exactly which shared Style and Advanced descriptors the fixture exercised. Keep all untested descriptors open.
2. Image source and recovery journey. Insert one image through upload and Library, then replace, remove, restore and exercise one missing-source recovery. Cover all 15 direct labels with finite named branches: decorative versus authored alt/link label, intrinsic Detect, caption, link, alignment, lazy loading, width/height, each named Fit/filter option, representative radius/opacity, responsive clear, save/reload and saved public output on both hosts. Avoid treating arbitrary numeric values as an infinite matrix.
3. Form authoring and public validation journey. Build one disposable form that exercises all eight field types, duplicate-name repair, Options/Placeholder conditional controls, field width/grid, alignment/spacing and the remaining direct Style labels. Test Cloud receiver and WordPress managed/external configuration as inert validation paths, with no real third-party submission. Verify keyboard use, invalid/success UI, save/reload, public Desktop/Tablet/Mobile output and exact fixture restoration. Keep provider delivery and external messages as separate authorization-gated checks.

After these three, the finite direct queue still includes Slider, Heading, Rich text, Button, Nav menu and Embed. Their named partial receipts remain useful and should prevent rerunning already accepted slices.

## Source records

- `qa-evidence/customer-setting-inventory-2026-10-21/remaining-native-cases-2026-10-22.json`
- `qa-evidence/customer-setting-inventory-2026-10-21/native-progress.json`
- `qa-evidence/customer-setting-inventory-2026-10-21/coverage-reconciliation-2026-10-22.json`
- `qa-evidence/nested-row-native-2026-10-23/acceptance.json`
- `qa-evidence/nested-layout-conditional-native-2026-10-23/acceptance.json`
- `qa-evidence/table-layout-native-2026-10-23/acceptance.json`
- `qa-evidence/spacing-host-native-2026-10-23/open-percent-height-parity.json`
- `qa-evidence/cms-mixed-conditions-native-2026-10-23/local-acceptance.json`
- `qa-evidence/cms-schema-cleanup-native-2026-10-23/acceptance.json`
- `qa-evidence/shared-style-advanced-native-2026-10-23/staging-native-matrix.json`
- `qa-evidence/shared-style-advanced-native-2026-10-23/wordpress-native-matrix.json`
- `qa-evidence/shared-style-advanced-native-2026-10-23/cloud-full-project-restoration.json`

No browser, source, build, database, baseline or Main file was changed for this reconciliation.
