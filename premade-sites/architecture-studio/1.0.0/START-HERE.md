# Common Ground — start here

The selected C / Index direction now includes Home, Projects, Project Detail, About, Services,
and Contact. Open `draft/preview/index.html` through the local preview server. The installable
package is `draft/site.pagecraft-site.zip`. The user-approved package is now released in the local catalog. The exact isolated-host QA, agent rendered review, and user approval are recorded in `release-review.json`. No production deployment has been performed.

Review the running local sites at http://localhost:4890/common-ground-native-fields-qa/
and http://127.0.0.1:4892/. See RENDERED-REVIEW.md for the precise acceptance scope.

## Customize in the builder

1. Open Site Settings. Change the practice fonts and the named color tokens: Page background,
   Ink, Body text, Paper, Terracotta, Secondary text, Divider, and Project surface. Text styles
   control display headings, section titles, body copy, captions, and actions across the site.
2. Edit the global header's practice name and navigation, then the global footer. These are
   shared regions. The WordPress host patch opens imported pages directly from Edit with Pagecraft.
3. Select a project record. Content exposes its title, type, description, image, image description,
   destination, and action. Change content on the instance; edit the Project record component
   to propagate its shared layout and styling. Back to the defaults removes instance overrides.
4. Duplicate/reorder project records through the canvas/Navigator. Point each action to a real
   destination. The supplied Project Detail page is the courtyard study; the reading-room record
   intentionally leads to Contact. Duplicate the detail page if you want a separate second case study.
5. Replace the two AI-generated demonstration scenes with images you own or can license. Update
   alt text, crop, and project narratives. Replace all fictional-practice notices only after the
   content is genuinely your own. Do not imply the demonstration projects are built commissions.
6. Configure Contact's native form in Content → Where submissions go with a complete HTTPS
   receiving endpoint. Test required fields, real receipt, and failure feedback. No endpoint or
   recipient is embedded in this package. It currently displays a disabled form and a truthful
   unconfigured message. Cloud blocks publishing until configured.
7. Check Desktop, Tablet, and Mobile in the inspector, then save, reopen, and inspect the frontend.
   Keep text at least 14px; test long titles and varied project counts before publishing.

## Compatibility limits

The WordPress fixes are local source changes in `pagecraft-wordpress-template-qa`, based on
8311421 with bundled editor 0.2.14. The exact patch file hashes are in
`evidence/wordpress-host-patch-v4.json`. Do not claim these fixes exist in a released WordPress plugin.
Cloud QA uses the local app with fixture identity and in-memory data, not a Supabase/OAuth test.

The native document has no dedicated arbitrary layer-name field. Semantic IDs and content labels
identify elements; a custom layer-naming UI remains shared-editor follow-up work.

The disposable QA sites successfully submitted native forms through a trusted local HTTPS receiver.
It stores test receipts and sends no email. The reusable package remains unconfigured: supply
and test your own delivery service before accepting real inquiries. Keep certificate validation enabled.

Project imagery is optional: clearing Project image uses a native condition to omit it while
keeping the text and link. The host stress exercises covered this state. Category and description
are exposed as plain-text fields so both editors can edit them reliably; the frontend uses paragraph semantics.

In the inspector, an empty numeric field may keep its previous value. Set spacing explicitly to
zero or use the native override-reset control when removing a test value.

### WordPress shared styles after an editor update

The isolated compatibility patch corrects stylesheet ownership after a native save. Pages previously saved by the older editor must be opened and saved once with the corrected editor to discard duplicated foundation rules. Site Settings owns the shared font and color system; importing a template does not silently replace WordPress-owned settings. This patch is local and unreleased.
