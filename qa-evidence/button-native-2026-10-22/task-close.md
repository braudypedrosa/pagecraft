# Button native bounded acceptance B01–B13

## Evidence

Candidate88 native Button evidence covers shared/direct typography and surface scoping, responsive shared values at Desktop/Tablet/Mobile, local responsive clear, detach and shared-update Undo/Redo with reload, four variants × four icons in Mobile editor DOM, alignment at all three devices plus public alignment, long-label Mobile Fill wrapping, email/phone/external metadata, an authored internal form anchor activated in Preview, Column position behavior, keyboard focus after reload, two-instance component typography, and settled actual pointer hover.

B13 used ordinary built-in-browser CDP mouse movement over the visible Button. No forced pseudo-state or DOM mutation was used. The settled result was `hover:true`, `focus:false`, background `rgb(68,85,102)` (`#445566`), transition `0.18s`, and console errors `[]`. The initial one-step-earlier colour was recorded as transition timing, not a product failure.

## Limits

This is representative bounded evidence, not full Button QA. Responsive/variant/host combinations, every direct Content/Style control, component-library edge cases, link safety variants, hover/focus combinations, Motion, Visibility, conditions, attributes/custom CSS, arbitrary labels/values, and all cross-feature flows remain open.

Evidence files: `b01`–`b13`, `console-after-b12.json`, `button-component-mobile-final.png`, and `button-mobile-public.png`.
