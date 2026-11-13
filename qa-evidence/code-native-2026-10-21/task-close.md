# Task close — Partial Code native customer setting coverage

- Date and timezone: 2026-10-21, Asia/Manila.
- Project: Pagecraft.
- Status: bounded evidence recorded; broader Code and customer QA remain incomplete.
- Scope: read-only audit of candidate82 native Code evidence C01–C07.
- Source evidence: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/.codex-worktrees/condition-control-labels-609528e/qa-evidence/code-native-2026-10-21`.
- Main outputs: [coverage.json](coverage.json) and this handoff.

## Evidence recorded

| Case | Bounded result | Evidence |
|---|---|---|
| C01 | Literal markup, entities, newlines and final newline preserved as escaped text at Desktop/Tablet/Mobile after reload | `c01-literal-text-reload.json` |
| C02 | All 8 recorded language values rendered; Plain text has no token spans; highlighted languages expose expected token classes | `c02-language-matrix-reload-mobile.json` |
| C03 | Exact 58-character copy, line numbers, long-line wrap off/on, overflow behavior and Mobile controls-off state | `c03-copy-native.json`, `c03-line-numbers-reload.json`, `c03-long-lines-reload.json`, `c03-controls-off-reload-mobile.json` |
| C04/C05 | Base style values and five distinct syntax token colors across all devices; Plain text token controls produce no spans | `c04-c05-styles-reload.json`, `c05-plain-text-controls.json` |
| C06 | Desktop, Tablet and Mobile responsive values, reset to Desktop inheritance and reload | `c06-responsive-reload.json`, `c06-reset-reload.json` |
| C07 | Advanced identity/style values, visibility matrix, matching/nonmatching conditions and Always Show restoration | `c07-advanced-reload.json`, `c07-visibility-matrix.json`, `c07-condition-reload.json` |

The evidence covers 7 bounded scenarios, 8 language values, 3 responsive devices, 13 JSON records and 1 final mobile PNG. It is representative setting coverage, not an exhaustive count of every runtime-generated or conditional control.

## Remaining limitations

Shared Hover/Focus and Motion controls, arbitrary units/values/fonts/colors, CMS and component contexts, full editor create/edit/save flows, physical devices and alternate engines remain unverified here. Candidate83 now has bounded native shorthand/layout evidence; broader release acceptance remains root-owned.

No source, build output, browser state, database, deployment, commit or external system was changed.

## Related pre-fix padding observation

Candidate82 also records the original Code/Table padding inspector issue: the editor inputs were blank number fields while the published computed values were Code `16px 18px` and Table `10px 12px`. See `padding-control-blank-before.json` and `padding-control-blank-before.png`. Values were restored after capture; post-fix native acceptance remains root-owned.

## Candidate83 bounded native follow-up

Candidate83 now records final Code/Table shorthand and layout evidence under `qa-evidence/padding-list-controls-2026-10-21/native/`: complete Desktop/Mobile defaults with computed parity, quiet typing, linked blur/Enter error, valid correction, invalid-draft safety, adjacent-picker blur behavior, mixed units, zero, responsive reset and Table full-row layout. This remains bounded native setting/layout evidence; gallery, full-suite, deployment and broader customer QA are separate gates. The empty Code edge is also recorded in `c01-empty-reload.json`: with filename/Copy enabled but empty content, wrapper, code and Copy are absent at Desktop, Tablet and Mobile after reload.
