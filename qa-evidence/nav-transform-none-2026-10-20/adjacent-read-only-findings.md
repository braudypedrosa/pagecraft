# Adjacent read-only findings

These controls use an empty value for a responsive visual reset. The inspector's CSS writer deletes empty values, so a narrower breakpoint cannot override a wider value. They are outside the approved transform patch.

- **Common Shadow** — `app/src/core/index.ts:403-409,1637`. Reproduction: set a Desktop shadow, choose **None** at Tablet, save/reload, then compare the Tablet computed `box-shadow`. A focused regression should require an explicit `box-shadow:none` at Tablet while reset removes that declaration.
- **Image Filter** — `app/src/core/index.ts:416-422,795`. Reproduction: set Desktop Greyscale, choose **None** at Tablet, save/reload, then compare the Tablet computed `filter`. A focused regression should require `filter:none` at Tablet while reset restores inheritance.
- **Button Position** — `app/src/core/index.ts:847-853`. Reproduction: set Desktop **Push to column bottom**, choose **In the normal flow** at Tablet, save/reload, then inspect `margin-top`. The product must first choose an explicit reset value (likely `0`) because CSS `none` is invalid for margin.
- **Transition** — `app/src/core/index.ts:410-415`. Its preset list has the same empty **None** representation. Confirm whether transitions are intended to be breakpoint-responsive before changing the contract.
- **Fullscreen nav authored size** — `app/src/core/index.ts:8122`. Fullscreen mobile links have `font-size:clamp(24px,6vw,44px)`, which overrides the authored responsive Nav Size (root observed Tablet authored `17px`, computed `44px`). Fullscreen bounds, focus, and scroll locking passed. Product follow-up: decide whether the authored size should control fullscreen links or whether the inspector should explain the fullscreen-specific scale.

No source changes for these findings are included in this candidate.
