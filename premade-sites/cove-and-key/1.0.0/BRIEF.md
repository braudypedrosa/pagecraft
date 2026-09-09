# Cove & Key vacation-rental template

Status: user approved B with exact reply “B”. Draft implementation under review; no release approval.

Audience: travelers comparing a small collection of coastal vacation homes.
Primary action: send a stay inquiry, then use the configured booking provider to confirm a reservation.
Demo identity: Cove & Key, with a custom graphic cove/key symbol and production SVG assets after direction selection.

## Requested site

Home with native Pagecraft inquiry form in the hero, native property slider, frequent contextual calls to action, and a review section. Stays collection plus three individually reachable property pages (Cove House, Palm Terrace, The Lookout), The Coast, Our Story, and Contact. Property pages include galleries, amenities, policies, booking inquiry widget and provider handoff.

## Product evidence

Target is the dedicated pagecraft-premade-sites worktree. Native form and slider exist in app/src/core/index.ts. Form uses an external receiving action; blank action must not claim delivery. Booking integrations are supplied through the native Embed component; there is no native availability/payment engine. Native-only layout is required by the template contract. Custom GSAP pinning is not exposed as a native component and must remain an explicit capability gap rather than hidden layout code. Native animation is the editable alternative.

No booking provider or receiving endpoint has been supplied. No real property facts, prices, availability or guest reviews have been supplied. All demo content and generated photography must be identified as illustrative; reviews must never be represented as verified stays. Live booking and inquiry delivery remain configuration gates.

## Direction preparation

Three image-generated desktop/mobile concepts hold one brand palette and type voice constant while varying composition. Each shows a hero inquiry form and meaningful inventory section. These are visual concepts, not implemented functional previews or final logo masters.

Deterministic GPT Taste selection from 235-character normalized brief: Artistic Asymmetry; Satoshi; Horizontal Accordions, Inline Typography Images, Infinite Marquee; Scroll Pinning, Image Scale & Fade. Later intentional-web-design rules reject decorative inline images and promotional marquees, and Pagecraft requires native editable layouts. Carry the asymmetric starting direction and typography into option A; alternatives explicitly test different geometry. Do not implement unsupported motion or rejected decoration silently.

Options: A Open Cove, asymmetric image with tall form; B Horizon Club, centered cinematic hero with integrated wide planner and single-feature property carousel; C Stay Finder, task-first left planner with tall right media and image filmstrip inventory. User selected B.

## Next gate

Direction selection complete. Latest user instruction: booking placeholders for now; connection to a real PMS is a later phase. Native Pagecraft forms intentionally remain unconfigured. Verify both host compatibility and every page before promotion. Preserve unrelated dirty work and existing templates. No production deployment is authorized by this draft creation.

## Approved implementation contract

THESIS: Coastal browsing and a wide inquiry planner share the opening.
OWN-WORLD: Navy, white and pale sea blue; graphic cove/key logo, Manrope, quiet rounded controls.
STORY: Discover a home, inspect practical details, plan a stay.
FIRST VIEWPORT: Solid navigation with blue CTA; centered headline; full-width coastal photograph; attached wide native form.
FORM: User-selected B, Horizon Club; initial Python brief seed 235 generated option A but user approval overrides that selection. No fabricated concept-script seed or quality board.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md

Native adaptations: Manrope instead of Satoshi; two-column form fields; native motion and controls instead of custom GSAP; PMS placeholders instead of a live connection. Contract is recorded here because native-only packages disallow injected head HTML.
