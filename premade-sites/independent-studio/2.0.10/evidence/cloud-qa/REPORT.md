# Independent Studio 2.0.10 Cloud QA — 23 Nov 2026

Package sha256 `0b78fc82e8f35fb74a0698b73593ba3155361aef71ee19b3d2a2723c875bc8bd`. Agent QA, not user approval.

## Change under test

Patch of 2.0.9 (package `61467fdc…`). The Signal red colour token goes from #ef3f32 to #bd3028.
Its only use is the "Digital" label on the Home service cards (14 px, weight 750, uppercase, on
Warm paper #f4f0e8): 3.40:1 before, 5.11:1 after (4.67:1 if an owner moves the card onto the
Surface colour). The user chose this option ("Build A", 23 Nov 2026) from a mockup of three.

## Method

- Host: `tools/template-candidate-qa.mjs --local-only` at pagecraft `a48d92ac` (development), the real
  Cloud app (`createApp`) with an in-memory store and one fictional account. Editor HTML
  `index.html` sha256 `56b05a43d4536b3b5661089a6f510d28555b67ab3c217fe9bd26931836ba8e3f`.
- Browser: headless Google Chrome with a throwaway profile, trusted mouse and keyboard input (CDP).
- The site was created through the dashboard (Add new site › Premade templates › Northline ·
  Creative Studio), published through Publish › preview › Publish reviewed version, and measured unedited.
- Tools in `tools/template-cloud-qa/` (sha256: `editor-driver.mjs` f981fa583165, `edit-exercises.mjs` ed16a3c006da, `cloud-matrix.mjs` 780c71f2aa6b, `create-site.mjs` 66ffe97c50fd, `publish-site.mjs` 8b909ea80683, `pixdiff.mjs` 552c58ce9d9b).

## Results

- Site check: the publish dialog read "Site checks: no problems found" (`publish.json`). The same
  flow on 2.0.9 read "Site checks: 1 suggestion" and asked "Publish with suggestions?".
- Editing: all 13 exercises pass in one run on a fresh site (`editing-exercises.json`).
- Pages: 16 page/width records (4 pages × 390/768/1024/1440, `matrix.json`). No text under 12px,
  no page overflow, no clipped or squeezed text, no broken, distorted or alt-less images, one H1 per
  page, every keyboard stop visible, the collapsed menu opens, no console errors or failed requests.
- The hierarchy probe notes a display H2 larger than the H1 on Home (1024, 1440) and About (390,
  1024, 1440): the large closing statements. 2.0.9 measures the same, and the pages are
  pixel-identical to 2.0.9 apart from the label, so this is the released design, not a regression.
- Against 2.0.9 published the same way (`pixel-diff-2.0.9.jsonl`): About, Services and Contact are
  pixel-identical at all four widths (max channel difference 0). Home differs only in a box about
  58 × 10 px around the "Digital" label at each width (`diff-2.0.9-vs-2.0.10-index-*.png`, before
  left, after right). The current compiler adds default CSS that 2.0.9's package predates (list
  defaults, figure and button rules); none of it changes a pixel.

## Driver changes made during this QA

The exercise driver assumed things true of the earlier templates but not of this one:
- Clicking a section taller than the canvas clicked above the visible area; it now clicks inside the
  visible part (`editor-driver.mjs`).
- Stress content looked only for photo cards built as boxes; it now also accepts columns, which is
  how the Home service cards are built.
- Form behaviour needed a form in the template. Independent Studio has none (Contact uses an email
  link), so the exercise adds a Form to Contact from the Add panel, publishes, then submits it; the
  submission reached the local Submissions store.

## Not covered

Supabase sign-in, the deployed staging host, real email delivery and uploads from disk. WordPress
is covered separately by the package check.
