# Common Ground 1.1 — redesign draft

Review the native Cloud site at http://localhost:4890/common-ground-release/ and the isolated WordPress site at http://127.0.0.1:4892/.

The six pages are Home, Projects, Courtyard house (Project Detail), Practice (About), Services and Contact. This is a new draft; the live 1.0.0 release is unchanged.

## Customize

- Use Settings / Site Settings for the shared body and heading fonts, Brick, Paper, Linen and text colors. The Practice name has its own typography token.
- Select a Project plate to edit its title, type, description, image, alt text, destination and action. Duplicate the instance for independent project content; edit the shared component when all plates should change together.
- Clear a Project image to omit it without a broken image placeholder. Images and crops remain native inspector settings.
- Edit the shared header/footer through their native global controls. On WordPress, navigation destinations remain WordPress-owned.
- Replace all fictional project and practice content with verified information. All four images are AI-generated demonstration scenes; two are new for this redesign. No completed projects or professional credentials are claimed.
- Configure Contact's receiving service and verify actual receipt. The portable package intentionally ships with no receiving endpoint and disabled submission. Test sites use a local HTTPS receipt logger that sends no email.
- Use Desktop, Tablet and Mobile overrides; save, reopen and inspect your content before publishing.

## Verification scope

Current package `64f9502e61aa7c9f3dc712eaf6b92e41a1021b004be5712ad347740e2b293e1d` passes independent visual review in both isolated hosts. All six pages were checked at 390, 768, 1024 and 1440px, plus 767/769/1023/1025px. Both hosts passed native shared-style and independent-instance editing, 1/3/7 project counts, long headings, uneven descriptions, optional/replacement imagery, inspector overrides, save/reopen and local published output. Actual local form receipts were recorded; no email was sent.

WordPress acceptance applies only to baseline `8311421` plus the unreleased v5 host patch documented in `evidence/wordpress-host-patch-v5.json`. This fixes native font persistence, automatic paragraphs breaking native grids, and injected image loading. After import, open **Site Settings → Save settings** and verify the selected fonts on the frontend. These are host fixes, with no hidden template CSS. They have not been released to production WordPress.

Cloud acceptance uses baseline `0f7134b`, editor 0.2.15, and an isolated fixture-backed install/editor/publication harness. It does not certify production authentication or database integration.

Read `REDESIGN-REVIEW.json` and `workflow.json` for current evidence and exact scope. The package checks, 13 focused template tests, and full WordPress regression suite pass. Earlier candidate captures remain historical and do not substitute for current-package evidence.

## Release status

The reviewed candidate received upload authorization. Final QA then corrected the mobile worktable crop from center to top alignment; that changed the package checksum. The original workflow requires approval of the exact final package, so approval is pending for this corrected candidate. No 1.1.0 release promotion or production upload has occurred. Version 1.0.0 remains unchanged.
