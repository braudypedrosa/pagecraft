---
name: Pagecraft Cloud live review
description: Contextual feedback on the latest saved site.
colors:
  craft-green: "#285c36"
  selection: "#eef7e5"
  selection-text: "#263d20"
  hover: "#f4faef"
  white: "#fff"
  surround: "#f3f5f6"
  subtle: "#fafbfc"
  ink: "#202b30"
  muted-text: "#526069"
  border: "#dfe4e7"
  border-strong: "#cbd2d8"
typography:
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "24px"
  section:
    fontFamily: "Manrope, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
rounded:
  control: "6px"
spacing:
  tight: "4px"
  action: "8px"
  group: "12px"
  inset: "18px"
  section: "20px"
components:
  button:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  button-primary:
    backgroundColor: "{colors.selection}"
    textColor: "{colors.selection-text}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  field:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "9px"
---

# Design System: Pagecraft Cloud live review

## Overview

**Creative North Star: "The contextual review workbench"**

This document describes only the Cloud review hub, identity entry, review toolbar and feedback rail implemented in `src/live-review-page.ts` and `src/live-review-client.ts`. It extends Pagecraft's incumbent white, cool-gray and green Operate interface. It does not define other server surfaces or the customer site displayed inside the iframe.

The site remains the main visual evidence while compact controls support creating a link, identifying the reviewer, pinning or replying, and resolving feedback. Brand authority comes from `../PRODUCT.md`; functional behavior is documented in `../docs/live-reviews.md`.

**Key Characteristics:**
- White working surfaces on a cool-gray surround.
- Green for interaction, selection and focus.
- A dominant site canvas paired with a feedback rail.

## Colors

### Primary
Craft green identifies links and focus. Pale selection green distinguishes the primary action and pressed device/mode buttons, with dark selection text. Hover uses a lighter green.

### Neutral
White supports controls, toolbar and rail; the cool surround separates the preview. Ink carries body text, muted text carries supporting information, and two border strengths distinguish separators from field edges. Selected threads use the subtle neutral surface.

**The Action Color Rule.** Use the existing green roles for review actions and selection, preserving white and cool-gray working surfaces.

## Typography

Manrope supplies headings; DM Sans supplies body text and controls. Fonts are served locally through `../shared/ui-fonts.js`. The workspace title and rail section use the compact roles above; supporting viewport/status labels are smaller. Paragraphs use a more generous line height (1.55).

The entry and hub have larger local headings; they are not a shared display scale. Shared editor typography is imported but does not override the live-review shell's explicit type rules.

## Layout

The header and wrapping toolbar sit above a two-column workspace: a flexible preview plus a feedback rail (340px). Canvas padding (16px) separates the rendered site from the surround. The client sizes the desktop workspace to available viewport height; the stylesheet retains a minimum height (420px).

At viewport widths at or below 800px, the rail moves beneath the canvas. The canvas occupies 60dvh with a minimum height of 350px. Toolbar controls wrap. Selecting a pin on this layout scrolls and focuses its feedback thread.

The preview offers device widths of 1440px, 768px and 390px and scales down to fit available space. These are review simulation sizes, not breakpoints for customer content.

**The Preview Boundary Rule.** Keep review chrome and customer-site styles separate; the iframe's content never supplies Pagecraft design tokens.

## Elevation & Depth

The shell uses flat white panels, neutral dividers and tonal selection rather than shadows. Focus uses a green outline (2px) offset from its control (3px). There is no shell animation vocabulary to inherit from the imported motion tokens.

## Shapes

Buttons and fields share gently rounded control corners. Threads are flat divider-separated rows, not floating cards. The identity entry has its own larger corner radius; it is a local container treatment rather than a global card standard.

## Components

- **Buttons:** white defaults, pale green primary/pressed states, light green hover, visible green keyboard focus. Disabled buttons use reduced opacity and a waiting cursor.
- **Fields:** white inputs, selects and textareas with stronger neutral borders; textareas resize vertically and have a minimum height (90px).
- **Toolbar:** labelled page selector, textual device controls and Browse/Comment controls. Pressed state is represented with `aria-pressed`.
- **Feedback threads:** bold clickable headings, wrapped comment text, muted timestamps and divider-separated replies. Selection reveals replies and permitted resolution controls.
- **Sharing:** an expandable access section keeps link and invitation forms alongside their lists.
- **Feedback status:** a persistent polite live-status region communicates loading, errors and completed actions without relying on color alone.

## Do's and Don'ts

- **Do** preserve visible keyboard focus and semantic control labels.
- **Do** keep the preview and selected feedback thread connected across responsive layouts.
- **Don't** derive Pagecraft chrome styling from customer content in the iframe.
- **Don't** generalize this surface's local measurements into project-wide design rules.
