# Motion timing validation candidate 88

## Scope

Candidate-only validation for the Inspector Motion `Duration`, `Delay`, and `Easing` fields. The change keeps invalid drafts local, associates blur/Enter errors with the field, accepts CSS timing values through `CSS.supports` when available with a bounded test fallback, and isolates drafts by selected node/breakpoint/state/target/setting.

## Verification

- RED: `npx vitest run tests/inspector-motion-validation.test.tsx` failed before the patch because `banana` persisted as `n.anim.dur` without an invalid/error association.
- GREEN: focused motion tests passed (5); aggregate Inspector regressions passed (4 files, 21 tests).
- Typecheck passed: `npx tsc --noEmit`.
- `npm run build` and `npm run build:editor-package` passed.
- Deterministic editor build pair matched across 11 artifact hashes.
- `npm audit --audit-level=moderate` passed with 0 vulnerabilities.
- Impeccable detector returned `[]`.
- A prior suite recorded the baseline gate while review was pending (2,619 passed, 5 skipped). Final `npm test` passed: 250 files passed, 2 skipped; 2,620 tests passed, 5 skipped.

## Served asset verification

The requested port 4990 was occupied by an unrelated `next-server` PID 53612 and was left untouched. A port-only temporary copy of the frozen `tools/.qa-ui-4990.mjs` harness is running at PID 11811, terminal session 86484, on `http://localhost:4991/`.

Outside-browser fetch verification passed for `http://localhost:4991/edit/s1` (HTTP 200): the shell references the same prepared hosted asset paths produced by `prepareHostedEditor(index.html)`, and all 7 prepared assets (2 CSS, 4 TTF, 1 JS) returned HTTP 200 with byte-for-byte and SHA-256 equality. The native UI interaction URL for root-owned follow-up is `http://localhost:4991/edit/s1`.

Manifests:

- [source-tests-assets.sha256](source-tests-assets.sha256): 25 source/test/reference/generated entries, including the complete 11-file generated editor artifact set plus Core/UI/ColorPop/public snapshot references.
- [ui-baseline.sha256](ui-baseline.sha256): 25 baseline files kept separate from the source/test manifest; `reviewed-baseline.previous.sha256` preserves the pre-review HEAD manifest hash and `reviewed-baseline.sha256` records the current reviewed manifest hash.
- `build-editor-1.sha1` and `build-editor-2.sha1`: historical identical 11-artifact deterministic pair; `generated-artifacts.sha256` is the current SHA-256 manifest.

## Limits

Native Motion interaction and gallery acceptance are recorded in `final-receipt.md`; deployment, Main checkout changes, and commits are outside this candidate. CSS fallback validation is bounded for jsdom; production browser `CSS.supports` remains authoritative. Root should stop PID 11811 after UI verification.
