---
name: Common Ground — architecture studio 1.1.0
description: A native Pagecraft architecture portfolio built as a photographic book foldout.
colors:
  bg: "#f8f5ef"
  paper: "#f8f5ef"
  ink: "#462822"
  text: "#382e29"
  brand: "#6d342a"
  surface: "#e9e0d3"
  muted: "#6e5a4e"
  line: "#c8b6a3"
typography:
  display:
    fontFamily: "'Instrument Serif',Georgia,'Times New Roman',serif"
    fontSize: "80px"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-.025em"
  title:
    fontFamily: "'Instrument Serif',Georgia,'Times New Roman',serif"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-.025em"
  subtitle:
    fontFamily: "'Instrument Serif',Georgia,'Times New Roman',serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "0"
  lead:
    fontFamily: "'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  body:
    fontFamily: "'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  small:
    fontFamily: "'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  btn:
    fontFamily: "'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  wordmark:
    fontFamily: "'Instrument Serif',Georgia,'Times New Roman',serif"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-.025em"
  closing:
    fontFamily: "'Instrument Serif',Georgia,'Times New Roman',serif"
    fontSize: "64px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "normal"
rounded:
  square: "0"
spacing:
  step-8: "8px"
  step-12: "12px"
  step-16: "16px"
  step-20: "20px"
  step-24: "24px"
  step-32: "32px"
  step-40: "40px"
  step-48: "48px"
  step-64: "64px"
  step-72: "72px"
components:
  link:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.btn}"
    rounded: "{rounded.square}"
    padding: "12px 0"
  link-inverse:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    typography: "{typography.btn}"
    rounded: "{rounded.square}"
    padding: "12px 0"
  form-submit:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.paper}"
    rounded: "{rounded.square}"
    padding: "11px 26px"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.text}"
    rounded: "{rounded.square}"
    padding: "11px 13px"
---
# Design System: Common Ground

## Overview

**Creative North Star: "The Architecture Book Foldout"**

The architecture book foldout is the selected world (concept seed `2e070ba4`). Broad architectural photographs, attached captions, fine serif headings and compact sans reading text sit on warm paper and linen. Brick-colored closing surfaces supply weight without ornamental layering. This records the implemented architecture template, not the Pagecraft product interface.

The user rejected deployed 1.0.0 and delegated the new aesthetic choice: “I leave it up to you.” The prior left-directory/right-portrait layout, repeated left-facts/right-picture pattern, generic Arial hierarchy and weak close remain project anti-references; 1.0.0 remains an immutable retrievable release. The delegated selection does not mean the user chose this particular look or approved the final package. The independent reviewer’s final composition disposition was ship, with earlier findings resolved; that is not user approval or deployment authorization. Final user visual approval remains outstanding.

Evidence is `source.ts`, native renderer styles, and `evidence/clean-index-{1440,390}.png` plus `evidence/clean-projects-{1440,390}.png`. These establish the built composition; they do not establish deployment, working inquiry delivery, or cross-host compatibility. Native portability and keyboard access remain binding product constraints from PRODUCT.md.

**Key Characteristics:**
- Large, rectangular architectural images with captions underneath.
- Warm paper and linen, dark brown text, and a brick closing field.
- Instrument Serif headings with inherited DM Sans reading text.
- Native Pagecraft nodes, reusable project plates and mobile stacking.

## Colors

The palette draws from brick, timber, paper and linen visible in the fictional architectural studies. Frontmatter preserves native token IDs, including the deliberate `bg` / `paper` alias.

### Primary
- **Brick (`brand`):** The closing inquiry section and form submit surface; also the native navigation hover color.

### Neutral
- **Paper (`bg`, `paper`):** Page ground, open reading space, form fields and reversed closing text.
- **Heading ink (`ink`):** Warm dark heading, navigation and text-link color.
- **Body text (`text`):** Long-form reading color.
- **Linen (`surface`):** Alternating project, method and service sections.
- **Secondary text (`muted`):** Project categories and supporting disclosures.
- **Divider (`line`):** Service separators and native form borders.

## Typography

**Display Font:** Instrument Serif, using the native serif fallback stack in frontmatter.
**Body Font:** DM Sans, using the native sans fallback stack in frontmatter.

The narrow serif gives headlines and project names a book-like character. The sans carries descriptions, categories, navigation and actions without competing with the photographs. Headings use `meta.headFont`; body-role tokens explicitly inherit `meta.font`. The wordmark explicitly selects Instrument Serif. Native Google font loading still requires proof in each target host.

### Hierarchy

Frontmatter is the desktop scale. Tablet and mobile sizes below are native responsive overrides, not fluid clamps.

| Role | Tablet | Mobile | Application |
| --- | --- | --- | --- |
| display | 58px | 44px | Page h1 |
| title | 36px | 32px | Section h2 |
| subtitle | 24px | 24px | Supporting heading |
| lead | 21px | 20px | Introductory reading |
| body | 18px | 17px | Main reading |
| small | 14px | 14px | Categories and disclosures |
| btn | 16px | 16px | Underlined actions |
| wordmark | inherits desktop | 26px | Practice name in header |
| closing | 52px | 40px | Inquiry section heading |

