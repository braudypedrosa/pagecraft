# Task close — native WordPress page destinations

- Date and timezone: 2026-10-17, Asia/Manila.
- Project: Pagecraft, full customer retest requested in this chat.
- Status: scoped fix deployed to staging and accepted natively in local WordPress Preview36. Full customer QA remains incomplete.
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
| Native selector, ordinary Save repair and public follow | Passed on installed Preview36 | [Native acceptance](native/wordpress-preview36-native-page-links.json), [final picker](native/wordpress-preview36-native-page-picker-final.jpg), [read-only source/render/revision verification](wordpress-contract/preview36-native-436-page-picker-final-readonly.json) |

Main `4d23a5b47f3653eee855c51a4d0630b3f8fbe4e0` passed CI `38948030380` and deploy `38948030505`; staging reported the exact commit. Production remains `cc026d65d275f16374eb356d0331cebb93430c85`. WordPress Preview36 pins exact main 4d from WordPress commit `4407399c5eb7b06aa40f713191b35d09bfe60243`; CI `38948539067` passed PHP 8.1–8.3. The installed 54-file manifest matches exactly.

Native ordinary Save changed only the test button label in the source document; its legacy `untitled-page.html` value remained unchanged while stored/public HTML used the canonical native URL and followed successfully. Tab-scoped blocking of the catalogue GET produced a recoverable Retry state without dirtying the document. Clearing the block and Retry restored all 16 readable page choices. No-link picker opening remained unselected and clean. Explicit Home and current-page selections survived Save/reload. Post 436 ended at v18 with its original label and canonical current-page URL. Protected ten posts, revisions, metadata, design and stylesheet remain exact; safety revisions are coherent and prior records remain retained.

The full customer retest remains incomplete. These checks do not establish production readiness, public reachability of draft pages, slug-rename tracking for ordinary URL links, or repair of arbitrary cross-document legacy destinations.

## Time and handoff

Tracked duration: unknown. Billing not prepared or submitted. This scoped fix has no remaining acceptance action. Continue the broader customer retest using its remaining queue.
