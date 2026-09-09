## Current review controls

Four explicitly sample reviews. Native Slider controlsPosition=bottom groups previous arrow, four dots and next arrow in one centered row beneath the quote. This supersedes earlier side-arrow placement. Desktop/mobile control centerlines verified equal and previous-arrow navigation verified. The new native Controls position inspector option requires the updated local core renderer before host acceptance. Property slider retains its side arrows.

## Hero search correction — current

Hero is a search placeholder with Arrival, Departure, Guests and Search stays only. Four desktop columns, two tablet columns, one mobile column; controls share a bottom baseline. No inquiry identity fields in hero. Contact/property inquiry forms retained. No availability search backend is connected.

This draft now depends on the local core Form additions: native Field layout, Grid columns and Button alignment controls with CSS variable rendering. These must be included in host/editor acceptance before template promotion; older host renderers do not expose these new controls. Shared default form layout remains wrapped fields.

## Latest review and FAQ correction

User explicitly requested retaining the review slider. It is restored as a centered native slider with centered heading and attribution, full-width slides and72px desktop/48px mobile side gutters separating arrows from text. The previous static-review change is superseded. Homepage FAQ now uses a left terrace image and vertically centered right content column, stacking on mobile. Native next-arrow advancement and desktop/mobile layout verified; package check passed.

---
name: Cove & Key — Horizon Club
description: Native coastal vacation-rental template, approved direction B.
colors:
  bg: "#ffffff"
  ink: "#123344"
  text: "#284d60"
  brand: "#007da5"
  surface: "#eaf5f8"
  muted: "#526b78"
  line: "#bdcfd7"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "60px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.03em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.03em"
  subtitle:
    fontFamily: "Manrope, sans-serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.03em"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
  lead:
    fontFamily: "Manrope, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "Manrope, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  btn:
    fontFamily: "Manrope, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  field: "6px"
  button: "8px"
  panel: "12px"
  property: "10px"
spacing:
  field-gap: "12px"
  compact: "24px"
  panel: "32px"
  grid: "40px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.bg}"
    typography: "{typography.btn}"
    rounded: "{rounded.button}"
    padding: "15px 24px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.btn}"
    rounded: "{rounded.button}"
    padding: "15px 24px"
  field:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "9px 12px"
  planner:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.panel}"
    padding: "24px 32px"
  property-card:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.property}"
---

# Design System: Cove & Key

## Overview

**Creative North Star: "Horizon Club"**

A calm coastal collection with navy framing, clear white surfaces and pale sea-blue sections. Expansive generated photography carries the setting; direct headings and a visible inquiry planner make the next step understandable.

This document captures the rebuilt native implementation of user-approved direction B (exact approval: “B”). Direction approval does not constitute acceptance of this implementation; the first implementation was rejected and independent review of this rebuild is pending. It applies only to this template version, not the Pagecraft editor brand. `BRIEF.md` owns the THESIS, OWN-WORLD, STORY, FIRST VIEWPORT and FORM contract plus FINISH gate. The selected concept is adapted to native Manrope, wrapping half-width form fields and native controls. Template-local `PRODUCT.md` records its audience, demo-content constraints and host boundaries. Booking placeholders now and PMS configuration later are the user-approved functional scope.

**Key Characteristics:**

- Navy framing with white headings and a blue action color.
- Panoramic photography with an attached white planner.
- A selected property with a glimpse of the next home.
- Native editable components and plainly identified demonstration content.

## Colors

The primary blue makes actions visible; navy supplies structure and pale blue separates browsing sections.

### Primary

- **Booking blue (`brand`)**: primary links, inquiry controls and field focus.

### Neutral

- **White (`bg`)**: page background, planner, property panels and reversed text.
- **Coastal navy (`ink`)**: header, closing call to action and headings.
- **Deep sea text (`text`)**: body copy.
- **Pale sea blue (`surface`)**: inventory, reviews and property inquiry surfaces.
- **Harbor gray (`muted`)**: metadata and demonstration disclosures.
- **Mist border (`line`)**: fields, outline buttons and practical information dividers.

## Typography

Manrope is used for both headings and body through Pagecraft's native font stack. Satoshi appears in concept history only. The frontmatter records desktop roles; the native document holds tablet and mobile overrides.

| Role | Tablet | Mobile |
| --- | --- | --- |
| Display | 48px | 34px |
| Title | 30px | 27px |
| Subtitle | 24px | 22px |
| Lead | 18px | 17px |
| Body | 18px | 17px |
| Small | 14px | 14px |
| Button | 16px | 16px |

Headings are bold with compact leading and slightly tightened tracking. Body copy is regular with generous leading. The home inventory heading is a local emphasis at 44px desktop, 36px tablet and 30px mobile; it does not replace the reusable title token. Introductory copy is typically constrained to roughly 60–65 characters. Native form labels use 0.82em of the form's 18px size with medium weight.

## Layout

The document maximum content width is 1280px. Standard sections use 80px vertical and 40px horizontal padding, adapting to 48px/32px on tablet and 56px/20px on mobile; individual hero and detail sections override these intentionally. Native breakpoints are tablet at 1024px and mobile at 767px.

The desktop hero title is centered over an edge-to-edge panorama in a 560px stage. On mobile, a 170px opaque navy title area sits above a 220px photograph, making a 390px stage. Its compact white planner overlaps the photograph by 98px on desktop and 32px on mobile. Five half-width fields wrap when their native 12rem minimum width no longer fits. Native field half-width flags alone establish this wrapping layout; no custom form grid is present. The home collection follows on the same pale-blue surface. **The Attached Planner Rule.** Preserve the visual connection between the panorama and the planner when adapting the home opening.

