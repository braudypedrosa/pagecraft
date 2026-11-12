# Linden Dental A2 source

This is the source for private review revision 24 of the complete six-page Linden Dental site. It preserves the selected A2 palette and typography and the L2 identity. The native page bodies contain:

- Home: 8 sections
- Treatments: 6 sections
- Care Team: 5 sections
- First Visit: 5 sections
- Patient Information: 6 sections
- Contact: 4 sections

The site uses the original nine approved photographs and two exact photographic areas extracted from the approved expanded-home boards. Source art, approvals and review boards remain in the project branding directory. Team imagery is illustrative. Replace the team portraits with actual provider photos, and supply and verify names, credentials and practice details before a customer launch.

The frozen review package has SHA-256 `9263ec0f8927c7f25b155af5852583c44887f40e667152061715e4389fdd93d8`. The user authorized the complete-site build. Final approval of the completed site is pending, and the customer template catalog remains unchanged.

The visit request form is disabled and unconfigured. No external submission or booking integration is connected. Configure and test a real destination, privacy handling and delivery before accepting messages; a request does not confirm an appointment.

Run `node tools/template-dental-authoring.ts --check` to build the document and check that its assets are readable without contacting a server. Creating or updating a private draft requires `PAGECRAFT_TEMPLATE_ENDPOINT` and `PAGECRAFT_TEMPLATE_GRANT` in the process environment and explicit coordination. An update also requires `--update --expected-revision=<revision>`; the script refuses a revision mismatch. Tokens are never written to files or printed. A failed upload can leave a partial draft for inspection.

Rendered responsive and interaction review, plus fresh import, edit, save and reopen checks in both Cloud and WordPress, are separate release evidence. This private candidate is not a catalog publication.
