# Linden Dental A2 source

This is the source for private review revision 30 of the complete six-page Linden Dental site. It preserves the selected A2 palette and typography and the L2 identity. The native page bodies contain:

- Home: 8 sections
- Treatments: 6 sections
- Care Team: 5 sections
- First Visit: 5 sections
- Patient Information: 6 sections
- Contact: 4 sections

The package uses 18 assets: 12 distinct photographs, three Iconify SVG icons, the logo, favicon and `bp` mark. The final CTA background image was approved; its source approval is recorded at `/Users/braudypedorsa/Braudy/Projects/Pagecraft/design/dental-clinic/refinement/cta-image-approval.json`. The contained approach photo uses rounded corners; the full-width team scene and CTA background intentionally remain edge-to-edge. Team imagery is illustrative. Replace it with actual provider photos, and supply and verify names, credentials and practice details before a customer launch.

The frozen r30 review package has SHA-256 `92e1ad79db1cd80ac75cf7a242fb929b503ea2ebdd1b9ef0732e75a2ab944d29`. The seven r24 refinements distinguish visit and team CTA treatments, standardize contained-photo corners, balance the approach image and copy, add three care icons, improve first-visit panel contrast, add an approved full-bleed CTA image with a blue overlay, and remove appointment-confirmation placeholder copy. The complete site is built for private review. Final site approval is pending, and the customer template catalog remains unchanged.

The native visit request form remains disabled until a destination and required privacy handling are configured and verified. Appointment-confirmation placeholder copy has been removed.

Run `node tools/template-dental-authoring.ts --check` to build the document and check that its assets are readable without contacting a server. Creating or updating a private draft requires `PAGECRAFT_TEMPLATE_ENDPOINT` and `PAGECRAFT_TEMPLATE_GRANT` in the process environment and explicit coordination. An update also requires `--update --expected-revision=<revision>`; the script refuses a revision mismatch. Tokens are never written to files or printed. A failed upload can leave a partial draft for inspection.

Rendered responsive and interaction review, plus fresh import, edit, save and reopen checks in both Cloud and WordPress, are separate release evidence. This private candidate is not a catalog publication.
