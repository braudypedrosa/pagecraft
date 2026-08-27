---
name: Pagecraft
description: A calm editorial workbench for building visually, publishing deliberately, and handing finished sites to WordPress.
colors:
  craft-green: "#b7f34a"
  craft-green-deep: "#a7e536"
  ink: "#111311"
  ink-deep: "#0b0d0b"
  paper: "#f8f6ef"
  paper-deep: "#eeeade"
  surface: "#fffefa"
  muted-ink: "#5b625c"
  paper-line: "#dedacf"
  on-dark: "#f6f4ec"
  on-dark-muted: "#aeb5ad"
  dark-line: "rgba(246, 244, 236, 0.16)"
typography:
  display:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 1.87rem + 3.75vw, 5.25rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.05em"
  headline:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.54rem + 1.97vw, 3.3125rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(1.3125rem, 1.25rem + 0.28vw, 1.5rem)"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 1.04rem + 0.09vw, 1.125rem)"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.05em"
rounded:
  focus: "2px"
  control: "4px"
  standard: "6px"
  large: "14px"
  circle: "50%"
spacing:
  3xs: "0.25rem"
  2xs: "0.5rem"
  xs: "0.75rem"
  sm: "1rem"
  md: "1.5rem"
  lg: "2rem"
  xl: "3rem"
  2xl: "4rem"
  3xl: "6rem"
components:
  button-primary:
    backgroundColor: "{colors.craft-green}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.standard}"
    padding: "1rem 2rem"
  button-primary-hover:
    backgroundColor: "{colors.craft-green-deep}"
    textColor: "{colors.ink}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.standard}"
    padding: "1rem 2rem"
  button-dark-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.on-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.standard}"
    padding: "1rem 2rem"
  capability-handoff:
    backgroundColor: "{colors.craft-green}"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "clamp(2.5rem, 5vw, 5rem)"
---

# Design System: Pagecraft

## Overview

**Creative North Star: "The Independent Craft Ledger"**

Pagecraft is a calm editorial workbench made from paper surfaces, ink structure, and precise Craft Green conclusions. It should feel designed by someone who values both visual authorship and a clean handoff: expressive at display scale, disciplined in controls, and explicit about what happens when work leaves the cloud.

The system pairs broad, editorial compositions with compact utility details. Large promises and verbs provide the narrative rhythm; fine rules, small labels, and convincing interface specimens provide proof. Capabilities are presented as image-led working views with stable, restrained hover motion rather than an abstract feature index. WordPress handoff is always presented as a completed transfer into an independent WordPress-owned local copy, never as synchronization.

**Key Characteristics:**

- Warm paper fields structured by near-black ink.
- Craft Green used for action, focus, selection, verified status, and decisive conclusions.
- Manrope display typography paired with DM Sans utility copy.
- Image-led capability cards, concise verbs, and app-faithful interface specimens instead of generic feature tiles.
- Flat surfaces with fine rules at rest and selective depth where an artifact must feel tangible.
- Responsive reflow that preserves hierarchy and 44px minimum interactive targets.

## Colors

The palette is materially restrained: warm paper creates room to work, Ink supplies the framework, and sharp Craft Green marks moments of authorship or completion.

### Primary

- **Craft Green:** The decisive accent for primary actions, selection outlines, active controls, release status, and conclusive handoff panels.
- **Deep Craft Green:** The darker interaction state for green actions, preserving the accent's clarity on hover.

### Neutral

- **Ink:** The standard structural dark for type, dark buttons, image-stage framing, and firm boundaries.
- **Deep Ink:** The deepest environmental field for the header, hero, ownership narrative, and footer.
- **Paper:** The default working surface and light-page background.
- **Deep Paper:** The warmer secondary field for capability and editorial sections.
- **Surface:** The brightest paper layer for raised or framed content.
- **Muted Ink:** Secondary copy on light surfaces.
- **Paper Line:** Dividers and low-contrast borders on light surfaces.
- **On Dark:** Primary text on Ink environments.
- **On Dark Muted:** Explanatory copy and quiet navigation on Ink environments.
- **Dark Line:** Fine boundaries on dark surfaces without introducing a new hue.

### Named Rules

**The Green Conclusion Rule.** Craft Green resolves a decision: it marks the action, selected state, verified status, or final handoff. Do not use it as ambient decoration.

**The Paper and Ink Rule.** Build hierarchy first through contrasting fields and fine rules; introduce additional hues only when they belong to a faithfully represented product surface such as WordPress Admin.

## Typography

**Display Font:** Manrope (with system-ui and sans-serif fallbacks)  
**Body Font:** DM Sans (with system-ui and sans-serif fallbacks)  
**Label Font:** DM Sans (with system-ui and sans-serif fallbacks)

**Character:** Manrope carries Pagecraft's confidence through tightly tracked, oversized editorial statements. DM Sans keeps navigation, controls, descriptions, labels, and status language practical and legible.

### Hierarchy

- **Display:** Bold, tightly tracked, and fluid. Reserve it for the primary promise and signature oversized statements.
- **Headline:** Bold editorial section language, usually balanced into compact line lengths.
- **Title:** Firm component and supporting section titles with less compression than display text.
- **Body:** Regular utility copy with a generous reading rhythm and a maximum measure near 66 characters.
- **Label:** Semibold compact interface copy; uppercase and widened tracking are reserved for metadata, statuses, and category summaries.

### Named Rules

**The Two-Voice Rule.** Manrope speaks for the composition; DM Sans explains how it works. Do not set long explanatory passages in the display voice.

**The Verb-Led Rule.** Capability titles begin with direct actions and earn their scale through concise wording, not through ornamental copy.

## Layout

