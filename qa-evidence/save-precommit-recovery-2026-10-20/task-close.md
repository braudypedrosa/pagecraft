# Task close — Cloud save response validation

- Base: `c3c72e90aacb1ad4acaa92d217408802f7de8c67`
- Environment: isolated local worktree only
- Delivery state: uncommitted, unpushed, undeployed

## Change

The Cloud Web adapter now acknowledges a successful save only when the response contains a finite numeric version. Malformed JSON, null, missing, string and non-finite versions reject into the existing uncertain-save recovery flow. Version zero remains valid. The recovery regression covers a pre-commit 502, old readback, retained dirty/ambiguous state and an identical explicit retry that succeeds.

## Verification

- Focused tests: 22/22 passed.
- Full suite: 220 files passed, two skipped; 2,451 tests passed, five skipped.
- App, Core and editor package builds passed.
- Two editor package builds produced 11/11 byte-identical generated outputs.
- Demo integration passed with zero findings; its tracked output was restored because it contains unrelated prior generated drift and nondeterministic IDs.
- UI baseline gate passed unchanged: 24 images and 28 source files.
- Typecheck, dependency audits and `git diff --check` passed.

Detailed hashes and logs are in `verification.json`. No Main, browser, baseline, dependency or deployment changes were made. The validation closes a real adapter contract gap; it does not prove malformed HTTP 200 content caused the observed customer save warning.
