# List native checklist — planning only

Status: **unverified**. This is a source-derived next-run checklist for the `list` / Collection list module at candidate83 base `89969665`. It promotes no existing inventory row and records no native pass.

Source: `app/src/core/index.ts`, `DEF.list.controls` in the candidate83 isolated source. The module exposes 12 direct controls in its Content group and no module-specific Style array controls. `gap`, `align-items` and `flex-wrap` are CSS controls in Content; they still require responsive native checks.

## L01 — source and collection semantics

Controls: **Collection** (`source`, custom source picker).

Run the same create/edit/save/reload path at Desktop, Tablet and Mobile widths. Connect a fictional collection with a title field, text field, numeric field, option field and reference/image-like field; verify the source remains selected and repeated child content resolves from the selected collection. Repeat with no source, a source with zero items, one item, several items, missing/blank field values and a deleted/unavailable source.

Expected DOM: the list wrapper exists only when the module has renderable source context; repeated item/card DOM count matches the source result, and no stale results from a previous collection remain after changing source and reloading. Record the actual wrapper/class and item selectors from the rendered page.

Limits: source options and dynamic field pickers are runtime-generated; this checklist does not claim every collection schema, field type, CMS provider or child binding.

## L02 — layout and wrap dependency

Controls: **Layout** (`collectionLayout`: Grid, Slider) and **Wrap** (`flex-wrap`: Wrap, No wrap; shown only when layout is not Slider).

Test Grid + Wrap, Grid + No wrap, then Slider. Save/reload each at Desktop, Tablet and Mobile. Verify changing to Slider removes/hides Wrap and that the previously selected Wrap value does not silently affect the slider output; switch back to Grid and verify the expected Wrap state is restored or defaults explicitly.

Expected DOM/computed checks: grid/slider class or structure, item track behavior, `flex-wrap`, overflow and item count. Capture both an ordinary multi-item result and a one-item result.

Limits: slider interaction, drag/keyboard behavior and all child-module content are outside this direct control case.

## L03 — sort and direction

Controls: **Sort by** (`sort`: CMS order plus dynamically listed collection fields) and **Direction** (`dir`: A–Z, Z–A).

Use a fictional collection with deliberately out-of-order title, numeric and option values. Test CMS order, each representative sortable field, A–Z and Z–A, then save/reload at Desktop, Tablet and Mobile.

Expected DOM: repeated item order equals the selected field and direction; blank sort returns CMS order; changing collection removes an unavailable field selection rather than retaining a stale option.

Limits: dynamic field options are not exhaustively enumerable; “A–Z” is the source label even for numeric/date-like fields and needs observed behavior rather than inferred semantics.

## L04 — filter dependency and operators

Controls: **Filter** (`where`, Every item plus dynamic fields), **Test** (`op`: `is`, `is not`, `contains`, `has any value`, `is empty`) and **Value** (`val`, shown only when a field is selected and operator is not has-any-value/is-empty).

With a collection containing matching, nonmatching, blank, zero, false and punctuation/Unicode values, test Every item, then one field with each operator. Confirm Test and Value are absent before Filter is selected; confirm Value disappears for has-any-value/is-empty; change Filter after entering a value and verify stale operator/value state cannot select the wrong field. Save/reload all cases at Desktop, Tablet and Mobile.

Expected DOM: only matching repeated items render; `contains` handles a representative substring; `is empty` includes blank values; `has any value` excludes blank values; zero and false are treated according to actual rendered behavior and recorded exactly.

Limits: this is representative operator/value coverage, not an exhaustive query language or field-type matrix. Do not infer CMS filter correctness from inspector visibility alone.

## L05 — pagination and limit precedence

Controls: **Items per page** (`per`, unitless input, placeholder “all on one page”) and **Show at most** (`limit`, unitless input, placeholder “all”; hidden when `per` is a positive integer).

Use at least five fictional items. Test blank values, `per=2`, `limit=3`, both set, `per=1`, a value larger than the collection, zero and an invalid/negative draft. Save/reload at Desktop, Tablet and Mobile.

Expected DOM: page/result count and any pagination links match the actual saved values; when both are set, Items per page wins as the source note states; Limit reappears after clearing Items per page and does not retain an invalid hidden value.

Limits: pagination URL/route behavior and generated page links are separate checks; unitless input validation must be observed in the native UI.

## L06 — spacing, alignment and responsive CSS

Controls: **Gap** (`gap`, responsive units px/rem/%), **Vertical align** (`align-items`: vTop, vMid, vBot, Base, Fill), **Wrap** (`flex-wrap`: Wrap, No wrap).

At Desktop, Tablet and Mobile, set distinct safe values: Gap `24px`/`16px`/`8px`; each alignment option at least once; Wrap/No wrap in Grid. Save/reload and reset each breakpoint independently, confirming inherited values and no horizontal page overflow.

Expected computed checks: list container `gap`, `align-items` and `flex-wrap` match the saved breakpoint; reset removes only the selected breakpoint override. Repeat after switching Grid/Slider to verify Slider’s conditional control behavior.

Limits: arbitrary units and every value are not exhaustively tested; this is a representative responsive matrix.

## L07 — content and link edge cases in repeated children

The List module has no flat direct “link” control in `DEF.list`; links live in the repeated child/card structure and any nested link module. Test child content with empty title, long title, HTML-like text, ampersand/quotes, missing image/reference, duplicate values and a link target where the nested child control provides one.

Expected DOM: escaped text remains text, missing optional content does not leave stale markup, repeated links retain safe href/target/rel behavior, and a zero-result list has the actual empty-state/wrapper behavior recorded after reload at all three widths.

Limits: nested child module controls, CMS source binding and link sanitizer behavior require their own module check; this case must not be counted as direct List link coverage.

## L08 — shared Advanced, visibility and conditions

Exercise shared **HTML id**, **CSS classes**, **Custom CSS**, **Hide on Desktop**, **Hide on Tablet**, **Hide on Mobile**, **Show only if**, **Condition** and **Value** for a List node. Use a matching and nonmatching condition and each breakpoint hide switch, then save/reload at Desktop, Tablet and Mobile.

Expected DOM/computed checks: authored identity/custom CSS survives reload; hide retains or omits DOM according to the actual shared implementation and is recorded precisely; matching condition produces the list and nonmatching condition produces the documented wrapper/item result. Verify condition controls are accessible and correctly associated in the rendered Inspector.

Limits: shared controls are not List-specific and are not proven by this checklist; Motion, transitions, Hover/Focus, styling targets, component variants/properties, CMS bindings and runtime-generated controls remain separate unverified scope.

## Completion record for the next native run

Keep every case unverified until exact native evidence records the create/edit/save/reload path, Desktop/Tablet/Mobile state, setting value, rendered DOM/computed assertion and edge result. Do not convert a successful List render into coverage of dynamic source fields, nested child controls, shared Advanced behavior or arbitrary values.
