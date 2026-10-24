# Style clipboard boundary plan

Date: 24 October 2026. Source reviewed at Cloud a18219eaa9debae0eec5d0434b1f44ece8241a33. Preparation only. No browser, WordPress, build or source modification occurred during this review. Root owns native execution and fixes. Full customer QA remains open.

## Source contract

Core copyStyles at app/src/core/index.ts4076 copies the selected node's direct css for all breakpoints, local st map, shared class IDs, props.ts and Advanced Custom CSS. It deep-copies CSS/state data. It does not copy resolved shared-class declarations or snapshot the shared definitions themselves. Content, links, ordinary CSS classes, authored HTML IDs, visibility, animation and children are outside this clipboard.

pasteStyles at4100 replaces direct CSS and local states. A source without local states clears target local states. Shared membership replaces the target membership after filtering every copied ID through findClass. Existing copied classes survive in order; deleted copied classes disappear. Class definitions are neither recreated nor rewritten. Custom CSS replaces target Custom CSS when the target has adv. Text-style ID copies only where ctlKeys(type) includes ts. Rich text declares this control; Gallery does not.

classDelete at2945 preserves the current users' rendered declarations in their direct CSS/state maps, then removes the class definition and memberships. It does not update styleClip. Consequently, a look copied before deletion retains its pre-deletion direct CSS. Pasting it after deletion must not acquire the newly baked declarations now visible on the source. That is a snapshot/reference boundary, not evidence that class deletion lost its existing users' appearance.

The context dispatcher builder.html4392 wraps pasteStylesMany in one Core edit checkpoint. The Inspector clipboard bar at app/src/ui/inspector/Inspector.tsx132 does likewise. Copy itself does not create a document history checkpoint. Undo/Redo restore documents, not the clipboard object. No source-proven defect was found in these requested boundaries. Native behavior still needs the finite tests below.

## Existing coverage and gaps

- tests/core.test.ts6748 verifies a copied class deleted before Paste is filtered out. It does not provide native UI, saved output or atomic multi-target recovery evidence.
- Core tests852 and859 cover local-state replacement and clearing. Tests6734 cover text-style gating to Heading versus Image. Tests6770 cover pasteMany and missing IDs. These source tests were read, not rerun here.
- WordPress115 native acceptance copied a temporary Button look to existing Rich text, Gallery and the Button. It verified three-selection context action and DOM/computed-style Undo/Redo. It never saved the pasted state. Its public checks showed only the restored original page.
- WordPress118 saved acceptance covers Button to two Buttons, shared Hover/Focus/Mobile, direct margin and Custom CSS. All Buttons had the same btn text style. It does not cover local st maps, unlike-module saved output, different text-style replacement or distinct visibility/animation negatives.

## A. Deleted shared class, Cloud native

Use a fresh recorded History/export baseline. Keep this class-deletion slice on Cloud; WordPress intentionally protects classes used in saved revisions.

1. Create a disposable source Button and two target siblings. Give the source conspicuous direct Desktop CSS, a Mobile override, local Hover/Focus maps and scoped harmless Custom CSS. Give targets different direct CSS, local states, Custom CSS and ordinary classes/IDs/content.
2. Add two simple shared classes to the source: one destined for deletion, one retained. Use non-conflicting properties, such as a border on the deleted class and a background on the retained class, to avoid the deliberate compound Hover/Focus deletion refusal. Record the exact definitions and original source/target documents.
3. Copy source styling through the visible control. Delete the first class through native class management. Require the source to retain its prior rendered appearance through baked direct declarations. Record the post-deletion document before Paste. Keep the retained definition exact.
4. Select both targets and Paste once. Require exact clipboard direct CSS/local st/Custom CSS on both, only the retained copied class ID, no deleted ID anywhere in their memberships, no resurrected definition and no rewritten retained definition. Target-only declarations disappear. Content, links, ordinary classes and authored IDs remain exact.
5. Explicitly check that target direct CSS equals the copied pre-deletion source CSS, not the source's newly baked post-deletion CSS. Deleted shared border styling must not be silently expected on targets unless it was already direct in the copied source.
6. One Undo restores both targets to the exact post-deletion pre-paste state while the class stays deleted. One Redo reapplies the exact filtered Paste. A second Undo boundary may separately test class-deletion recovery; do not confuse it with atomic Paste history. Reload only after Paste, because the in-memory clipboard is not promised to survive reload.
7. Save/reload the resulting Cloud document if needed for this slice, inspect Desktop/Mobile public output, then restore the recorded baseline and compare the complete export. Record any unsupported or untested branch as such.

## B. Saved unlike-module paste, WordPress native

Start only after root establishes a fresh exact SQL/snapshot/upload/source guard for the current installed runtime. Use original QA page Rich text and Gallery plus one disposable source Button. Avoid creating or editing shared classes, colours or named styles: page History intentionally preserves current sitewide design, and saved revisions protect new resources. Empty source membership can intentionally clear a target's existing membership without changing the definitions.

