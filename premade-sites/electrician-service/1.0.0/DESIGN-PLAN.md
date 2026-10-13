# Copperline Electric design plan

## Direction

Copperline uses a calm editorial trade identity: deep ink and cobalt structure, copper action color, warm cream surfaces, hard line dividers and natural service photography. It avoids emergency red, lightning-bolt clichés, fabricated credentials and noisy card grids.

The required `ui-ux-pro-max` design-system query was `electrician service industrial editorial`. Its strongest fit was the trust-and-authority service pattern, flat clean lines, professional blue with a warm action color, visible focus, 44px controls and a low-friction inquiry. The implementation adapts the typography result for readability: Inter carries operational headings and body copy; Playfair Display appears only in large lead text. Suggested certification and proof-logo sections were excluded because the fictional demo has no verified credentials or customers.

## Section plan

- **Home:** split service hero; two-column service ledger; dark three-phase working method without numeric counters; finished-lighting photo essay; project-fit prompt; compact inquiry band.
- **Services:** dark editorial introduction; renovation photo and service detail; three distinct service groups; inquiry preparation list; native FAQ.
- **Work & Method:** planning-scene introduction; clearly labelled sample scenarios rather than fake case studies; handover-focused method panel.
- **Contact:** unconfigured-state introduction; labelled native inquiry form; explicit delivery warning; launch checklist.
- **Shared frame:** graphic SVG logo, native responsive menu, compact branded footer and quiet fictional-demo disclosure.

## Responsive intent

Desktop uses deliberate split compositions and broad reading rhythm. Tablet keeps two-column structure where it remains legible and reduces three-column groups to two. Mobile stacks content in source order, keeps 44px minimum interactive controls, uses the native dropdown menu and retains explicit form labels and configuration warnings.

## Native implementation

All content is editable Pagecraft nodes. Colors and type are tokens/styles. Header, footer, navigation, accordion and form use native widgets. Breakpoint styles are stored in each node for desktop, tablet and mobile. No document CSS, head HTML, JavaScript or custom HTML replica is included.
