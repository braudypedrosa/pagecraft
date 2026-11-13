# Task close — live-review multiline target labels

- Date and timezone: 2026-10-17, Asia/Manila.
- Project/task: Pagecraft full customer retest; live-review target-label spacing.
- Status: implementation verified in isolation; staging deployment and native confirmation pending.
- Authorized scope: normalize visible review labels extracted from multiline headings, with focused regression coverage.
- Environment: isolated checkout based on development commit `7824814bf10169c8204f94529948c5fadfbdf309`.
- Working source: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft`, branch `development`.

## Work performed

The review bridge previously read heading labels with `textContent`. An authored line break rendered as `<br>`, which contributed no separator and changed `Places shaped around people.` into `Places shapedaround people.` in the site outline and conversation breadcrumb.

The bridge now reads browser-visible text when available. Its DOM fallback clones the label node and replaces `<br>` elements with text spaces without interpreting HTML. It then collapses repeated whitespace, trims, and applies the existing length limit. Section and element-anchor labels share this path. Literal decoded text such as `&` and `<sample>` remains text and continues into the review UI through `textContent`.

- Files: `server/src/live-review-client.ts`, `server/tests/live-review-bridge.test.ts`.
- Delivery state: included in the containing development commit; deployment is pending.

## Verification

| Check | Environment or scope | Result | Evidence |
|---|---|---|---|
| Live-review bridge and client tests | Isolated checkout | 9/9 passed | `npx vitest run server/tests/live-review-bridge.test.ts server/tests/live-review-client.test.ts` |
| Server test suite | Isolated checkout | 823 passed, 5 skipped; 82 files passed, 2 skipped | `npx vitest run server/tests` |
| TypeScript typecheck | Isolated checkout | Passed | `npm run typecheck` |
| Patch integrity | Approved two-file source scope | Passed | `git diff --check` |
| Staging/native multiline label | Current deployed review UI | Pending | Recheck after the containing commit deploys |

- Remaining limitations: the corrected label has not yet been observed in the deployed native review UI. This server-only change does not modify shared builder assets, generated artifacts, or the reviewed component gallery.

## Time evidence

| Work item | Duration | Basis | Reference |
|---|---|---|---|
| Investigation, implementation, and verification | unknown | No timer or explicit duration was supplied | Current task |

- Tracked or explicitly confirmed total: unknown.
- Estimated time: not prepared.
- Excluded time: unrelated parallel WordPress and browser work.
- Billing state: not prepared.

## Next action and handoff

- Outstanding work: verify the development CI/deployment, then repeat the multiline heading target-label journey in the built-in browser.
- Owner / dependency: root task; deployed development commit.
- Restart point: the staging review containing the authored heading `Places shaped around people.`.
- Client context: no durable client-context change.

## Client-facing summary

Multiline headings now keep readable word spacing in review breadcrumbs and target labels. Automated server checks pass; deployed visual confirmation remains pending.