Property cards use a 1.5:1 photograph-to-copy split and stack on mobile. The property slider occupies 92% per slide on desktop and mobile, leaving an adjacent peek. Detail pages pair practical information with an inquiry panel at 1.15:1; galleries are two columns, then one on mobile. The mobile header keeps the logo and native menu toggle on one compact row and hides the desktop action. Stays uses a vertical collection and comparison table; all three property pages share gallery, details, booking panel and related-home layouts. The Coast and Our Story use broad image-led sections; Contact pairs context and photography with the fuller inquiry form.

## Elevation & Depth

The template adds no shadow system. Overlap, photography, white panels and alternating pale blue sections establish depth. Keep surfaces flat and let content boundaries do the work. The hero alone uses a native decorative overlay, `linear-gradient(180deg,rgba(7,36,52,.96) 0%,rgba(7,36,52,.62) 34%,rgba(7,36,52,0) 60%)`, to support white text over photography on desktop and tablet. The overlay is hidden on mobile, where an opaque navy background supports the title. This is a local contrast treatment, not a reusable accent ramp or a shadow. The saved rebuild detector identified this previously undocumented overlay as an advisory.

## Shapes

Quiet rounded fields, buttons and panels use the distinct frontmatter radius roles. Hero photography remains square and full width; property cards and gallery images use softly rounded containers. Fields and outline actions use fine one-pixel borders.

## Components

### Buttons

Primary actions are blue with white labels; outline actions are transparent with navy labels and mist borders. Native buttons have a minimum height of 48px. Keep the native visible focus outline; no template-specific hover transformation is added to buttons.

### Inquiry form

The home planner uses five required native fields: Arrival, Departure, Guests, Name and Email. Property booking panels use four, omitting Name. Contact uses six, adding Preferred home to the home planner fields. Compact property forms carry the home in their accessible form name; they do not expose a home selector. Every form retains an 18px base, 12px field gap and compact 9px/12px field padding. Native focus uses a two-pixel blue outline with one-pixel offset. The submit control is intentionally disabled while the external action is empty; the native status explains that submissions are not configured. Do not substitute a fake success state. Submit width and alignment are not exposed by the native component: its renderer keeps the button at intrinsic width. Preserve that native limitation instead of adding hidden layout overrides; `evidence/rebuild/limitations.md` records the verified boundary.

### Navigation

A supplied SVG logo sits on navy beside white links and the primary action. The native navigation supplies the mobile menu and keyboard behavior. Preserve the compact mobile row and the menu's accessible name; the header action is hidden on mobile.

### Vacation home feature

The reusable `cove-property` component exposes title, facts, description, image, alt text and destination. Instances power the collection, home slider and related properties. Keep descriptive copy beside the image and a clear route to the individual page.

### Gallery, reviews and practical information

Property galleries use the native lightbox with captions. The native review slider contains semantic Quote components with separate sample-review attribution. Quotes use 34px desktop and 26px mobile text, medium weight and 1.3 leading; both sample stories remain identified as illustrative. Quote text omits authored quotation marks so the native component supplies them once. Review slides explicitly occupy 100% at desktop, tablet and mobile. Native accordions hold booking questions and amenities; the collection comparison uses the native Table. Preserve the real controls and semantic structures when customizing.

### Booking placeholder

Each property has an anchored booking panel with explanatory copy, a compact four-field native inquiry form and a preview-only reservation disclosure. It is not a PMS widget yet. Later replace the placeholder with a configured native Embed component; keep layout native and verify the actual provider in both hosts.

### Motion and states

Non-logo native image nodes have a subtle brightness hover (1.04) with a 400ms filter transition. The shared renderer supplies component focus and menu behavior. No custom GSAP pinning, marquee or hidden layout code is present; unsupported motion remains a documented capability gap.

## Do's and Don'ts

### Do:

- **Do** preserve user-approved Horizon Club geometry when extending this template.
- **Do** customize through native tokens, components, props and responsive styles.
- **Do** keep illustrative disclosures until real property and guest evidence replaces them.
- **Do** verify form delivery and actual PMS behavior after later configuration.

### Don't:

- **Don't** describe these placeholders as availability, payment or confirmed booking functionality.
- **Don't** introduce custom HTML or injected CSS to imitate unsupported concept effects.
- **Don't** apply this template's palette to the root Pagecraft editor design system.

Not canonized: task-specific sample copy and unavailable concept-preparation artifacts do not establish reusable visual rules. The intrinsic-width submit button is a native capability boundary, not a reason to invent unsupported form layout controls.


## Browser-comment corrections — current overrides

Navigation hover is #9fdef0. Hero desktop text padding-top is76px with extended dark overlay; mobile title region200px and photo220px. Planner transform translateY(-98px), mobile-32px, uses compensating bottom margin so the section background cannot obscure the overlap. All ordinary image nodes have radius0; card shells own clipped outer corners. Reviews are two static visible native Quote elements. FAQ uses one-item native accordions with transparent outer rules and wrapper borders only between questions. Property amenities use visible grouped headings and facts. Closing CTA has dining photography, property coast CTA has coast photography, each with rgba(8,35,48,.62) overlay. Footer is navy with graphic logo and two navigation groups, muted bottom disclosure and responsive single-column reflow. These rules supersede earlier slider, footer and overlap descriptions.
