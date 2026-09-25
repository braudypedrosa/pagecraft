# Phase 3 reviewer role and assigned previews

Owners invite authenticated reviewers, assign an immutable Phase 2 snapshot, and
collect anchored comments plus request-changes, approval, or cancellation.
Approval belongs to that snapshot, not later draft edits. Reviewers cannot edit,
publish, manage media, or inspect submissions.

## Permission and notification contract

`SITE_ROLES` includes `reviewer`. Generic `roleAllows` stays false for that role;
`roleMayReview` permits owner and reviewer review routes. Content editors receive
403 on review routes. Snapshot file routes allow site admin or an assigned
reviewer. Assign requires a reviewer membership and a known publication for the
site. Cancel is owner-only. A cancelled review rejects further decisions.

In-app notifications cover assignment, comments, and decisions. Email uses the
existing notice sender when SMTP is configured; staging workers stay disabled, so
delivery runs on the request path when present.

**Correction (2026-09-26).** Until this date no deployed build emailed a notice. The
notice sender was gated on the sign-in-link rule (`mail = accountAuth ? null : …`), and
deployed builds always use Supabase account auth, so every notice was queued in
`reviews/state.json` and never sent. Notices now use SMTP whenever `SMTP_HOST`, `SMTP_USER`,
`SMTP_PASS` and `MAIL_FROM` are set (for Resend: `smtp.resend.com`, port 465 or 587, user
`resend`, the API key as password, and a verified sender). The earlier queue is deliberately
not replayed, so recipients never get a burst of stale mail.

## Backend compatibility

Additive migration `20260915020000_reviewer_role.sql` extends
`site_users_role_check` to `owner | content | reviewer`. Older app builds never
write `reviewer`. Gateway `pagecraft-db-v3` accepts the role on grant, role change,
and invitation provision, and allows invitation redirects for both
`https://staging.itspagecraft.com` and `https://build.itspagecraft.com`.

## Validation

- Focused suite covers reviewer 403s for PUT/publish/submissions/unassigned
  snapshots, assign + assigned snapshot access, edit redirect to Reviews,
  anchored comments, changes_requested, cancel lock, notifications, People invite
  role, and host capabilities with no editor verbs for reviewers.
- Staging app commit for the review UI: `68e03d4`. Live shared database migration
  and gateway version 19 applied before reviewer grant.
- Labeled staging site: QA Functional Fixes 2026-09-11
  (`f4c8f726-ca62-4174-9a8f-a41eaebfc03d`). Reviewer
  `braudypedrosa+pagecraft-cms-qa@gmail.com` received membership and assignment of
  snapshot `48b1b662-331e-4f92-9629-ce9efbb0e2f1` (v66).
- Live reviewer checks: PUT/publish/submissions 403; assigned snapshot 200;
  unknown snapshot 404; `/edit` redirects to Reviews; rail omits Submissions;
  no Cancel control; anchored comment; `changes_requested`; assignment appears in
  Notifications. Review detail had no horizontal overflow at 768px.
- Owner cancel after `changes_requested` and owner in-app decision notifications
  remain covered by automated tests. The shared Cursor browser cookie jar switched
  to the reviewer session after QA login, so a second live owner cancel pass was
  not repeated in that window.
- Private evidence: `qa-evidence/roadmap-phase3-2026-09-15/`.

## Account UI follow-up in this release

Sign-in Turnstile uses Cloudflare `data-size="flexible"` so the widget fills the
account form width. Gallery source hash for `server/src/account-pages.ts` was
updated; shared specimen CSS used by gallery PNGs was otherwise unchanged.

## Post-release UI work

The validation above covers app commit `68e03d4`. The Reviews and notifications
surfaces were then aligned with the shared workspace chrome across `f1623b8`
through `38ded90`: a topbar notifications mini menu and inbox layout, the sites
rail kept on notifications and account settings, the display name in the topbar
account control, live review links and shared annotations, the Reviews dashboard
matched to the shared Submissions table, and removal of the snapshot review
archive from that dashboard.

`38ded90` shipped an unused `escapeReview` alias left behind by that removal.
`tsc --noEmit` rejects unused locals, so its test and deploy workflows both
failed and staging stayed on `414cbe9` until `d371309` removed the alias. Any
acceptance recorded against the Reviews dashboard between 2026-09-15 and that
fix describes `414cbe9`, which still showed the archive.

## Rollback

Redeploy the previous staging Node release to hide Reviews UI. Leave the additive
role check and gateway role acceptance in place so existing `reviewer` rows remain
valid. Do not drop reviewer memberships during rollback. Production promotion and
WordPress package updates are separate approvals.
