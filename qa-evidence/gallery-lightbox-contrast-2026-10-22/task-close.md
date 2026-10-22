# Gallery lightbox contrast task close

Base: `2c0d4b402c1ff4790787851e2b83e94ae744336b`

The Gallery lightbox navigation and close controls now use Ink backplates at 72% resting and 88% hover opacity. White icons retain at least 8.10:1 contrast over tested pure-white and pure-black image pixels. Keyboard focus uses a white inner outline and a 92% Ink outer ring, while the existing 46px control box and layout remain unchanged.

The failing regression recorded both translucent-white states at 1:1 on white imagery and the missing two-tone focus treatment. The final focused run passes 8 tests across contrast, keyboard runtime, and focus-state coverage. Typecheck passes. The full suite passes 2,715 tests in 260 files, with the existing five tests in two files skipped.

The official WordPress golden was regenerated and verified. Semantic review confirms the same intended CSS delta on all four routes, their derived source hashes, and the expected signed release and deployment envelope fields. Route content and every artifact field outside routes are unchanged.

Two final ordered build pairs ran `node build.mjs` followed by `node packages/editor/build.mjs`. All ten required artifacts exist and are byte-identical across both builds. Core, the focused regression, and the golden fixture remained frozen across those builds.

Before evidence: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft/qa-evidence/gallery-native-2026-10-22/gallery-final-mobile-lightbox.png`. Root owns final native before/after acceptance. No browser, Main, WordPress, commit, push, or deployment work was performed here.

The Impeccable detector reported one pre-existing unrelated placeholder-image warning at `app/src/core/index.ts:5461`. It did not report a finding in the changed lightbox CSS.
