# Rich text list structure and link safety

List commands produced invalid paragraph-wrapped lists. Browser preview reparsing added empty paragraphs and spacing. Native selection-preserving normalization now keeps list nodes as siblings, preserving marks, nested lists, text and caret position.

The link prompt accepted JavaScript URLs, and stored rich text rendered them in local Preview. The prompt now uses the existing strict rich URL policy. Rich-text rendering applies the existing content sanitizer for both editor and public output, without mutating stored documents. No unsafe link was clicked. No production exploitation claim is made.

Root native final-build acceptance covered multiline Bold lists, typing inside the retained list item, UL to OL conversion, safe links through CmdK, unsafe prompt rejection, Unlink, builder Undo/Redo, save/reload and three breakpoints. Saved markup has no empty paragraphs or horizontal page overflow. Full suite: 2,662 passed, five existing skips. Typecheck and unchanged WordPress golden pass. Thirty actual gallery interactions pass, and all 24 captures match with zero changed pixels.

See root-acceptance.json for exact scope and historical evidence precedence. Staging and WordPress deployment remain pending. Full customer QA remains open.
