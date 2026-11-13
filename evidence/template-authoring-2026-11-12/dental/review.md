# Linden Dental A2, complete-site review

State: private staging candidate, awaiting complete-site and exact-package approval. All nine photos and exact L2 logo are user approved. A2 palette and typography are retained. No customer-catalog addition or production publication has occurred.

- Preview: https://staging.itspagecraft.com/owner/template-drafts/dental-clinic-a2/0.1.0/preview/19/index.html
- Native builder: https://staging.itspagecraft.com/owner/template-drafts/dental-clinic-a2/0.1.0/edit
- Draft: dental-clinic-a2, version 0.1.0, revision 19.
- Package hash: `05faa8a606ae9e383ffa10083d5484b96856529c06a6128dfbff7030db66f456`.
- Six pages: Home, Treatments, Care Team, Your First Visit, Patient Information, Contact.
- Native schema 14, pagecraft-core-14, pagecraft-renderer-2.
- Styles: Figtree and Source Sans 3; Sky/Ice role tokens. Native reusable header/footer, navigation, form, images and content controls.

## Before and After

Before is the initial revision-14 native draft before responsive and final-footer corrections, not an existing customer site. After is the exact revision-19 package candidate.

- Before desktop: [original](Before/home-1440.png), [top crop](Before/home-top-1440x720.png).
- Before mobile: [original](Before/home-390.png), [top crop](Before/home-top-390x720.png).
- After desktop: [top](After/home-top-1440x720.png).
- After mobile: [top](After/index-top-390x720.png), [contact lower state](After/contact-lower-390x720.png).
- All four widths: [responsive records](After/checks.json), [visual review and capture limitations](final-visual-review.md).

## Verified

Actual hosted MCP created the native draft, uploaded approved assets, saved, validated and exported exact revision 19. Export and declarative JSON round trip preserve the same hash. All 20 existing catalog package hashes were revalidated without mismatches or released-content changes.

Six pages were inspected at 390, 768, 1024 and 1440px, with fonts and images decoded and no horizontal overflow. Mobile menu spans the viewport, exposes all five links, closes on Escape and returns focus. Navigation stays on immutable revision 19. Unconfigured form is disabled in the private package preview. Browser warning/error logs were empty.

Cloud QA used a fresh unpublished site. Because Cloud has no generic site-ZIP upload UI, twelve exact package assets were uploaded through native Media, references remapped to their assigned IDs, and native project JSON imported. Six-page navigation and images passed in native preview. A heading edit persisted through save/reopen. Reimport restored source content with twelve media, without duplicates. This does not claim customer-picker or published-site acceptance.

WordPress QA used a new isolated localhost runtime. The exact ZIP was imported through the native WholeProjectImporter via a CLI bridge, without replacing existing pages or publishing. Native heading edit/save/reopen passed. Exact reimport updated the same six pages, created none, retained twelve media and restored original copy. Six draft frontend previews render correctly. A discovered native-menu draft-query bug was fixed, tested and pushed to WordPress development at `2cfa51a`; all PHP 8.1/8.2/8.3 CI jobs passed. Production plugins were not released.

## Limits and release gate

The contact form has no delivery configuration. No form submission, booking, medical-data processing or payment was attempted. Customer implementations need their own contact information, real provider photos and configured services. Cloud preview is an editing preview, not published output. Fresh customer-picker and released-plugin acceptance remain final release checks after explicit package approval. The full promotion ledger, including broader native editing exercises and the host-specific responsive matrix, is still pending. The entire 24-template collection is not complete; Dental remains the pilot.

[Package-bound verification](package/compatibility.json) records exact paths, receipts, versions and limits. Next action is Braudy's complete-site review. Any visual revision creates a new draft revision and requires a newly bound export and affected checks. No catalog promotion is authorized by the image approval alone.
