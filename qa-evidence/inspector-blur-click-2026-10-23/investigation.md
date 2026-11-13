# Inspector blur to state-button click investigation

## Finding

The reported sequence, entering Advanced `HTML id`, then immediately clicking the Style `Hover` state button, is consistent with a synchronous inspector repaint during the input blur. The first click can leave the state at Resting; a second click works because the newly rendered button is then the active target. This is a code-supported trigger, but the native report is the only direct reproduction evidence here. No browser or database check was run in this read-only slice.

## Code path

- `app/src/ui/inspector/Inspector.tsx:501-504` declares `HTML id` as an Advanced text control.
- `app/src/ui/inspector/Controls.tsx:38-43` renders text controls with `onInput={w.live}` and `onBlur={w.done}`.
- `app/src/ui/inspector/ctl.ts:47-54` applies the value, saves, ends the transaction, then calls `repaint('right')` from `writer.done`.
- `app/src/ui/inspector/Inspector.tsx:284-296` renders State buttons with only `onClick`. `Hover` is not a custom-select trigger.
- Therefore `ctl.ts:55-83` does not defer this blur. Its special `relatedTarget` handling only covers `.pc-custom-select-trigger`; a State button falls through to the immediate `repaint('right')` at line 83.
- `Inspector` is registered as the `right` painter and rebuilds the inspector tree from current state. The existing lifecycle test records that structural tab/selection changes discard the old inspector subtree, while ordinary property repaints usually preserve it (`tests/inspector-custom-select-lifecycle.test.tsx`). The exact DOM replacement during this specific blur-to-button gesture is inferred from the event ordering and needs a focused test or native trace.

The likely browser ordering is: pointerdown on `Hover` moves focus, `blur` on HTML id runs `writer.done`, `repaint('right')` patches or replaces the inspector, then the original pointerup/click may target a detached or replaced button. Because `StatePick` has no pointerdown guard or deferred repaint, its `onClick` may not run. This explains why the second click on the fresh button succeeds. It does not prove that every browser or Preact patch path detaches the node.

## Smallest focused test proposal

Add a component test beside the inspector tests with a real selected node and Advanced tab:

1. Render `Inspector`, focus the `input` associated with `HTML id`, dispatch `input` with a value, and assert the value is staged.
2. Obtain the `Hover` button from `.statepick` after switching to a tab that renders StatePick, then dispatch a realistic pointer sequence: `pointerdown`, blur the HTML id input with `relatedTarget` set to that button, `pointerup`, and `click` in one `act` block.
3. Assert `C.state.ui.st` is `hover` after the first gesture and that the saved `n.adv.htmlId` remains the typed value.
4. Repeat with an ordinary repaint control as a control case, and assert the inspector has one State group and no duplicate right panel.

The current `tests/ui.setup.tsx` helper's `click()` dispatches only a synthetic `click`, so it cannot expose this ordering by itself. The test should use explicit focus/blur and pointer events, or a small local helper that dispatches them in browser order. If jsdom cannot reproduce detached-target behavior, instrument the button's click handler or assert the DOM identity and `C.state.ui.st` immediately after blur, then retain the native reproduction as the behavioral proof.

## Scope and non-findings

This investigation does not establish a defect in `StatePick`'s state model, the HTML id save path, or the custom-select workaround. It identifies the unhandled class of blur destinations: ordinary buttons whose click depends on the same inspector subtree that `writer.done` repaints synchronously. Any fix should preserve the existing custom-select deferral and avoid losing the blur commit.
