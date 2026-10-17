# Task close — Unit control validation

Internal evidence record.

- Date and timezone: 2026-10-17, Asia/Manila
- Source baseline: `75ed8acb11bb3297d4889f3edade56d6af31807e`
- Status: focused red/green implementation and archive verification complete; integration, full build, full suite, gallery baseline, commit, deployment, packaging, and native acceptance remain root-owned
- Scope: `app/src/ui/inspector/Controls.tsx`, `tests/unit-control-validation.test.tsx`, and this evidence only

## Change

- Unit controls now default to a minimum of zero unless the control explicitly permits negatives with `neg`.
- An explicit `min` overrides that default, and an explicit `max` is also enforced.
- Finite out-of-range values are clamped in both the visible input and stored CSS value. In-range raw decimals such as `2.50` retain their authored spelling.
- Empty input continues to clear the declaration. Unit choice, responsive breakpoints, interaction states, and reusable-class destinations retain their existing behavior.
- Root-owned metadata overlays supply `neg` for the three Letter spacing controls plus Advanced Top/Z-index, and `min: 1` for Gallery Columns. Those files were consumed by the archive tests and were not edited in this scope.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Red archive | Expected failure | Exact `75ed8ac` Controls plus current Core/Inspector metadata and the new test: 3 failed, 1 passed, exit `1`; old UnitCtl exposed no truthful minimum and accepted out-of-range values |
| Green focused archive | Pass | New Controls plus the same metadata: 4 files and 13 tests passed, exit `0` |
| TypeScript | Pass | `npm run typecheck`, exit `0` |
| Default nonnegative controls | Pass | Collection gap, width, height, and two custom-gap properties clamp `-2.5` to `0` across `px`, `rem`, `%`, and `em` |
| Metadata bounds | Pass | Gallery Columns clamps `0` to explicit minimum `1`; Heading, Button, and Nav Letter spacing plus Advanced Top and Z-index retain legitimate negatives |
| Bound and clear behavior | Pass | Explicit minimum/maximum clamp visibly and in storage; `2.50` remains `2.50`; empty removes the declaration |
| Destination regressions | Pass | Mobile, hover-state, reusable-class, empty unit choice, and existing box-unit/box-spacing/responsive tests passed |
| Main generated-byte guard | Pass | All 11 protected generated paths are byte-identical before and after; no main build ran |

## Evidence and hashes

- Implementation SHA-256: `app/src/ui/inspector/Controls.tsx` `cddb2ebe22f86d90c808278c1b8be14a59802a8de1c5e42212d6e326caebcd2f`.
- Test SHA-256: `tests/unit-control-validation.test.tsx` `69d083b29b1a7ba8200b71f640afe398c62a39edb808bb6deacfeb01adb709b5`.
- Root Core metadata SHA-256: `1be9a19e53cf45e350a6c7c2f4b96208d4432a89642afed31a47c6f490f220bb`.
- Root Inspector metadata SHA-256: `5d998981b99bf7519ddcbe1ff47894701b42d8e687d40def5b3c858326834beb`.
- Machine-readable record: `unit-validation-build.json`.
- Logs: `unit-validation-red.log`, `unit-validation-green-focused.log`, `unit-validation-green-typecheck.log`, and both archive npm-ci logs.

## Boundaries and limits

- Every npm, Vitest, and TypeScript command asserted a working directory outside the main repository and ran only in clean archive exports.
- Both archive installs report the existing three high-severity dependency findings; dependencies were not changed.
- No main build, full suite, browser, WordPress state, commit, push, package, staging, or production action occurred.
- The root agent owns integration with the other active source overlays, dual build/full-suite checks, component-gallery review, and native verification.
