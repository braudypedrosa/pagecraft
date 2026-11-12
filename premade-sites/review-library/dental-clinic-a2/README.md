# Linden Dental A2 source

Private six-page native Pagecraft source for the selected A2 direction. The nine approved images each appear once on the pages named in the brief. The selected L2 logo is used in the shared header and footer. Source art and the review board remain in the project branding directory.

Run `node tools/template-dental-authoring.ts --check` to build the document and check that its assets are readable. This does not contact a server. Draft creation requires `PAGECRAFT_TEMPLATE_ENDPOINT` and `PAGECRAFT_TEMPLATE_GRANT` in the process environment and explicit coordination. It creates only a private draft and refuses to overwrite an existing version. Tokens are never written to files or printed. Failure after creation can leave a partial draft for inspection.

The request form is intentionally unconfigured. It must not be represented as receiving submissions or confirming appointments until a real destination, privacy handling and delivery are configured and tested. Team imagery is illustrative. Replace team portraits with actual provider photos, and supply and verify names, credentials and practice details before a customer launch. Font stacks specify Figtree and Source Sans 3; host font availability and package behavior require verification in both builders.

The layout and interactions require rendered desktop/mobile review and real edit, save, reopen and fresh-import testing in both Cloud and WordPress before release. The draft is not a catalog publication.
