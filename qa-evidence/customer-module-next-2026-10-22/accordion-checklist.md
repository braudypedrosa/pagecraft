# Accordion checklist and count-control audit

- Date: 2026-10-22
- Source reviewed: candidate83 base `89969665` in this checkout (`app/src/core/index.ts`, `app/src/ui/inspector/Controls.tsx`). This is not a verified candidate85 source audit; candidate85 integer flags must be checked against its exact source before any finding is promoted.
- Status: planning only; all native cases below are **unverified**.
- Scope: direct Accordion Content/Style controls plus shared Advanced/Visibility planning. This is not an exhaustive Motion/Hover/Focus or arbitrary-value plan.

## Accordion direct controls

Source definition: `app/src/core/index.ts:1150-1190` (`DEF.accordion`). Public rendering is `app/src/core/index.ts:9135-9155`; the widget uses native `<details>`/`<summary>`.

| ID | UI label | Source key | Type/options | Minimum native case and expected proof |
|---|---|---|---|---|
| A01 | Questions | `items` | `qa`; question/answer rows; new row `A new question`, blank answer | Add Accordion, edit/add one row with question `Shipping & returns?` and answer containing `<`, `&`, quotes, and a newline; save/reload Desktop/Tablet/Mobile; expect escaped summary/answer DOM and retained values. Delete all rows; editor shows `Add a question in the panel`, public output omits the empty Accordion. |
| A02 | Open on load | `open` | `All closed` (`none`), `The first one` (`first`), `All open` (`all`) | Save each option/reload all breakpoints; expect `details[open]` count 0, 1, and item-count respectively when `single` is off. Editor selection may force panels open and is not public proof. |
| A03 | One open at a time | `single` | toggle | With 3 rows, test on/off after reload. With `single` on and `open=all`, source explicitly reduces public open state to the first item because shared `name` makes details exclusive; expect one `details[open]`. Keyboard open/close two summaries and verify native details behavior. |
| A04 | Marker | `marker` | `Plus / minus` (`plus`), `Caret` (`caret`), `None` (`none`) | Save each option/reload D/T/M; expect wrapper `data-marker`, marker span for plus/caret, absent for none. Confirm question text remains accessible and marker is `aria-hidden`. |
| A05 | Empty/edge rows | `items` | row values may be blank | Test blank question/nonblank answer, nonblank question/blank answer, and blank/whitespace answer. Expect no crash; inspect summary/answer DOM and Site checks for documented `accordion-no-question`/`accordion-no-answer` findings. |

## Accordion direct Style controls

Source definition: `app/src/core/index.ts:1174-1189`; values write CSS custom properties on the Accordion wrapper.

| ID | UI label | CSS key | Type | Minimum native case and expected proof |
|---|---|---|---|---|
| S01 | Divider colour | `--ac-line` | color | Set `#b45f3c`; save/reload D/T/M; computed first/last item border color matches; reset restores default. |
| S02 | Row padding | `--ac-pad` | unit, `U.space` | Set `18px`, responsive `12px` Tablet and `8px` Mobile; verify computed padding after reload and clear overrides for inheritance. |
| S03 | Row gap | `--ac-gap` | unit, `U.space` | Set `24px`, then `0px`; verify computed wrapper gap and reset/inheritance. |
| S04 | Question size | `--ac-q-size` | unit, `U.size` | Set Desktop `20px`, Tablet `18px`, Mobile `16px`; verify summary computed size and clear overrides. |
| S05 | Question weight | `--ac-q-weight` | select: `400`, `500`, `600`, `700` | Exercise all four values; expect computed weight and persisted option after reload. |
| S06 | Question colour | `--ac-q-color` | color | Set distinct color and verify summary computed color; reset. |
| S07 | Answer size | `--ac-a-size` | unit, `U.size` | Set responsive sizes and verify answer computed size; reset/inheritance. |
| S08 | Answer colour | `--ac-a-color` | color | Set distinct color and verify answer computed color; reset. |
| S09 | Marker colour | `--ac-mark` | color | Test plus and caret markers with distinct color; verify pseudo-element effect; none remains absent. |
| S10 | Row radius | `--ac-radius` | unit, `U.radius` | Set `16px`, then `0px`; verify item border radius and responsive reset. |

