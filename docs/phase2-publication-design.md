# Phase 2 publication review design

## Overview

This records the compact extension to Pagecraft’s existing Publish dialog, based on `builder.html` (`publishModal`, `preparePublicationReview`, `publishDraft`, and shared dialog styles) and the incumbent commitments in `PRODUCT.md`. It does not introduce a new visual identity or replace the project’s design system. The Impeccable ordinary-extension exception applies; no global `DESIGN.md` or design sidecar is generated.

The central interaction is to review a saved snapshot before publishing the whole site. The dialog explicitly says that shared changes may affect every page. Choosing a page changes the comparison, not the publication scope.

## Colors

The extension inherits white working surfaces, cool neutral fields and borders, Ink text (`#111311`), and Craft Green (`#b7f34a`) for the primary publish action. Secondary controls retain white surfaces with neutral outlines; their hover treatment uses the existing very light green token. Errors and warnings use the existing functional colors and alert components. These are inherited roles, not a new palette.

## Typography

The dialog uses the existing Pagecraft typography and token aliases: Manrope and DM Sans remain the incumbent families, with body, label, panel and dialog roles supplied by the shared system. Standard buttons use the body size at weight 500; the primary action uses weight 600. Existing release headings use the dialog size at weight 600. Group summaries, helper copy and preview headings remain ordinary document controls and text; they do not establish additional brand typography.

## Layout

The existing centered modal is a white flex column, up to 880px wide and 88vh tall. Its body scrolls independently; the footer is a sibling outside that scroll region. Footer actions can wrap and remain available while the review content scrolls. The footer contains the WordPress route, Close, Create review preview, and the owner’s primary publish action.

The review body places its saved-version explanation before grouped changes, optional publication suggestions, a labelled page selector, and paired Published version / Reviewed draft frames. The comparison grid uses `repeat(auto-fit,minmax(260px,1fr))` with the existing field gap. Each frame is full width and 320px high; available width determines whether the pair shares a row.

The accepted editor boundary remains a 768px minimum, with 767px treated as the blocked-width boundary. The builder already has a width-gate surface that hides and disables the editor behind it. This extension does not establish a mobile editing experience. Boundary behavior and footer visibility require rendered verification; this document records no new browser test result.

## Elevation & Depth

Depth comes from the inherited dialog scrim and soft modal shadow (`0 24px 60px -20px #11131133`). Neutral borders separate the header, body, footer and comparison frames. Review groups do not introduce a new card or elevation system.

## Shapes

The modal inherits 16px corners, standard buttons 8px corners, and preview frames the shared control-radius token with a 1px neutral border. These choices preserve the current compact control vocabulary.

## Components

### Review preparation and grouped changes

Opening Publish shows the existing checks and publication state. For hosts supporting review preparation, the primary action is disabled until a preview has been prepared. Only owners receive preparation and publish controls. Preparation flushes autosave, captures the serialized document, and requests a snapshot at the saved server version. Changes are grouped in native expandable details; optional suggestions use a separate details group. Affected-page buttons select the corresponding output and scroll its reviewed frame into view.

### Paired previews and source separation

The two titled, sandboxed frames request files from distinct immutable identifiers: the reviewed snapshot ID and the baseline publication ID. They do not use the changing editor canvas as the comparison source. One page selector drives both frames. When a page is absent from either version, that frame displays an explicit absence message. A first publication states that the site has not been published. When the baseline lacks retained source data, the dialog explains that the structured comparison is unavailable and asks the author to compare previews. No-change reviews explicitly state that no document changes were found.

### Publication and feedback

Successful preparation labels the primary action “Publish reviewed version.” Publication flushes pending saves again and rejects the review if either the serialized document or saved server version has changed. The submitted request includes the reviewed snapshot ID and source version. Errors from lint block publication; suggestions prompt for acknowledgement. The current implementation also performs these checks at the publication boundary, rather than treating a ready preview as perpetual permission.

Preparation and publication use the shared pending/success/error feedback system. The release panel is a polite, atomic live status region with busy-state updates. Publish failures receive a persistent alert and a retry label; uncertain completion tells the author to check the published site before retrying. Successful responses replace the release state, while subsequent autosaved changes remain private. Dashboard preview capture is separate, best-effort work and does not define the reviewed source snapshot.

## Do's and Don'ts

- Do keep the reviewed version, published baseline and current editable draft distinct in copy and data flow.
- Do preserve whole-site publication wording even when the author selects an individual page to inspect.
- Do retain grouped changes, paired labelled previews and persistent footer actions within the incumbent dialog.
- Do preserve meaningful loading, unavailable-baseline, absent-page, first-publication, no-change, stale-review and failure states.
- Don't infer successful deployment, image loading, keyboard acceptance or responsive QA from this source inspection.
- Don't turn task-specific preview dimensions or fallback iframe typography into global Pagecraft design tokens.

The supplied reviewer disposition is “ship after fixed images.” This documentation pass does not independently verify that image fix or claim the condition has been satisfied. It records the source inspected and the scoped design contract; release acceptance remains with the implementation and verification work.
