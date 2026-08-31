# Pagecraft Connected WordPress v1 QA

> Historical checkpoint: this document records the superseded Connected-mode prototype preserved on `bp/connected-v1-checkpoint`. The active WordPress direction is the native handoff plan in `WORDPRESS-NATIVE-V1.md`.

Date: 2026-08-26
Scope: local v1 implementation and acceptance evidence
Hosted acceptance: blocked until two disposable hosted WordPress administrator accounts are supplied

## Acceptance summary

| Area | Result | Evidence |
| --- | --- | --- |
| Canonical schema and migrations | Pass | Schema adoption/migration tests; unknown newer schemas fail closed. |
| Draft versus Publish | Pass | Autosaves remain draft revisions; explicit warning-confirmed Publish creates an immutable release. |
| Deterministic release contract | Pass | Repeated compiler fixtures produce identical artifacts/digests; Ed25519 manifest, keyset, deployment, and package verification tests pass. |
| Ordered staging to production | Pass | Concurrent and rapid-release tests serialize releases, gate production on staging, recover after terminal failure, and reclaim abandoned reservations. |
| Immutable hosted output | Pass | Published HTML and assets remain frozen after draft edits/deletions; rollback republishes older content as a higher release. |
| Supabase/Postgres persistence | Pass | All migrations apply cleanly to disposable PostgreSQL 17; connected tables have RLS enabled and no `anon`/`authenticated` table grants. |
| WordPress profiles | Pass | Docker verifies Pagecraft Theme mode on staging and Existing Theme mode on production using WordPress 6.6/PHP 8.1. |
| Plugin/theme packages | Pass | Deterministic package builds, GPL declarations, production-root-key fail-closed behavior, and exact PHP 8.1 lint pass. |
| Cross-runtime trust | Pass | The TypeScript-generated golden release is verified, staged, and script-approved by PHP tests. |
| SEO adapters | Pass | Fallback, Yoast, Rank Math, and conflict cases pass in both setup profiles without duplicate metadata. |
| Managed/native ownership | Pass | Managed pages are locked and server-side mutations are rejected; native WordPress pages remain editable. |
| Retention ownership safety | Pass | Trusted pruning is scoped to an exact native object ID and kind; nested deletes cannot borrow that authority, and failed reference queries preserve the object. |
| Public routing | Pass | Managed routes render in both profiles, unknown routes stay 404, clean URLs contain no `.html`, and legacy `.html` paths use 301 redirects. |
| WordPress link portability | Pass | Drafts store target-neutral content references; releases resolve them against each paired target and fail closed on missing, moved, ambiguous, stale-origin, or tampered references. |
| Forms/privacy | Pass | WordPress-managed forms verify signed ownership tokens, honeypot/rate/size limits, encrypted storage, 90-day default retention, mail status, and privacy export/erase hooks. |
| CMS write-back | Pass | Production-only typed item writes use monotonic per-item sequences and exact idempotency; stale/out-of-order writes are rejected, draft revisions remain recoverable, and public values stay unchanged until Publish. |
| Offline/rollback safety | Pass | Active local files continue to render without Pagecraft; disconnect does not clear the active release; emergency rollback pauses advancement. |
| Hosted staging/production | Blocked | Requires two disposable HTTPS WordPress sites and administrator accounts for the hosted phase. |

## Automated gates

- Root build, TypeScript, and Vitest suite: pass, 24 files passed / 1 skipped and 1,019 tests passed / 3 skipped (1,022 total).
- WordPress PHPUnit: pass, 290 tests / 1,678 assertions on host PHP 8.5.2; every theme, connector, and fixture PHP file also parses on the required PHP 8.1 runtime.
- WordPress Docker matrix: pass on WordPress 6.6/PHP 8.1 for Pagecraft Theme and Existing Theme profiles, deterministic signed package inputs, fallback/Yoast/Rank Math SEO ownership, blocking SEO conflict, activation, and rollback smoke checks.
- Supabase Edge Function: `deno fmt --check` and `deno check` pass; bounded, content-addressed blob protocol tests pass 3/3.
- Migration dry run: all ordered migrations, security-invoker reporting view, RLS/default-grant checks, and database advisors pass on disposable PostgreSQL 17; the real two-client release-concurrency suite passes 3/3.
- Security/dependency gates: `npm audit` reports 0 vulnerabilities; Composer reports no advisories; `git diff --check` and the private-key/secret-filename scan pass.
- Independent final code audit: no concrete local P0/P1 remains. The conservative retention behavior can leave an orphaned native object after a post-commit reference-query failure, but it cannot delete active or rollback data.

## Manual browser checks

The local sites were exercised through the built-in browser, not a separate Chrome session.

- Staging (`Pagecraft Theme`): Operate screen, managed route, and native fallback behavior were inspected on the local WordPress 6.6/PHP 8.1 target.
- Production (`Existing Theme`): Operate screen, native homepage ownership, and the managed route inside the active theme shell were inspected on the local WordPress 6.6/PHP 8.1 target.
- Managed Gutenberg page: the Pagecraft ownership notice and “Edit in Pagecraft” action are present; no enabled Save control or editable title remains.
- Native Gutenberg page: no Pagecraft ownership notice is present; normal Save and title editing remain enabled.
- Staging CMS record: the Pagecraft typed-field UI is read-only, with no nonce, enabled inputs, publisher controls, taxonomy controls, or trash action.
- Production CMS record: only the signed Pagecraft typed-field/media controls are enabled; core publisher details and trash are hidden, and the action is labelled “Save to Pagecraft draft.”
- Responsive rendering: both profiles were checked at exact 390, 768, 1,024, and 1,440 px widths. All 24/24 fixture component IDs render, `scrollWidth` equals `innerWidth`, and no duplicate IDs, horizontal overflow, missing image alt text, untitled iframes, unnamed buttons, unresolved Pagecraft tokens, or `.html` links were found.
- Public SEO and runtime: each managed route has one release root, H1, canonical, and description; form actions are target-local; both targets have no browser console errors or warnings.
- Interaction checks: navigation open/close and Escape, tabs click and ArrowRight, accordion, lightbox open/close, pagination clean URL, and video facade activation pass. No real form was submitted. Clipboard write and native-dialog Escape could not be fully synthesized by the browser harness and remain covered by automated runtime tests.
- Screenshots are stored under `qa-evidence/connected-v1/` for both profiles at all four widths, managed/native Gutenberg ownership, and staging/production CMS behavior.

## Deliberately unprovisioned

- No production root or release private key is committed. Generate the offline root/release pair, store only runtime release-key secrets in the server environment, and inject only the root public key into signed WordPress packages.
- No hosted WordPress credentials were supplied, so installation, pairing, real webhook delivery, cache-plugin clearing, SMTP delivery, and public desktop/mobile verification remain unclaimed.
- No production deployment was performed during this implementation pass.
