# Stillwood 1.0.1 Cloud QA — 20 Nov 2026

Package sha256 `faf67f255a04ea3144acf1b439e33a021e5e6eaa2416b6c2b2238efef6b709dd`. Agent QA, not user approval.

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
- Pages: 36 page/width records (9 pages × 4 widths, `matrix.json`). No text under 12px, no
  page overflow, no clipped or squeezed text, no broken, distorted or alt-less images, one H1 and
  no skipped heading level, every keyboard stop visible with a focus ring, every collapsed menu
  opens, no console errors or failed requests.

## Fixed during this QA

- Heading text styles named Georgia, so Settings › Typography › Heading font changed no heading.
  They now follow the Heading font; the eight testimonial quotes keep Georgia on the element.
- The header logo was lazy-loaded on every page although it is always in the first screen. It now
  loads eagerly.

Guards: `tests/premade-site-checks.test.ts` (draft headings follow the Heading font; buttons show
the fill they set) and `tests/template-source-fixes.test.ts`.
