# Task close — live review owner actions

- Date and timezone: 2026-10-16, Asia/Manila
- Client / project: Personal Pagecraft project
- Task reference: Apply the approved live review check/X actions and add owner-only recoverable note removal.
- Status: Verified source candidate; staging release pending
- Authorized scope: Local Pagecraft Cloud live review client, routes, persistence, styles, and focused tests
- Environment: Local source, automated contracts, and native loopback review at desktop and phone sizes
- Working source: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft`, branch `development`, base `f77b67539d78e9298228abd06d5629cd66bec2fc`

## Work performed

- Moved resolve/reopen into the author row as a subtle Iconify Lucide check action and added an owner-only Iconify Lucide X action. Both use 14px glyphs in borderless, muted 28px desktop targets; coarse pointers retain 44px targets.
- Added recoverable per-note tombstones, an owner-only Removed filter, and Restore. Tombstones retain comment bodies, replies, and stable comment numbers.
- Kept removal state in an independent atomic record so a stale write from another server process cannot make a removed note visible again.
- Enforced owner-only removal and restoration on the server. Removed notes reject new replies and resolution changes until restored.
- Scoped the action focus outline so it survives the shared focus-style cascade while keeping the resting controls borderless.
- Delivery state: Reviewed source candidate; staging and production delivery remain pending.

## Verification

| Check | Environment or scope | Result | Evidence |
|---|---|---|---|
| Focused live review tests | Store, routes, client, bridge, reviews, Cloud header | Pass, 34/34 | `npx vitest run server/tests/live-review-client.test.ts server/tests/live-review-bridge.test.ts server/tests/live-reviews.test.ts server/tests/cloud-review-regressions.test.ts server/tests/reviews.test.ts server/tests/cloud-header.test.ts` |
| Multi-process race tests | Two file-backed store instances with paused resolve/reply writes | Pass | `server/tests/live-reviews.test.ts` |
| Legacy numbering | Two same-time unnumbered notes followed by numbered notes, removal, restore, and reload | Pass | `server/tests/live-reviews.test.ts` |
| TypeScript | Repository | Pass | `npx tsc --noEmit` |
| Patch integrity | Working tree | Pass | `git diff --check` |
| UI design detector | Changed live review UI sources | Pass | Impeccable detector returned no findings |
| Subtle action reference | Desktop 28px targets, coarse-pointer 44px targets, 14px glyphs, borderless rest state | Source matched | `/Users/braudypedorsa/Braudy/Projects/Pagecraft/itspagecraft/annotation-review.css` lines 51–59 and `/Users/braudypedorsa/Braudy/Projects/Pagecraft/landing-layout-guides-preview/evidence/subtle-action-icons-2026-10-16/` |
| Native functional flow | Fictional Pro owner on loopback 4918 | Pass | `qa-evidence/full-customer-retest-2026-10-14/native/review-owner-actions-functional.json`: resolve, reopen, remove, Removed filter, restore, reload, stable `#1`, retained reply, and focus fallback |
| Native desktop focus | 28px target and 14px icon | Pass | `qa-evidence/full-customer-retest-2026-10-14/native/review-owner-actions-focus-final.json`; solid 2px outline, zero border; `review-owner-actions-desktop-final.png` |
| Native phone focus | 390px viewport, coarse pointer | Pass | `qa-evidence/full-customer-retest-2026-10-14/native/review-owner-actions-focus-final.json`; 44px target, 14px icon, solid 2px outline, no horizontal overflow; `review-owner-actions-phone-accepted.png` |
| Final source remove/restore retest | Final local owner-action source | Pass | Root native readback after the focus fix |
| Combined candidate suite | Integrated local candidate | Pass, 2,263 tests / 5 skipped; 197 files passed / 2 skipped | `qa-evidence/full-customer-retest-2026-10-14/combined-functional-2026-10-16.log` |

- Remaining limitations: Non-owner browser personas were not repeated; server route tests cover owner/developer/reviewer/guest denial and client actions are absent for unauthenticated viewers. This is local-candidate evidence only. The final commit, staging deployment, and production release have not occurred.

## Time evidence

- Tracked or explicitly confirmed total: Unknown
- Billing state: Not prepared or submitted

## Next action and handoff

- Outstanding work: Clear the visual-baseline fingerprint gate, and repeat the required staging/release checks.
- Owner / dependency: Root integration agent
- Restart point: `server/src/live-reviews.ts`, `server/src/live-review-routes.ts`, `server/src/live-review-client.ts`, and `qa-evidence/full-customer-retest-2026-10-14/native/review-owner-actions-focus-final.json`
- Client context: No durable client-map change

## Client-facing summary

The local Pagecraft candidate now uses compact, keyboard-visible check and X actions beside each note author. Site owners can recover removed notes from a private Removed view, while other reviewers do not receive removed notes; native desktop, phone, reload, and recovery checks pass.
