# Common Ground (architecture-studio) 1.0.1 Cloud QA — 20 Nov 2026

Package sha256 `c8e4abe968f22425da0b49d549f6ddcc56b4ef51f4c8b01e738a3aa565053c1d`. Agent QA, not user approval.

## Method

- Host: `tools/template-candidate-qa.mjs --local-only` at pagecraft `8ad97d6c` (the release branch base), the real
  Cloud app (`createApp`) with an in-memory store and one fictional account per template. Editor HTML
  `index.html` sha256 `3764775adaec36edb65b804974fb1b3fd75f9737a24c522fde616690846ffbb4`.
- Browser: headless Google Chrome with a throwaway profile, trusted mouse and keyboard input (CDP).
- The site was created through the dashboard (Add new site › Premade templates › this template),
  published through Publish › preview › Publish reviewed version, and measured unedited.
- Tools are in `tools/template-cloud-qa/` (sha256: `editor-driver.mjs` 38d7bca8353b, `edit-exercises.mjs` feb9cf7bc3df, `cloud-matrix.mjs` 780c71f2aa6b, `create-site.mjs` 66ffe97c50fd, `publish-site.mjs` 8b909ea80683, `button-audit.mjs` a1a89e5ccb4e, `pixdiff.mjs` 552c58ce9d9b).

## Not covered

Supabase sign-in, the deployed staging host, real email delivery and uploads from disk. Storage is
in memory and the account is a fixture, as in the 1.0.0 Cloud QA. Form submissions went to the
local Submissions store only. WordPress is covered separately by the package check.

## Results

- Editing: all 13 exercises pass (`editing-exercises.json`; `final` holds the result per exercise,
  `runs` every run). Each records what was done and what was observed in the canvas, the saved
  document and the published output.
- Pages: 24 page/width records (6 pages × 4 widths, `matrix.json`). No text under 12px, no
  page overflow, no clipped or squeezed text, no broken, distorted or alt-less images, one H1 and
  no skipped heading level, every keyboard stop visible with a focus ring, every collapsed menu
  opens, no console errors or failed requests.

## Fixed during this QA

- None from this QA. The package is unchanged since the 1.0.1 draft (recorded component photo sizes).

Guards: `tests/premade-site-checks.test.ts` (draft headings follow the Heading font; buttons show
the fill they set) and `tests/template-source-fixes.test.ts`.
