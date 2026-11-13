# Dental revision 22: inner page desktop visual review

## Scope

Read-only visual review of the 1440px desktop captures for Treatments, Care Team, Your First Visit, Patient Information, and Contact. The capture checks identify revision 22, one H1 on each page, and successful image loading. The package hash supplied for this source is `1eec7af5e63881b0f639b5b4f6f5b623096c045fd66e99f46753a716d190bffc`.

## Findings

- The five pages have purposeful, varied structures: Treatments has six sections, Care Team five, Your First Visit five, Patient Information six, and Contact four. Together they use the retained photos, editorial copy groups, practical guidance, and native FAQ rows without padding every page with the same repeated grid.
- The Figtree/Source Sans 3 hierarchy and A2 ink, blue, ice, and white surfaces stay consistent. Section headings and their supporting descriptions remain stacked. The added body content aligns within the centered content width, and no obvious desktop clipping or materially uneven spacing appeared in the captures reviewed.
- The retained image assignments appear in their expected context and are reported loaded. Patient Information’s consultation and everyday-care photos each serve a separate section. The Care Team portraits remain illustrative people with no real names or credentials; replace or verify them before presenting them as actual practice staff.
- Contact clearly states that its request form is not connected and cannot accept submissions; the disabled submit state and privacy guidance are visible. This review does not establish a working inquiry flow.

## Capture notes and limits

- The original Patient Information 1440px set had six rendered sections but eight overlapping, non-monotonic screenshot tiles, including tiles 02 and 04 at y=906 and y=924. Root later created a stable 1440px recapture under `expanded/Stable`; that recapture supersedes the original set and was not inspected in this review.
- This review covers desktop screenshots only. It does not verify mobile/tablet rendering, click behavior, accordion opening, form submission, package parity, or a pixel-level comparison. Root is handling the other viewport and interaction checks.

## Extended responsive visual coverage

Re-read the current layout avoid list before this review. Visually inspected every tile for the five inner pages at these widths:

- **390px:** 23 tiles total. Treatments `00–04` (5), Care Team `00–04` (5), First Visit `00–03` (4), Patient Information `00–04` (5), Contact `00–03` (4).
- **768px:** 22 tiles total. Treatments `00–04` (5), Care Team `00–03` (4), First Visit `00–03` (4), Patient Information `00–04` (5), Contact `00–03` (4).
- **1024px:** 19 tiles total. Treatments `00–03` (4), Care Team `00–03` (4), First Visit `00–03` (4), Patient Information `00–03` (4), Contact `00–02` (3).

The 390px views stack the retained photos, copy and calls to action cleanly. Headings wrap naturally; body copy stays readable. At 768px, the navigation uses a separate row beneath the logo and the content grids remain legible, although some three-column headings wrap to several lines. At 1024px the navigation and main content remain aligned. Surface changes and generous spacing keep the sections distinct at all three widths. No visible clipping or horizontal overflow appeared. `checks.json` reports `scrollWidth` 15px below the viewport width at each tested width, consistent across all five pages; this review did not treat that scrollbar-width difference as overflow. All recorded page images loaded and each page has one H1.

The mobile screenshots show the hamburger in its closed state; they do not show the opened menu. These are visual captures, so menu opening, accordion activation, form behavior and submissions remain outside this review. Root is separately testing the native Cloud and WordPress flows.
