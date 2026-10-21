# Accordion native coverage — bounded partial record

This record covers the candidate85 native Accordion fixture only. It is evidence for the recorded content and style cases, not an all-controls or production completion claim.

Content evidence covers add, edit, duplicate, remove, reorder, escaped text and newline rendering, empty-editor/public behavior, the three recorded Open on load modes, enabled and disabled One open at a time behavior, Mobile Enter/Space activation, Plus / minus, Caret, None, empty-answer and blank-question Site checks, and Show me recovery. The evidence spans Desktop, Tablet, and Mobile where listed in `coverage.json`; the keyboard receipt is specifically Mobile.

Style evidence covers the recorded question/answer/marker/divider colors, row padding, row gap, question/answer sizes, row radius, weight 400/500/600/700, zero gap/radius/default-current-color state, responsive values, and breakpoint reset/inheritance. The reset receipt shows currentColor/rgb(17,19,17), not restoration to an original factory color token.

The final native receipt reports no console errors and has readable Desktop and Mobile PNGs. The final state is an authored fixture with four questions; it is not deployed or production proof. The known candidate85 whole-count typing issue is unrelated and remains outside this Accordion record.

Open scope includes arbitrary values and units, whitespace-only answers, broader malformed/long-content boundaries, Hover/Focus/Motion, shared Advanced/visibility/conditions, broader keyboard parity, and full cross-module customer QA. These limits prevent promoting this bounded evidence to a complete Accordion or full-customer QA claim.