## Shared inspector cases

The Accordion definition advertises `spacing`, `decoration`, `effects`, and `animation` capabilities. The shared `COMMON_STYLE`/Advanced and conditional controls are generated outside the direct definition; inspect the rendered panel before executing. At minimum plan one saved/reloaded case for spacing margin/padding, background/border/shadow, Motion transition/animation, Hover and Focus, Advanced target class/token/scope/reset, Visibility Hide Desktop/Tablet/Mobile, and Show only if. Expected DOM proof must distinguish editor-retained nodes from public `display:none`/omission and verify responsive inheritance/reset. Their exact runtime set is conditional and remains unenumerated here.

## Native sequence

1. Add Accordion to a fresh page; confirm three default rows and public `<details>` structure.
2. Edit/add rows, choose one Content option, save, and record persisted values before reload.
3. Reload editor and preview/public output at Desktop, Tablet, and Mobile; capture row count, summary/answer text, `details[open]`, `data-marker`, and computed style values.
4. For responsive styles, set Desktop, override Tablet and Mobile, reload each breakpoint, then clear overrides and verify inherited values.
5. Exercise keyboard focus/Enter/Space on summaries, including `single` on; confirm accessible name is the question text and marker is not announced.

## Count/index control audit

The only writable unitless count-like controls found in the inspected candidate83 base definitions are:

- **Collection List — `Items per page` (`per`) and `Show at most` (`limit`)** at `app/src/core/index.ts:575-584`. Both are `t: 'unit'`, `units: ['']`, with no `integer` flag. Inspector validation in `app/src/ui/inspector/Controls.tsx:164-203` therefore permits decimals. Runtime consumers use `parseInt` at `app/src/core/index.ts:3917`, `4665-4666`, `5031`, `5043`, and `8848`; `listPageCount` uses `Math.ceil` at `5033`. This is the concrete whole-count mismatch: a persisted `2.5` is displayed/stored while rendering uses effective `2`. Existing receipt `qa-evidence/list-native-2026-10-22/l05-fractional-page-size-native.json` records first item numbers `2,3`, next `5,6`, nine pages, and no dropped transition. Existing source-level coverage is in `tests/collection-public-large-dataset.test.ts:14-90`, but it uses integer `per` values and does not prove decimal UI validation.
- **Gallery — `Columns` (`--g-cols`)** at `app/src/core/index.ts:1265`. It is explicitly `integer: 1`, `min: 1`; renderer normalization at `app/src/core/index.ts:7621-7627` rounds/clamps numeric declarations before emitting CSS, and public CSS uses `repeat(var(--g-cols,3),...)` at `8297`. Existing tests at `tests/unit-control-validation.test.tsx:55-259` cover fractional input, min/clamping, scientific/legacy declarations, and renderer normalization. No analogous mismatch is indicated in this path.
- **Forms — `Grid columns` (`--f-columns`)** at `app/src/core/index.ts:946`. This is a discrete select (`One` through `Four`), not a free numeric count; runtime CSS consumes the selected repeat template.
- **Box — `Columns` (`grid-template-columns`)** at `app/src/core/index.ts:649`. This is a discrete `GRID_COLS` select, not a free numeric count.
- **Slider — `Slides in view` (`--sl-w`)** at `app/src/core/index.ts:503-531`. This is a discrete select (`One`, `Two`, `Three`, `Four`, `One and a peek`, `As wide as their contents`), not a free numeric count.

No additional whole-count free numeric control was found in the inspected candidate83 base DEF/core paths. This is a static source audit, not runtime completeness proof, and it must not be applied to candidate85 without an exact source comparison; generated/conditional inspector controls and arbitrary module settings remain outside this narrow count audit.

## Open limits

- All Accordion rows and style cases above remain unverified in native UI.
- No claim is made for every arbitrary length, color, font, Motion, Hover, Focus, Advanced, or Visibility value.
- The List decimal mismatch is identified with source pointers and an existing receipt; this checklist does not retest or change it.