Project-plate titles locally use 32px on desktop, with native title breakpoint overrides. Reading groups are bounded with observed limits of 52–60ch; the broader practice disclosure uses 80ch. Form submit text uses the native 600 weight; navigation uses native link treatment. Neither is a new display role.

**The Attached Caption Rule.** Keep each project title, category, description and action with its image in one reusable project plate.

## Layout

The document sets a native maximum width of 1344px. The recurring section rhythm is 72px vertically / 48px horizontally on desktop, 48px / 32px on tablet and 40px / 20px on mobile; opening, header and image sections have deliberate local overrides. Native stylesheet breakpoints are 1024px and 767px. Navigation collapses at its separate 900px threshold.

Projects form two equal columns with a 32px gutter. Method and practice pairings use asymmetric or equal columns and a 64px desktop gutter. Native mobile grids stack to one column with a 32px gap. The colophon changes from a spaced horizontal line to a left-aligned vertical sequence.

The home opening is a wide photograph followed by a separate title and action on paper. Project collections attach all facts below the images. The projects-page reuse narrative follows the two plates without repeating the reading-room photograph. Image crops use object-fit cover and explicit breakpoint heights; the studio-table mobile crop uses 80% top and a 230px height to retain the model/material scene. Preserve the crop intent without promoting every image height into a global token.

## Elevation & Depth

The documented page composition is flat: no decorative shadows on images, plates, reading groups or closing surfaces. Depth comes from light inside the photographs and changes between paper, linen and brick. Thin service dividers and the colophon rule organize related information. Shared renderer styles for unused submenu shadows are not a template elevation system.

**The Flat Surface Rule.** Use photography, tonal sections and spacing to separate content; do not add decorative card shadows to this template.

## Shapes

Square images, fields and actions are the repeated form language. Project plates have no separate card frame or rounded container. Borders are limited to fields and meaningful separators. The native navigation toggle’s rounded strokes are retained as functional icon geometry; square content does not prohibit that native control.

## Components

### Buttons

Actions are restrained underlined text links, implemented with native button nodes. They use transparent backgrounds, square corners, a 6px underline offset and a 44px minimum height. Closing actions reverse to paper. No template-specific hover transform or color change is authored for these links; the renderer retains its standard transition declarations. Keyboard focus uses the native 3px current-color outline with a 3px offset.

The form submit is the separate filled brick action, with paper text and native 600 weight. Its disabled state uses native reduced opacity and the not-allowed cursor; it does not imply an active delivery service.

### Cards / Containers

The reusable **Project plate** binds image, image description, title, category, project description, action text and destination. Image and caption are one unit; captions start with 24px top padding, then category and reading text. A missing bound image is conditionally hidden. No chip, badge or ornamental card wrapper is used.

### Inputs / Fields

The native inquiry form has Name, Email and About the project fields. Paper fields use a thin divider-colored border and square corners. Native focus uses a 2px brick outline with a 1px offset. Half-width fields wrap using native flex behavior and a 12rem minimum. The receiving action is currently empty: the owner must configure and test delivery before accepting inquiries. Do not document successful submission as established behavior.

### Navigation

A serif practice-name home link and sans navigation share a flex row. Desktop links have a 32px gap and brick hover color; native focus stays visible. Below 768px the tested native menu toggle and panel replace the expanded link row. Paper is the panel ground. No custom navigation runtime is introduced.

### Closing inquiry surface

A brick full-width section carries the serif inquiry heading, supporting sentence, underlined contact route and a separated colophon. The colophon preserves the fictional-practice / AI-generated-study disclosure. This component supplies the site's strong ending without overlays or additional decorative geometry.

## Do's and Don'ts

### Do:
- Do keep Instrument Serif in native meta.headFont and DM Sans in meta.font; body roles inherit the body family.
- Do keep project captions beneath their images and preserve their reading order when columns stack.
- Do retain fictional-practice and AI-generated-study disclosures until replaced with verified content.
- Do preserve native editable elements, component bindings, focus behavior and responsive styles in both hosts.

### Don't:
- Don't return to the rejected directory-and-portrait composition or generic Arial display hierarchy.
- Don't place absolute-positioned headings over the project photography.
- Don't replace native nodes with embeds, hidden code, custom CSS selectors or an external animation runtime.
- Don't treat reviewer acceptance as final user approval, deploy authorization, or proof of inquiry delivery.

Not canonized: one-off image heights and the single colophon-rule color are local composition choices, not reusable tokens; no craft-floor defect is being promoted into this system.


## Native save findings

Spacing is normalized to explicit native longhands because editor key sorting can otherwise let default padding override shorthand values. Latest package save/reopen verified matching Cloud and WordPress spacing. The isolated WordPress v5 host patch now preserves native font resources and compiled grid children; rendered equivalence passed on that exact patch. This is not a released WordPress compatibility claim. See REDESIGN-REVIEW.json.
