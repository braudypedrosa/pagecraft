# Task close — dialog notifications covering choices

- Date: 2026-10-21, Asia/Manila.
- Project: Pagecraft customer QA.
- State: source/test candidate frozen; combined build and native acceptance remain root-owned.

## Changes

Dialog notifications now use a reserved region in the active dialog layout. Their capped, scrollable region can shrink; the dialog body retains scrolling and the footer remains separate. Existing viewport popovers stay in place outside dialogs. No additional explanatory copy was added.

Owned files: `shared/action-feedback.js`, updated `tests/action-feedback.test.ts` geometry regression, new `tests/modal-notification-layout.test.ts`. See `source-tests.sha256`.

## Verification

- RED proof: old fixed host fails reserved-layout regression (`logs/red.log`).
- Focused: 28 tests across 2 files pass (`logs/focused.log`).
- Typecheck passes (`logs/typecheck.log`).
- Diff check passes (`logs/diff-check.log`).
- Tests cover moving an existing notice into custom/transformed and nested dialogs, returning to viewport placement, preserving choice focus/click handling, scrollable bounded region, unchanged body/footer, live roles, multiple notices, dismissal, destroy cleanup and popover state cleanup.

jsdom does not establish rendered geometry or physical hit testing. Root owns desktop/mobile/full-height native acceptance, combined build/full suite, gallery review and release. Root-provided before-proof subfolder is untouched. No standalone build, browser, database, baseline, Main, commit or push action was performed.

## Handoff

Copy the non-overlapping source/test diff into the rich-condition candidate for one combined verification cycle. Preserve existing unrelated changes. Wider QA remains open.

Time/billing: unknown; not prepared.
