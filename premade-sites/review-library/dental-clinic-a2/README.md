# Linden Dental A2 source

This is the current native source for the six-page Linden Dental site. It preserves the selected A2 palette and typography and the L2 identity. The native page bodies contain:

- Home: 7 sections, including the native treatment explorer and the approved fuller Practice, Team and First Visit layouts
- Treatments: 5 sections
- Care Team: 5 sections
- First Visit: 5 sections
- Patient Information: 6 sections
- Contact: 4 sections

The source uses approved photographs, Iconify SVG icons, the logo, favicon and `bp` mark. Practice uses the approved reception panorama. Team imagery is illustrative. Replace it with actual provider photos, and supply and verify names, credentials and practice details before a customer launch.

All five Care Team section layouts have individual approvals recorded under `/Users/braudypedorsa/Braudy/Projects/Pagecraft/design/dental-clinic/inner-pages-2026-11-14/CareTeam/`. The sections use native components. Built-page, exact-package, full-site and catalog approval remain pending. The current source targets schema 17 and renderer 4. A new hosted revision and package hash must be recorded only after an actual save and package verification.

Historical private review revision 37 had package SHA-256 `0231380dc63eafbb555351c599896369033525f27b1885ca2ab4ae284be36b74`. That historical package replaced three Home sections and retained the other pages and shared elements at that time. It used schema 15 and renderer 3, with its hosted draft normalized to schema 16. It does not describe the current source or establish approval of it.

The frozen r32 review package has SHA-256 `82ec4fcf10d5aad377a9eaa62928018295af159d9ddf33a8ec7d1d95cca54ef4`. Revision 32 makes the hero taller, widens its copy and aligns it with the visible logo edge. It adds a short approach paragraph and the newly approved full-bleed First Visit background with a dark blue overlay. The Team introduction now has equal top and bottom padding at each breakpoint. Revision 30 photo corners, icons, CTA image and copy refinements remain intact. This historical package was built for private review. It does not establish approval of the current source.

The native visit request form remains disabled until a destination and required privacy handling are configured and verified. Appointment-confirmation placeholder copy has been removed.

Run `node tools/template-dental-authoring.ts --check` to build the document and check that its assets are readable without contacting a server. Creating or updating a private draft requires `PAGECRAFT_TEMPLATE_ENDPOINT` and `PAGECRAFT_TEMPLATE_GRANT` in the process environment and explicit coordination. An update also requires `--update --expected-revision=<revision>`; the script refuses a revision mismatch. Tokens are never written to files or printed. A failed upload can leave a partial draft for inspection.

Rendered responsive and interaction review, plus fresh import, edit, save and reopen checks in both Cloud and WordPress, are separate release evidence. This private candidate is not a catalog publication.
