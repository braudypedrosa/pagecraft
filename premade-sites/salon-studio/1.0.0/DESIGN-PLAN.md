# Morrow & Muse design plan

## Intent

Morrow & Muse is a fictional independent hair studio for clients who value a considered consultation, editorial taste and clear maintenance expectations. The site should feel tactile, current and human without relying on luxury clichés, invented proof or price claims.

The persisted `ui-ux-pro-max` result recommended a Swiss minimal structure, strong contrast, generous spacing, Work Sans body copy and an editorial black/pink palette. That hierarchy and accessibility direction fit the project. The implementation adapts hot pink to deeper plum and dusty rose, then uses Cormorant Garamond for the high-fashion editorial voice while retaining Work Sans for practical copy.

## Composition

- Shared header: original interlaced logo, four-item native menu, fullscreen mobile navigation.
- Home hero: wide architectural photograph with a plum panel cutting into its lower edge. This avoids the recent image-left/copy-right and green split-hero patterns.
- Home journey: cohesive brand thesis, open service ledger, texture-led craft feature, appointment rhythm, documentary team window, and a restrained inquiry prompt.
- Services: price-free service ledger, texture craft image, and native consultation accordion.
- Studio: full-width room portrait, editorial caption, studio story, practical owner-detail prompts, and team transition.
- Team: wide documentary image, honest fictional profiles, shared working values, and routing inquiry.
- Contact: explicit unconfigured appointment inquiry form and a clear description of what a real confirmation must include.
- Shared footer: compact plum band with graphic logo, one wrapping navigation group and one concise demo disclosure.

## Native system

- Pagecraft nodes only: section, box, heading, image, button, nav, accordion and form.
- No custom CSS, head HTML, custom JavaScript or static HTML replica.
- Site tokens control background, paper, ink, text, plum, berry, rose, blush, muted and rule colours.
- Site text styles define desktop, tablet and mobile sizes. All nodes carry desktop, tablet and mobile style blocks.
- Buttons and text links meet the 44px target, with authored hover and keyboard focus states.
- Headlines stay short. The home headline is one line at desktop size.

## Content guardrails

- No reviews, testimonials, awards, rankings, years in business, outcome statistics or qualification claims.
- No real address, phone, email recipient or social handle.
- No invented prices. Service scope and pricing must be replaced from verified owner information.
- The inquiry form remains inert until configured. It never states that submission books or confirms an appointment.

## Review state

Local authored candidate only. Human direction selection, Cloud QA, WordPress QA, independent visual review and final approval remain empty in `workflow.json`.