The core page uses a centered 75rem container with a fluid gutter and fluid section spacing. Signature capability, editor, WordPress, and release specimens are allowed to widen to 80vw up to 90rem so the interface evidence feels like a real working surface rather than a card inside a marketing shell.

Desktop compositions use asymmetric editorial grids: copy and evidence sit beside each other, while capabilities form a two-by-two field of real material imagery, product-state overlays, and concise outcomes. The hero stacks its promise over a wide editor specimen; the green handoff panel terminates the capability sequence as an outcome, not another equal feature.

At 64rem, detailed editor chrome simplifies. At 56.24rem, navigation becomes a menu and multi-column product specimens stack. At 40rem, primary actions become full-width, capability cards collapse to one column, complex preview sidebars disappear, and oversized canvases crop or scale from the left to keep their hierarchy legible.

**The Full-Width Evidence Rule.** When explaining what Pagecraft can do, use broad rows and credible working surfaces before falling back to interchangeable cards.

## Elevation & Depth

The system is flat by default. Paper tones, Ink reversals, one-pixel rules, clipping, and overlap establish most depth. Shadows are reserved for the editor, template preview, WordPress stage, sticky workflow sheets, and release artifacts where physical separation helps the object read as something made or handed over.

### Shadow Vocabulary

- **Editor Float** (`0 35px 100px -35px rgba(0,0,0,.8)`): A deep, diffuse shadow under the hero editor specimen.
- **Canvas Lift** (`0 20px 55px rgba(0,0,0,.3)`): Separates the designed page from the editor canvas.
- **Paper Artifact** (`0 36px 70px -48px rgba(17,19,17,.65)`): A restrained warm shadow for a light template preview.
- **Workflow Stack** (`0 26px 70px -42px rgba(0,0,0,.9)`): Adds separation between sticky process sheets on a dark field.
- **WordPress Stage** (`0 34px 75px -52px rgba(17,19,17,.75)`): Gives the imported local copy the weight of a finished artifact.

### Named Rules

**The Artifact-Only Rule.** Shadows belong to tangible previews, product-state overlays, and stacked workflow objects. Navigation, ordinary text, buttons, and card shells remain flat.

## Shapes

Pagecraft uses gently squared controls: 6px is the standard interactive radius, 4px belongs to compact editor controls and chips, and 14px is reserved for the outer editor shell. Editorial panels, capability cards, workflow sheets, and handoff fields stay square so their rules and alignment remain authoritative. Circles appear only as graphic forms or control indicators, never as a default card language.

**The Ruled Surface Rule.** Prefer a square field with a one-pixel boundary over a rounded container when the content is explanatory or editorial.

## Components

### Buttons

- **Shape:** Gently squared with a 6px radius, a 52px minimum height, and 1rem by 2rem padding.
- **Primary:** Craft Green on Ink; used for the builder entry point and other decisive actions.
- **Hover / Focus:** Hover deepens green and lifts the button by 1px over 160ms. Keyboard focus uses a 2px current-color outline with a 4px offset. Reduced-motion mode removes the lift.
- **Dark Ghost:** Transparent with a translucent light border on Ink; hover increases the border and introduces a quiet light wash.
- **Ink:** Ink on Paper; hover resolves to pure black without adding shadow.

### Cards / Containers

- **Corner Style:** Editorial containers are square. Only the editor shell uses the large 14px top corners.
- **Background:** Alternate Paper, Deep Paper, Ink, and Deep Ink according to narrative phase.
- **Shadow Strategy:** Flat unless the container depicts a tangible editor, page, workflow sheet, or handoff artifact.
- **Border:** One-pixel Paper Line on light fields or Dark Line on dark fields.
- **Internal Padding:** Use the established spacing scale, fluidly increasing from 2rem toward 5rem for signature stages.

### Navigation

The sticky header is a translucent Deep Ink bar with a fine Dark Line boundary. The Pagecraft mark is Craft Green; navigation labels use compact DM Sans in muted light text and brighten on hover. The principal desktop action is a compact green button. Below 56.24rem, a 44px menu button reveals a full-width stacked panel with ruled links and an in-menu green action.

### Capability Index

Each capability is an image-led editorial card built from Pagecraft's dark craft and paper system. Its embedded specimen mirrors a recognizable Pagecraft surface: the Layers canvas, Media library, responsive inspector, or publish review list. Labels name the capability without sequence numbers, while compact headings and left-aligned descriptions keep the cards easy to scan. Hover only tightens the underlying image crop; the interface, typography, and card geometry remain stable. The sequence ends in a green handoff panel with the conversion promise, supporting copy, and a direct builder CTA.

### Workflow Stack

Workflow steps are sticky, square-edged Ink sheets with large Manrope numerals. The current sheet receives a green boundary and numeral; motion-ready sheets enter with restrained vertical movement and opacity, while reduced-motion mode collapses the transition duration.

## Do's and Don'ts

### Do:

- **Do** let branded imagery, believable product-state overlays, and concise outcomes carry capability storytelling.
- **Do** reserve Craft Green for decisive action, focus, selection, verification, and handoff.
- **Do** combine expressive Manrope headlines with clear DM Sans explanations and controls.
- **Do** show product capability through credible editor, release, and WordPress-owned interface specimens.
- **Do** describe WordPress import as a complete independent local copy owned by WordPress.
- **Do** preserve visible focus, semantic labels, reduced-motion behavior, and 44px minimum interactive targets.

### Don't:

- **Don't** use interchangeable icon boxes, abstract feature rows, or hover effects that move the card's typography.
- **Don't** scatter Craft Green across decorative backgrounds or non-semantic accents.
- **Don't** round every section into a floating card or add shadows to ordinary content.
- **Don't** imply background synchronization, conflict merging, or continuing cloud ownership after WordPress import.
- **Don't** invent customer proof, marketplace approval, pricing, or production WordPress compatibility claims.
