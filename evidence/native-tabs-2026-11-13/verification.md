# Native editable Tabs and approved Dental Treatments

- Authorization: user selected “Keep design, extend native Tabs” after approving only the Treatments visual direction. Practice, Team and First Visit replacement concepts remain unapproved.
- Source: Pagecraft development based on `aed71f0598edc151eaaf66721177ae3ecdf41043`.
- Scope: native Box panels inside Tabs, editor selection and structural controls, schema 15 / renderer 3 / editor 0.2.18, validation and portable-package compatibility, and the approved Home Treatments explorer.
- Existing text tabs and schema 13/14 archives retain their legacy interpretation and output. The signed WordPress golden fixture and 20 released catalog archives remain unchanged.
- Generated `dist/core.cjs`, `index.html` and editor distribution files are reproducible bundles of the readable source changes.

## Verification before deployment

- Full `npm test -- --maxWorkers=2`: passed. 327 files passed, 2 skipped; 3,182 tests passed, 5 skipped. Editor build order and TypeScript passed.
- Demo build: passed, zero findings. See `final-tests.log` and `final-demo.log`.
- Built-in browser: all 30 gallery interaction checks passed. All 24 current captures matched the existing reviewed images within the unchanged comparison threshold. The reviewed capture metadata is `gallery-final/capture.json`.
- Actual isolated WordPress: six-page import, native panel heading edit/save/reopen/restore, panel duplication/reordering/undo, frontend ArrowRight/End/Home behavior and reimport passed. The original six draft IDs and all 19 media IDs/hashes stayed stable. Menu identity and item count stayed stable; native reimport recreated individual menu item IDs.
- Desktop and mobile screenshots are in `Before/` and `After/`. A real rendering check caught icon rows wrapping; the final source uses a native two-column grid.
- WordPress adapter source is a local verified patch in the existing WordPress worktree. No WordPress production/plugin release is included.

## Delivery boundaries

Staging deployment and the exact hosted MCP revision/export are checked after this commit. The private local preparation archive is QA input, not an MCP export. No production deployment, catalog addition, design approval or package approval is recorded by this implementation.
