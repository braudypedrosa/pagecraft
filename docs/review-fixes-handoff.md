# Review fixes: handoff (2026-10-05)

This continues the production-readiness review of build `90723a6`:
- the report: https://claude.ai/artifact/NBcWwNsJadvbYV3Y3hv3LP;
- the evidence: `qa-evidence/e2e-2026-10-03/log.md` and `readiness-report.html`.

The user asked for every verified finding to be fixed **except H2**. Staging and production sharing one database is intentional for now. Ship to **staging only**. Don't promote to production unless asked.

Repo: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft`, branch `development`. It is local only and not pushed: `origin/development` is still `90723a6`.

## Where things stand

**On local `development`, merged and committed:**
- `2e0c774`: `tools/deploy/receive.py` kills a deploy candidate that ignores SIGTERM, with tests. It is already installed on the server as `~/pagecraft-deploy/receive-staging.py`, and the old copy is kept as `receive-staging.py.bak-20261005`. The leftover candidate process (PID 1710557) was killed. Production's `receive.py` on the server is an older separate file and was left untouched.
- `daaf218`, merged in `ba6b036`, stores and scheduling (H6, H7, M9):
  - reviews and live reviews are stored one file per record (`server/src/record-files.ts`), with a one-time migration of the old state files;
  - the site cache TTL is 30 s, with `byId(id, {fresh:true})` for the schedule runner, forms and Uplisting;
  - the runner re-reads a schedule after claiming it and stamps claims with the current time.
- `405c80f`, merged in `2c6fd68`, gateway and site deletion (M6, M7, L4, raw errors):
  - the key hash is cached;
  - `putBlob` cleanup only removes what that call uploaded;
  - the library upload locks the user row;
  - errors are sanitized (`shownError` in app.ts);
  - the delete route deletes in the database first, then removes the files, and each store has a `removeSite`.
  - **The coordinator changed:**
    - The agent's `session_replication_role = replica` trigger bypass is gone. A site with signed releases is now refused cleanly (`SITE_HAS_RELEASES`, 409 → `/sites/:id/settings?error=site_has_releases`).
    - `removeSite` was rewritten for the per-record review and live-review stores.
  - The live database has 0 sites with releases or WordPress connections (checked 2026-10-05).
- `956c8e2`, merged in `9c813da`, forms, analytics and cleanup:
  - **H5:** failed form submissions go to `failed/` with a cap of 200 and don't count toward the 10k limit.
  - **M8:** analytics caps apply when merging, and `resetAt` is written on delete.
  - **L7:** half-hour zones, the 90-day boundary, and the click endpoint returns 204 on a bad URL.
  - **OAuth sweep.**
  - **Account pages:** dates use `<time data-local>` and the browser's zone; a reviewer "Assigned to you" list; a `people_self_role` message.

**Committed on agent branches, NOT merged yet (merge in this order):**
1. `worktree-agent-a53a948886abfaf9b` (`96949c9`), sign-in, limits and credentials (H3, H4, M3, M4, M5, L1, L2, /mcp scope):
   - `requestSource` trusts `cf-connecting-ip` only with `PAGECRAFT_TRUST_CLOUDFLARE=1`; the throttle evicts instead of refusing; captcha runs first;
   - `safeNext` uses `new URL` with a same-origin check; `token_hash` confirmation happens on POST; a `pc_recovery` cookie gates password reset;
   - WordPress credentials: a list, revoke, rotation and 90-day expiry, and revocation on password change;
   - editor sessions are capped at write; "Leave site" added; the site limit counts only sites the user created.
   - **It conflicted** with the merged branches in `server/src/account-pages.ts` and `server/tests/people.test.ts`. That merge was aborted; redo it and resolve both by keeping both sides.
   - **Gateway ordering:** it adds the gateway op `account.ownedSiteCount` and changes `rotate`/`byRefresh`/`createOwnedSite`. Deploy the gateway before the server (the server falls back safely, but deploy in that order).
2. `worktree-agent-a7dc0b374eb11a3ea` (`ade029e`), performance and hosted sites (H10, M11, L8):
   - fonts and shared CSS go once per site as `assets/site.<hash>.css` and `assets/fonts/*.woff2` (Stillwood `index.html` goes from 394 KB to 77 KB);
   - fewer identity and membership round trips (`server/tests/request-count.test.ts`);
   - template images are copied into site assets;
   - sitemap base URL default, styled 404, and a 301 from old slugs.
   - **Behaviour change:** only `assets/*` is cached as immutable; `sitemap.xml` and `robots.txt` now use `max-age=0`.
3. `worktree-agent-a81f372d8292c6d15` (`e894cec`), editor data loss (H8, H9, M10, M12, M13, M14, L5, L6):
   - `instances()` also scans definitions and blocks; `componentDelete` resolves instance values and root styling;
   - a `loadBlocked` flag; refused component-mode drops; instance-root inline edit through `instSet`; unique `pageDup` slugs; CSV short rows keep their values;
   - WordPress nonce refresh through `admin-ajax.php?action=rest-nonce`;
   - a proposal claim route, `POST /api/sites/:id/proposals/:p/claim`, plus deterministic insert ids;
   - `htmlId` kept; colour and class deletes cover hover styles; dirty flag and `pagehide` flush.
4. `worktree-agent-ae9e495b44171c917` (`c0fc444`, **WIP, unfinished**), editor script injection (H1, M1, M2, template-preview sandbox, content.ts wording):
   - new `app/src/core/safe-html.ts`, `tests/render-safety.test.ts`, plus edits to the core render, `libraries.ts`, `Libraries.tsx`, `builder.html` (canvas CSP), `server/src/app.ts` and `content.ts`.
   - **It was interrupted while verifying the canvas CSP in headless Chrome** (jsdom doesn't enforce CSP).
   - Finish it in its worktree `.claude/worktrees/agent-ae9e495b44171c917`:
     - review the diff against the brief below;
     - verify the CSP doesn't break editing (selection, inline edit, drag and drop, preview widgets);
     - run `npx tsc --noEmit` and the full `npx vitest run`;
     - **drop `index.html` and `dist/core.cjs` from that commit** (generated; rebuild after merging);
     - amend the WIP message.

**Brief for the WIP security branch.** Escape CMS-bound text unless the field is rich:
- the Text `html` slot is `t:'rich'` (core ~633);
- `cmsFieldTypes` returns `['rich','text']` (~4209);
- `guessBindings` auto-binds text to `html` (~4277);
- `boundProps` copies the value raw (~4414); the text widget renders `${p.html}` (~7258); `instValue` has the same gap (~4546).

Sanitize rich output at render with an allowlist.

Sanitize library bundles on import (`libraries.ts` `planLibraryImport` ~321/378):
- rich HTML goes through the allowlist;
- `target` is either `''` or `_blank`;
- ids are safe, and hrefs pass `safeUrl`;
- embeds need confirmation in `Libraries.tsx`.

Add a canvas srcdoc CSP (`builder.html` ~3063; repaint via `#s-root.innerHTML` ~3258). Fix `stripScripts` for `/onload`-style handlers, `javascript:` and `srcdoc` (core ~6982).

In editor preview mode, render embeds in an iframe with `sandbox="allow-scripts"`.

Escape these:
- `target` (only exactly `_blank`) at core ~7198/7254/7290/7292/7308/7524;
- edit-mode ids (~7140);
- the breadcrumb href (~7409);
- the lock bar component name (`builder.html` ~3249).

Template preview CSP gets `sandbox allow-scripts` (app.ts ~1704). In content.ts, rich-text links with safe schemes count as content.

## Remaining steps, in order
1. Merge branches 1 to 4 into `development` in the main checkout. Never commit `COVE-COMPATIBILITY-FIXES.md` or `tools/run-local-candidate.mjs`: they are unrelated local edits.
2. Run `node build.mjs`, then commit the regenerated `index.html` and `dist/` together with their sources.
3. Run `npm test` (build, `tsc` and vitest). The suite was 1510 tests at `90723a6`; each branch added more. A known flaky one: `cms-lifecycle` once returned 422 under load.
4. **UI gallery gate.** It is needed because `builder.html` and `account-pages.ts` changed.
   - Start the fixture: `node tools/qa-ui.mjs` (:4944; restart it after each build).
   - Capture: `node tools/capture-ui-gallery-chrome.mjs qa-evidence/review-fixes-2026-10-05`.
   - Compare: `node tools/ui-baselines.mjs compare qa-evidence/review-fixes-2026-10-05`.
   - Inspect the differing images (crop them with sharp first). Expected changes:
     - account dates as `<time>`;
     - "Assigned to you";
     - the WordPress-sites section;
     - "Leave site";
     - the confirm page;
     - "Not saving" and other new toasts;
     - "Being applied".
   - Record: `record qa-evidence/review-fixes-2026-10-05 --reviewed`, then `npm test` again.
5. **Deploy the gateway.**
   - **Production's server (`cc026d6` on build.itspagecraft.com) uses the same gateway.** Before deploying, diff `supabase/functions/pagecraft-db/` against `90723a6` and confirm every changed op is backward-compatible with `cc026d6`'s calls. Especially:
     - error responses now carry codes and generic messages;
     - `site.delete` refuses sites with releases;
     - the WordPress token rotation changes.
   - Deploy from a temp copy: `supabase functions deploy pagecraft-db-v3 --project-ref pwgwvicrdbjiecjxiyvl --no-verify-jwt --use-api`. That would be v23.
6. Push `development`, then watch the GitHub "Deploy branch" run with `gh run watch <id>`. If a CloudLinux restart fails with a transient ValueError, run `gh run rerun <id> --failed` against that SHA's run. Check `https://staging.itspagecraft.com/__deployment`.
7. **Re-test on staging** with the owner (braudypedrosa@gmail.com) in Chrome on the QA site "QA E2E 2026-10-03" (`59497c7d-0688-481e-90b7-990a3640a1c5`).
   - **Spoofing:** `cf-connecting-ip` no longer escapes the form rate limit. The test: 11 JSON POSTs to `/forms/<site>/nsn4pq8ws` must give 415×10 then 429, and a spoofed header must still get 429.
   - **Page weight:** the published page has no base64 fonts. Re-publish first, then check the size and load time.
   - **Other checks:**
     - sitemap and 404;
     - the old-slug 301;
     - failed form posts don't count toward the cap;
     - account dates in local time;
     - template images in Media for a new site;
     - signed-in latency (resource timing);
     - review and live-review data survive (the migration ran).
   - Update the log and republish the report artifact from `qa-evidence/e2e-2026-10-03/readiness-report.html` (edit that HTML directly; the generator scripts were scratch files and are gone).

## Ops notes
- Leave `PAGECRAFT_TRUST_CLOUDFLARE` unset: nothing fronts the origin, and DNS points straight to 67.223.118.197 (LiteSpeed). LiteSpeed overwrites `X-Forwarded-For` with the real client address; that was verified.
- Set `PAGECRAFT_COOKIE_SECRET` on staging if more than one Node process can serve it; otherwise recovery cookies are signed per process.
  - Generate it on the server and merge it into the env vars with cloudlinux-selector, printing names only (see the server-ops memory).
  - Ask the user before changing production env.
- Supabase settings to tell the user about: Turnstile must be on, plus "require current password" for password changes.
- WordPress plugin, in the separate `pagecraft-wordpress` repo (not edited): suggest it pass `'restNonceUrl' => admin_url('admin-ajax.php?action=rest-nonce')`.
- Follow-ups that would need a schema migration, so ask the user first:
  - an accept step for library shares;
  - a previous-refresh-digest column for WordPress token reuse detection;
  - storing the WordPress site URL for the credentials list.

## Rules that still apply
- Never create accounts or enter passwords on non-local hosts. Test accounts are fine on localhost only. `npm run local` starts the local stack; it needs Docker, and `supabase stop` stops it.
- Test email goes only to hello@braudyp.dev. Never use the creationworx address.
- Don't permanently delete staging data; the user does that.
- Print env var names only, never values.
- Ask before live schema changes. Never run `supabase db push` or `migration up` against the linked project.
- Hidden-Chrome quirks: use page JS with `requestSubmit`, resource timing for latency, and keep each JS call under 45 s.
