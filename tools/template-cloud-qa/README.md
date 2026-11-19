# Template Cloud QA tools

Loopback-only drivers used for the 20 Nov 2026 Cloud QA of the template patch drafts. They run
against `tools/template-candidate-qa.mjs --local-only` (in-memory store, one fictional account per
template) in a throwaway headless Chrome profile, with trusted mouse and keyboard input.

- `create-site.mjs <id> "<card title>" "<site name>"`: Add new site › Premade templates.
- `publish-site.mjs <id> <siteId>`: Publish › preview › Publish reviewed version.
- `cloud-matrix.mjs <outDir> <slug>:<page,...>`: every page at 390/768/1024/1440 (text floor,
  overflow, containers, image crops, hierarchy, keyboard, mobile menu, console) plus full-page captures.
- `edit-exercises.mjs <id> <siteId> <out.json> [checks]`: the 13 editing exercises in the real editor.
- `button-audit.mjs '<json>'`: buttons whose own fill does not render.
- `pixdiff.mjs '<pairs json>'`: changed pixels between two captures.

Start the host with `TEMPLATE_QA_PORT=4951 TEMPLATE_ACCEPTANCE_CATALOG=<catalog dir>`. Never point
these at a deployed host.
