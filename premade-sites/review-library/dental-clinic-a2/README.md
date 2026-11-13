# Linden Dental A2 source

This is the source for private review revision 37 of the complete six-page Linden Dental site. It preserves the selected A2 palette and typography and the L2 identity. The native page bodies contain:

- Home: 7 sections, including the native treatment explorer and the approved fuller Practice, Team and First Visit layouts
- Treatments: 6 sections
- Care Team: 5 sections
- First Visit: 5 sections
- Patient Information: 6 sections
- Contact: 4 sections

The package uses 16 referenced assets, including the approved photographs, three Iconify SVG icons, the logo, favicon and `bp` mark. Practice uses the approved reception panorama. Team uses two individual approved portraits with their original 4:5 framing and consistent 12px corners. First Visit uses the approved consultation background with a native dark overlay. All three layouts have individual user approval recorded under `/Users/braudypedorsa/Braudy/Projects/Pagecraft/design/dental-clinic/depth-review-2026-11-13/`. Team imagery is illustrative. Replace it with actual provider photos, and supply and verify names, credentials and practice details before a customer launch.

Revision 37 has package SHA-256 `0231380dc63eafbb555351c599896369033525f27b1885ca2ab4ae284be36b74`. It replaces only three Home sections and keeps the other five pages, shared header/footer, hero, native Treatments explorer, FAQ and closing CTA unchanged. Tablet and phone layouts stack the Team content and First Visit panels to keep them readable. The portable package retains schema 15 and renderer 3, while the hosted draft normalizes to schema 16. Full-site, exact-package and catalog approval remain pending.

The frozen r32 review package has SHA-256 `82ec4fcf10d5aad377a9eaa62928018295af159d9ddf33a8ec7d1d95cca54ef4`. Revision 32 makes the hero taller, widens its copy and aligns it with the visible logo edge. It adds a short approach paragraph and the newly approved full-bleed First Visit background with a dark blue overlay. The Team introduction now has equal top and bottom padding at each breakpoint. Revision 30 photo corners, icons, CTA image and copy refinements remain intact. The complete site is built for private review. Final site approval is pending, and the customer template catalog remains unchanged.

The native visit request form remains disabled until a destination and required privacy handling are configured and verified. Appointment-confirmation placeholder copy has been removed.

Run `node tools/template-dental-authoring.ts --check` to build the document and check that its assets are readable without contacting a server. Creating or updating a private draft requires `PAGECRAFT_TEMPLATE_ENDPOINT` and `PAGECRAFT_TEMPLATE_GRANT` in the process environment and explicit coordination. An update also requires `--update --expected-revision=<revision>`; the script refuses a revision mismatch. Tokens are never written to files or printed. A failed upload can leave a partial draft for inspection.

Rendered responsive and interaction review, plus fresh import, edit, save and reopen checks in both Cloud and WordPress, are separate release evidence. This private candidate is not a catalog publication.
