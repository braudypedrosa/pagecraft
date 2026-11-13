# Accordion shared-controls checklist

Status: **unverified planning scope**. This checklist is for the native Accordion fixture (`ngn4901he`, local tab 44 / localhost:4980). The direct Accordion Content and Style controls already have bounded candidate85 evidence; every case below remains unverified until a native receipt proves it.

Source references: `app/src/core/index.ts` (`DEF.accordion`, `COMMON_STYLE`, `advControls`) and `app/src/ui/inspector/Inspector.tsx` (`Styling`, `State`, `Motion`, `Visibility`). Existing direct evidence: `qa-evidence/accordion-native-2026-10-22/coverage.json`.

## Shared Style and target scope

For each case: select the Accordion, edit the named control, save, reload, inspect the rendered Accordion and computed style at Desktop, Tablet, and Mobile, then reset the breakpoint override and confirm inherited values. Preserve the direct fixture and restore its saved state after each case.

| Case | UI-visible control/group | Representative goal and expected proof |
| --- | --- | --- |
| AS01 | Styling → **This element** | Set a shared Style value on the Accordion element. Save/reload must affect only this element and survive the inspector target repaint. |
| AS02 | Styling → **Add a class…** / class target `.<name>` | Create/apply a class, set one shared value, and confirm every class use changes while the class target is selected; removing the class restores the element target. |
| AS03 | State → **Resting**, **Hover**, **Focus** | Set a small visible change in each state. Published/Preview CSS must use the matching state selector; Resting remains the base state. Accordion Focus is applicable because its question uses `:focus-visible`. |
| AS04 | Spacing → **Padding**, **Margin** | Use representative Desktop/Tablet/Mobile values and reset Tablet/Mobile. Confirm computed box spacing and saved inheritance. |
| AS05 | Background → **Colour** | Set a solid background colour and verify the Accordion wrapper’s computed background at all three breakpoints. |
| AS06 | Background → **Image**, then **Size**, **Position**, **Repeat** | Add a safe local/image-source value, then verify the three dependent controls appear and affect computed background. If no image is present, Size/Position/Repeat being hidden is expected conditional UI, not a bug. |
| AS07 | Border & shadow → **Border**, **Radius**, **Shadow** | Set a border, radius, and representative shadow; verify wrapper/item rendering and save/reload. Clear each value and confirm the authored declaration is removed. |
| AS08 | Effects → **Opacity**, **Transform** | Set opacity and a small transform in Resting, then an alternate Hover value. Verify state-specific computed output and no unexpected layout change. |

## Advanced and visibility

Use the Advanced tab and exact labels below. For every case verify editor DOM, saved document value, reload readback, and public/Preview output where the setting affects markup or layout.

| Case | UI-visible control | Representative goal and expected proof |
| --- | --- | --- |
| AA01 | Identity & layout → **HTML id** | Set `faq-main`; the Accordion wrapper has the exact unique `id`, remains link-targetable after reload, and rejects/handles an unsafe duplicate according to the existing ID policy. |
| AA02 | Identity & layout → **CSS classes** | Set `faq-list compact`; classes appear on the intended wrapper and remain after save/reload without changing the selected Style target unexpectedly. |
| AA03 | Identity & layout → **Position** | Exercise Default and one supported non-default value such as Relative; verify computed `position` and no accidental stacking/layout change. |
| AA04 | Identity & layout → **Top** | Use a small `8px` value and reset; verify the authored offset only applies when Position permits it. |
| AA05 | Identity & layout → **Z-index** | Use integer `2` with Position Relative, then reset. A non-integer/invalid draft should not silently create a saved invalid declaration. |
| AA06 | Identity & layout → **Overflow** | Exercise Visible, Hidden, Auto and Default against a long answer; verify clipping/scroll behavior matches the selected value. |
| AA07 | Identity & layout → **Max width** | Use `32rem`, then None; verify the wrapper width and saved keyword/reset behavior. |
| AA08 | Identity & layout → **Custom CSS** | Use a narrow scoped rule such as `& { outline: 2px solid #b45f3c; }`; verify it applies to the Accordion scope, survives reload, and is removed on clear. |
| AV01 | Visibility → **Hide on Desktop**, **Hide on Tablet**, **Hide on Mobile** | Toggle each independently. The editor retains the selected Accordion; public output omits it only at the selected breakpoint and restores after reset. |
| AV02 | Visibility → **Show only if** | With a collection field or component property in scope, select a source and verify the exact saved binding survives reload. If no field/property is available, the control being absent is expected conditional UI, not a bug. |
| AV03 | Visibility → **Condition** | Exercise the available condition operators for the selected source. For equality/inequality also verify **Value to compare**; confirm hidden editor outline versus public omission. Blank/nested/legacy condition cases remain open. |

## Motion / animation

Accordion declares `animation`, `effects`, and `decoration` capabilities, so Motion is expected for a single Accordion selection. These are unverified and should be tested in Preview and the published render, not inferred from inspector state alone.

| Case | UI-visible control | Representative goal and expected proof |
| --- | --- | --- |
| AM01 | Motion → **Transition** | Select a supported transition such as `all .25s ease`; change Hover or Focus colour/radius and verify the computed transition and visual interpolation after the transition settles. |
| AM02 | Motion → **Animation** | Select one entrance animation. Preview and public output should apply it once on entry; **— none —** should remove the animation. |
| AM03 | Motion → **Duration**, **Delay**, **Easing** | With Animation selected, set representative `0.4s`, `0.1s`, and `ease-in-out`; verify saved `n.anim` values and rendered animation timing. Invalid/incomplete values remain open. |
| AM04 | Motion → **Only the first time it comes into view** | Toggle the checkbox, reload Preview, and confirm repeat behavior matches the setting. This requires a real scroll/entry path; editor paint alone is insufficient. |

## Limits and unsupported states

- The existing Accordion evidence covers direct Content/Style cases only; it does not promote any checklist row above to tested.
- `Size`, `Position`, and `Repeat` under Background are expected to remain hidden until an image/background source exists; that conditional absence is not a bug.
- **Show only if**, **Condition**, and **Value to compare** are expected only when a bindable collection field or component property exists. Missing scope is an unsupported test setup, not evidence of a broken Accordion control.
- Shared controls, state selectors, Motion timing, arbitrary units/values, accessibility technology, and full create/edit/save/reload combinations remain open.
- Do not claim complete Accordion QA, exhaustive shared-control coverage, or production readiness from this checklist.
