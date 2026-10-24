# Managed mobile menu component card labels

Candidate base: f2c1e8e. Narrow Add.tsx subtitle clarification only. Follow definitions show “Follow navigation”; Custom and legacy definitions show “Custom content”. Managed definitions without properties omit the redundant empty-property notice. Ordinary component subtitles and all actions remain unchanged.

Two DOM regressions cover identical component names with distinct modes, true instance/menu usage, existing edit/rename/delete controls, retained property count, legacy Custom behavior, ordinary-component negative control and rendering without document mutation. Focused discovery/rename/delete/card suite: 24 passed. Typecheck passed.

Root reviewed the actual native candidate Components panel. Under root authorization, only the Add.tsx source hash in the baseline manifest was updated. The 12 current gallery documents are byte-identical to documents rendered from base f2c1e8e's tracked editor; the gallery renderer itself is byte-identical. Existing gallery PNGs and every other source fingerprint remain unchanged. This is reuse of unaffected baseline renders, not a fresh 24-image capture claim.

Two fresh sequential npm run build then npm run build:editor-package pairs match all 10 generated artifact hashes. Runtime, Core, schema and golden contract were not edited. Generated tracked differences are index.html and packages/editor/dist/editor.html. No Main build, commit, deploy or WordPress installation was performed by this worker.

Full suite after fingerprint review: 280 test files passed, 2 skipped; 2834 tests passed, 5 skipped. The initial full run had one expected stale-baseline failure and 2833 passing tests. After full green, the manifest write was narrowed to preserve original Unicode escape bytes outside the one changed fingerprint; a focused 4/4 baseline check passed again. Build hashes remain unchanged.
