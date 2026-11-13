# Task close — Styling target pressed state and Rich Text focus bridge

- Base: `aa664f27052db9aa32b5b4d3719b95cd766fa238`
- Status: root accepted native behavior and the reviewed gallery; the final full suite retains one unrelated submissions timing failure documented below.
- Styling target change: `This element` and every applied class button now expose mutually exclusive `aria-pressed` values, including after switching targets.
- Rich Text change: generated class and node focus styles now also match a descendant link with keyboard-visible focus. The bridge is scoped to `.pagecraft-wysiwyg`, uses `:focus-visible`, excludes ancestor Link Blocks, and preserves local-over-class ordering.
- Regression proof: both failures were reproduced before their fixes. Final focused checks pass 9/9 across Rich Text, styling target, Nav, and Gallery focus behavior.
- Verification: typecheck passed; 11 generated artifacts were identical across two builds and the final test-triggered build; demo audit found 0 issues; `git diff --check` passed.
- Final default-concurrency result: 2,497 passed / 5 skipped. The submissions filesystem stress test exceeded its explicit 30-second limit by 140 ms. The unchanged submissions file then passed 16/16 in isolation in 9.11 seconds. A complete diagnostic run capped at two Vitest workers passed 2,498 / 2,498 with 5 skipped in 206.94 seconds. No source, configuration, timeout, assertion, or threshold changed; the default-concurrency failure remains reported.
- Native acceptance: root verified keyboard contained-link Focus, pointer non-activation, class/local precedence, reset behavior, and both styling-target pressed states in the built-in browser.
- Gallery: 30/30 behavior checks passed. All 24 images passed the 0.1% comparison threshold; 23/24 are exact byte and pixel matches. Root explicitly accepted the sole 38-pixel native-caret delta in `builder-fields-1440.png` and recorded the reviewed manifest.
- Harness: `http://localhost:4956/`, fictional in-memory QA API; session `2591`; root completed native review.
- Boundaries: this worker made no Main write or browser action and made no commit, push, deployment, or database change.
