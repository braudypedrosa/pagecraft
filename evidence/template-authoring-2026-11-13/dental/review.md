# Linden Dental A2, private revision 32

The five comments on revision 30 are implemented in the native six-page site. The newly generated First Visit image was approved in the chat before it was incorporated. Full-site and catalog approval remain pending.

- The hero is 640px tall on desktop and 580px on tablet. Its 600px heading frame starts within one pixel of the visible approved logo artwork. Phone layout uses a 300px image followed by natural-height copy.
- The approach section has a new supporting paragraph below its introduction.
- First Visit has the approved consultation-detail photograph beneath a full-bleed dark blue overlay. Existing panels remain readable and distinct.
- Team introduction padding now matches above and below: 76px desktop, 60px tablet, 48px phone.

Private review: https://staging.itspagecraft.com/owner/template-drafts/dental-clinic-a2/0.1.0/preview/32/index.html

## Exact package

Revision 32, version 0.1.0, SHA-256 `82ec4fcf10d5aad377a9eaa62928018295af159d9ddf33a8ec7d1d95cca54ef4`, 1,980,531 bytes, 359 native nodes and 19 used assets. Local source rebuild is byte-identical to the hosted export after synchronizing the renderer to development commit e8d9eaafbddccc027921de1a472f233626b7bf94. The initial mismatch is preserved in `package/roundtrip-before-source-sync.json`.

## Verification

Home was reviewed in the built-in browser at 390, 768, 1024 and 1440px. There is no horizontal overflow, one H1, loaded images, a working mobile menu and exclusive FAQ expansion. `Before` captures are fresh immutable revision 30 views; `After` captures are revision 32. `Proof/index.json` records original tile hashes, scroll offsets and crop/annotation provenance. Red rectangles annotate actual pixels. No screenshot was generated or repainted.

The five inner-page trees, shared header/footer and tokens match revision 30 after ignoring node IDs. Their prior responsive evidence remains at `evidence/template-authoring-2026-11-12/dental/refinement/Final/`; it was not recaptured or represented as new revision 32 evidence.

The exact native document was imported into the existing isolated, unpublished Cloud QA site with 18 existing media mappings and one normal media upload. Import, save, reload and a real heading edit/save/reopen/restore/reopen passed. No forms were submitted and the project was not published. Cloud native media optimization changes uploaded image bytes; exact portable package asset parity is checked separately.

The exact package was reimported into the isolated local WordPress QA runtime. Six draft pages, 19 local media items, native responsive CSS and disabled form controls were checked. Browser captures exposed an older navigation runtime in that QA install; The isolated generated output was refreshed through native reimport. The final phone hamburger opens and closes with Escape; fresh desktop and phone captures confirm the corrected output. The earlier failed capture is retained separately. Runtime hashes and final browser verification are recorded in the WordPress evidence.

TypeScript typecheck, the three JSON-source tests, native source check, candidate package check, exact archive reconstruction and all 20 released catalog hashes pass. No released package or catalog entry was changed. CI/deployment verification is recorded with the final project review snapshot.

## Review boundary

This is a private review candidate. The form destination is unconfigured and form controls remain disabled. Customer-specific names, credentials, contact details and service policies must be supplied before launch. Production deployment, complete host release-matrix testing, package approval and catalog promotion are separate. Site Studio development remains awaiting user approval.
