# Table native quick checklist

Status: **unverified**. This is a bounded planning checklist for seven Table cases. It does not claim exhaustive arbitrary values, all runtime-generated controls, or shared Motion/State coverage. Verify every named value after save/reload in Preview at Desktop, Tablet, and Mobile.

Direct controls from the inventory: **Rows**, **Caption**, **First row is a heading**, **First column is a heading**, **Lines**, **Shade alternate rows**, **Text size**, **Text colour**, **Cell padding**, **Line colour**, conditional **Header background**, conditional **Heading colour**, conditional **Shading**, and conditional **Caption colour**.

## T01 — create table and semantic headings

1. Add **Table**. Set **Rows** to a small multiline dataset with headers and two data rows, and set **Caption** to `Workshop schedule`.
2. Toggle **First row is a heading** on, save/reload, and Preview.
3. Assert the exact table DOM contains `caption` text and `thead`/`th` for the first row, with data cells in `tbody`. Repeat with the toggle off and assert the first row becomes ordinary cells according to the current renderer.

## T02 — first-column heading and empty/edge rows

1. Toggle **First column is a heading** on with a first-column label such as `Morning`; assert row-header cells use the renderer’s exact `th scope`/header semantics after reload.
2. Test one data row, a blank cell, uneven row lengths, and an empty **Rows** value separately. Assert no malformed cells or orphan headings, and record the editor’s empty-state behavior versus published output.
3. Repeat the semantic combinations at D/T/M; keep arbitrary row counts representative rather than exhaustive.

## T03 — lines and alternate-row shading

1. Exercise each available **Lines** option from the current Table control, recording the exact label/value and the resulting border rule or `data-rules` state.
2. Toggle **Shade alternate rows** on and set **Shading** to `#f2eadf`. Assert only alternating body rows receive the shade and the heading background remains separately controlled.
3. Save/reload and repeat settled D/T/M checks without overflow.

## T04 — direct table style values

1. Set **Text size** to `16px`, **Text colour** to `#243447`, **Cell padding** to `10px`, and **Line colour** to `#b45f3c`.
2. Assert computed table/cell styles, line colour, and cell padding match after save/reload. Confirm the caption and heading semantics remain intact.
3. Record exact selector/variable ownership; do not infer that a table root style equals every cell style without computed proof.

## T05 — conditional heading, zebra, and caption styles

1. With either heading toggle on, set **Header background** `#e5efd8` and **Heading colour** `#205080`; assert those controls are available only when a heading exists and styles apply to header cells.
2. With **Shade alternate rows** on, set **Shading** `#f5d594`; assert the conditional control is visible and only alternate body rows change.
3. With non-empty **Caption**, set **Caption colour** `#743522`; clear Caption and assert the conditional control disappears and no stale caption colour remains in output.
4. Save/reload and inspect actual DOM/computed styles at D/T/M.

## T06 — responsive overrides and reset

1. Set distinct Desktop/Tablet/Mobile **Text size**, **Cell padding**, and line/text colours, for example `18px/16px/14px`, `12px/10px/8px`, `#243447/#304860/#183848`.
2. Save/reload and assert the selected values at 1280/834/414px with no horizontal overflow. Check responsive state on the rendered table and cells.
3. Reset Tablet and Mobile and save/reload; assert both inherit Desktop values instead of retaining stale declarations.

## T07 — Advanced, visibility, and condition

1. Set Advanced **HTML id**, **CSS classes**, **Custom CSS**, representative positioning/overflow/max width, and save/reload. Assert the table selector and scoped custom rule survive.
2. Toggle **Hide on Desktop**, **Hide on Tablet**, and **Hide on Mobile** one at a time. Assert `display:none` only at the selected breakpoint and record whether the DOM is retained.
3. In **Show only if**, choose a bindable field/property with **Condition** equals and value `show-table`; assert matching output contains the full table while non-matching output contains no orphan caption/rows.

## Evidence fields

For each case record the exact inspector label/value, conditional visibility state, pre-save and post-reload values, viewport, Preview DOM selectors/attributes, computed CSS, overflow result, and evidence JSON/image path. Keep all cases **unverified** until rendered DOM or computed-style proof is captured after save/reload. Candidate82 native verification of condition-control accessible labels remains a separate pending check.