1. Author source direct resting CSS with a conspicuous safe margin/padding, a Mobile opacity override, actual local Hover and Focus maps, and scoped Custom CSS such as outline-offset. Set a different existing named text style from the Rich text target's starting style. Record exact source/target authored data, Gallery item array, Rich text HTML, links, IDs and ordinary CSS classes.
2. Give targets distinct disposable direct declarations, local states and Custom CSS. If testing visibility/animation exclusion, deliberately set different source versus target values and record them. Otherwise mark those negative controls not covered.
3. Copy the source, select only Rich text and Gallery, then Paste once through the visible multi-target action. Require css and st replacement on both, Custom CSS replacement, source membership filtering, unchanged target props/content/children except Rich text ts, and no Gallery ts property. Existing Gallery --g-cols/gap/radius CSS can disappear because CSS replacement is universal; falling back to renderer defaults is expected, not a merge promise.
4. One Undo and one Redo must recover both target authored states together. DOM/computed comparisons alone must be labelled as that boundary, not full-document comparison.
5. Save once, capture immediately, reload, and verify exact persisted authored ownership. Open the actual saved public page at1280 and414. Inspect resting and real pointer Hover; keyboard Focus applies to reachable Gallery frames or links where supported, not an invented focusable Rich text root. Validate actual state selectors, Gallery item order/content/lightbox, Rich text HTML/link content, duplicate IDs and horizontal overflow. A stored Focus map on a non-focusable target is not public keyboard acceptance.
6. Restore the recorded native History. Capture restored and final-post-native separately, verify original page/output and all guarded data, and approve only exact observed maintenance/revision/file deltas. Require shared design options to remain unchanged for this slice. No SQL rollback or hidden authoring shortcut.

## Acceptance limits

These two slices close only deleted-class clipboard handling and saved Button-to-Rich-text/Gallery ownership. They do not certify every CSS property, all widgets, deleted text-style references, nested selections, entire global design recovery or production readiness. Record exact installed/deployed versions and actual screenshots after the final change. Keep root's broader QA ledger open until its remaining gates are evidenced.

## Post-reproduction fix assessment

The initial contract-only review above was insufficient to assess the user outcome. Root's native exports and after-paste-dom.json now prove the gap: the source retains Ink background/radius18px after native class deletion, while the pasted target becomes browser grey/radius0px. The direct margin7px still copies and the success action runs. Filtering a missing class ID prevents an orphan but does not fulfill the styling clipboard's advertised appearance-copy operation. Treat this as a confirmed native UX defect candidate, not an already repaired issue.

### Recommended approach

Capture a private copy-time style envelope containing source type, direct css/st, membership IDs, text-style ID, Custom CSS and deep-cloned relevant ordered class definitions. It must be independent of the live source node. Keep the current clipboard fields/API where practical; avoid serializing clipboard fallback data into the saved document.

At Paste, detect missing copied class IDs. For this branch, resolve their appearance into a cloned style envelope through a pure version of the existing class-deletion localization algorithm. Extract the minimum shared resolver from classDeletePlan so shorthand expansion, breakpoint cascade, state precedence and Button authored-default markers are not reimplemented inconsistently. Supply explicit node and ordered class context instead of swapping global state. Paste the resulting direct CSS/state data plus only existing membership IDs, then the unchanged text-style/Custom CSS contract. Do not resurrect deleted definitions, mutate surviving definitions or copy the current source node after deletion.

Keep ordinary Copy/Paste unchanged when no copied class is missing. Surviving copied classes should remain shared references. A survivor edited or reordered after Copy needs an explicit test and policy: the fallback must not accidentally freeze unrelated surviving class values into direct CSS. Prefer resolving the missing definition snapshot against the current surviving class context. Its deleted definition's relative cascade position must be determined from the captured order. If ordering cannot be preserved unambiguously, reject that Paste with an understandable result rather than claiming a correct match. Do not add a speculative general CSS engine for this case.

Existing classDeletePlan deliberately rejects some combined Hover/Focus cascades because local st cannot represent the same class-major ordering. The clipboard fix must honor that representability boundary. It must never veto a class deletion solely because the clipboard holds an old copy. If a later Paste cannot safely localize a missing class, it must leave the entire selected target set unchanged and show a specific message; the current generic Nothing changed toast is not adequate explanation for that branch. Root should include the smallest UI result change if this path is supported.

### Why not mutate the clipboard during class deletion

Baking styleClip inside classDelete couples an unrelated user's deletion to transient clipboard state. It misses removal through another loaded document/import, risks copying a source modified since Copy, and makes Undo awkward: restoring the class would leave an already baked clipboard that no longer reflects its original shared references. Including a clipboard-only node in deletion planning could also block an otherwise valid deletion. A copy-time snapshot with Paste-time resolution avoids those lifecycle dependencies and handles missing definitions regardless of how they disappeared.

### Required focused regression and native acceptance

Replace or extend core.test.ts6748. Keep its no-dangling-ID assertion, but also require equivalent computed appearance or emitted CSS before/after for the actual Ink/radius18px/Hover24px fixture. A class-membership assertion alone cannot catch the demonstrated failure.

Cover: copy then delete the class; alter or delete the live source; paste onto two targets; one Undo restores the exact post-deletion pre-paste document; one Redo reapplies exact fallback appearance. Undoing class deletion then pasting again must use the restored existing membership without redundant fallback overrides. Test no class resurrection, no surviving definition mutation, Custom CSS replacement, class-only versus direct declarations, Mobile overrides, shorthand/longhand ordering, Button factory defaults and missing-source independence. Add a two-class precedence case with one missing class and a surviving edited class. Add an unrepresentable combined-state case that cannot partially paste across a selection or interfere with deletion.

After isolated implementation and focused tests, root should rerun the native reproduction with captured before/after/Undo/Redo exports plus actual Desktop/Mobile and Hover appearance. The saved unlike-module WordPress slice remains separate. No build, Main source edit, browser action, WordPress call or implementation occurred during this proposal.
