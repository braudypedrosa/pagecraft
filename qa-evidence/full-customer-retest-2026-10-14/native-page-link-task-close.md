# Task close — native WordPress page destinations

- Date and timezone: 2026-10-17, Asia/Manila.
- Project: Pagecraft, full customer retest requested in this chat.
- Status: implementation verified locally; deployment and native WordPress acceptance pending.
- Authorized scope: fix customer-discovered bugs, development/staging deployment and local WordPress QA updates. Production promotion and database purges are excluded.
- Source: `/Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft`, development. WordPress backend changes are recorded separately in the WordPress repository.

## Confirmed customer failure

On newly created and published WordPress post 436, the builder offered only the portable document's obsolete `Untitled page · /untitled-page` destination. Selecting it saved `untitled-page.html`; following the rendered button reached WordPress's Page not found screen. The WordPress page itself had already been renamed and published at `/qa-complete-page-lifecycle-2026-10-17/`.

- Before evidence: [selector](native/wordpress-preview35-page-destination-before.json), [actual 404](native/wordpress-preview35-page-destination-route-before.json).
- Only disposable QA post 436 was edited. Protected posts and existing work remain preserved.

## Change

The WordPress host supplies its native page catalogue to shared link controls. The picker uses canonical same-origin HTTP(S) URLs, current WordPress titles, current-page identification and draft/private labels. Cloud project-page links retain their existing behavior. Loading, failure and Retry preserve saved links; opening a picker does not author a document change. Legacy portable links remain explicitly identified until a user chooses a native page. Blank values do not silently match the site's root Home page.

The paired WordPress backend change repairs only the current document's unambiguous legacy self-links in ordinary Save output and maintenance compilation. It preserves stored source JSON and does not guess mappings for other project pages. Page catalogue permission checks exclude unreadable non-public pages and Trash.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Focused native picker/shared controls and typecheck | 76 tests passed | `/tmp/pagecraft-native-page-blank-fix-checks.log` |
| Full isolated suite, including editor packaging and typecheck | 2,279 passed, 5 skipped; 199 files passed, 2 skipped | `/tmp/pagecraft-native-page-full-test.log`, SHA-256 `64fa0f2fce019f782beaad03b2f068157acfc395b8c608cfea1445e5dd3ea5ad` |
| Two isolated builds | 12 stable outputs byte-identical | `/tmp/pagecraft-native-page-blank-build-comparison.json` |
| Built-in browser gallery interactions | 30/30 passed | [behavior](gallery/native-page-final-behavior-checks.json) |
| Gallery images | All 24 byte-identical and pixel-identical to reviewed baselines; manifest verifies 24 images/28 source files | [comparison](gallery/native-page-final/exact-comparison.json) |
| Main unrelated generated working artifacts | All 11 preserved exactly | Existing preservation record plus final pre/post-commit assertion |
| Native selector, ordinary Save repair and public follow | Pending Preview36 installation | Exact review page: `http://pagecraft-wordpress-qa.local/wp-admin/admin.php?page=pagecraft-editor&post=436` |

The full customer retest remains incomplete. These checks do not establish production readiness, public reachability of draft pages, slug-rename tracking for ordinary URL links, or repair of arbitrary cross-document legacy destinations.

## Time and handoff

Tracked duration: unknown. Billing not prepared or submitted. Next action: commit reviewed source/build artifacts without overwriting unrelated generated working files; verify staging deployment, pin the exact source into WordPress Preview36, and complete native save/reload/public follow acceptance on post 436.
