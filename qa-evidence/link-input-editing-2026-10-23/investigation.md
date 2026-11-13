# External URL input reclassification investigation

## Finding

The reported first-character loss is directly explained by the current Link control. After selecting `External URL`, typing `#qa-image-111-b` one character at a time can remove the focused custom URL input after the first `#`. The full-string test helper does not expose this because it assigns the completed value before dispatching one input event. No browser or database action was run in this read-only slice.

## Exact trigger

`app/src/ui/inspector/Controls.tsx:871-993` computes `link` once per render. The external URL input at lines 978-993 does this on every `input` event:

1. It writes the current value through `C.applyC(n, c, C.buildLink({ ...C.linkOf(...), value }))`.
2. It calls `L.repaint()`.
3. Because the render's captured `link.mode` is `url`, it clears `C.state.ui.lmode` when the value is nonempty and immediately calls `repaint('right')`.

On the first typed character `#`, the stored value is now `#`. The next render calls `C.linkOf`, which delegates to `parseLink` at `app/src/core/index.ts:2699-2711`. A leading hash is classified as `{ mode: 'page', page: hereSlug, frag: ... }`, so `shownMode` changes from `url` to `page` at `Controls.tsx:889-893`. The URL input is rendered only for `shownMode` in `url`, `email`, or `phone` at lines 974-993, so the focused field disappears while the user is still typing. The next character goes to the wrong target or is dropped.

This is proven by the source control flow. The exact browser focus loss and character drop are the expected consequence and match the Cloud report, but were not independently reproduced here.

## Existing coverage gap

`tests/ui.test.tsx:744-793` covers WordPress picker selection, redraw recognition, and a complete manual external URL value. `tests/ui.test.tsx:940-955` covers page mode and the target toggle. The shared `r.type` helper in `tests/ui.setup.tsx` assigns the complete string and fires one input event, so no existing test models sequential `#`, `q`, `a`, and so on input or asserts that the active input remains connected after each character.

## Smallest fix direction

Keep the live document write and canvas repaint on `input`, but defer the inspector's `repaint('right')` for the custom URL field until `blur` (or an explicit Enter commit). The blur handler should end the transaction and repaint once. This preserves the selected URL mode and focused input while typing, while allowing the completed value to reclassify to a page anchor after the user leaves the field. The empty-value path should continue setting `C.state.ui.lmode` to `{ key, mode: 'url' }`, so clearing the field does not fall back to No link.

A focused regression should select External URL, type `#qa-image-111-b` one character at a time, assert the same `input[aria-label="Custom or external URL"]` stays connected and retains the draft after each character, then blur and assert the final stored value and expected page-anchor classification. Include a normal `https://` value to verify the URL picker still resolves after blur, and assert one transaction/history entry rather than one entry per character.
