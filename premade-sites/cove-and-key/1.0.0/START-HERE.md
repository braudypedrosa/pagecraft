## Compatibility verification — latest

See `evidence/compatibility/REPORT.md`. Local Cloud import/edit/save/reopen and offline WordPress PHP package parsing pass. Publication is blocked by5unconfigured forms. WordPress-host and production Cloud acceptance remain pending. Full suite has1catalog-selection failure. These findings supersede older generic compatibility statements.

## Current review controls

Four explicitly sample reviews. Native Slider controlsPosition=bottom groups previous arrow, four dots and next arrow in one centered row beneath the quote. This supersedes earlier side-arrow placement. Desktop/mobile control centerlines verified equal and previous-arrow navigation verified. The new native Controls position inspector option requires the updated local core renderer before host acceptance. Property slider retains its side arrows.

## Hero search correction — current

Hero is a search placeholder with Arrival, Departure, Guests and Search stays only. Four desktop columns, two tablet columns, one mobile column; controls share a bottom baseline. No inquiry identity fields in hero. Contact/property inquiry forms retained. No availability search backend is connected.

This draft now depends on the local core Form additions: native Field layout, Grid columns and Button alignment controls with CSS variable rendering. These must be included in host/editor acceptance before template promotion; older host renderers do not expose these new controls. Shared default form layout remains wrapped fields.

## Latest review and FAQ correction

User explicitly requested retaining the review slider. It is restored as a centered native slider with centered heading and attribution, full-width slides and72px desktop/48px mobile side gutters separating arrows from text. The previous static-review change is superseded. Homepage FAQ now uses a left terrace image and vertically centered right content column, stacking on mobile. Native next-arrow advancement and desktop/mobile layout verified; package check passed.

# Latest correction pass

The ten browser comments have been applied. Current preview is a local draft awaiting user visual review; prior independent ship verdicts are historical. See `evidence/comments/changes.md` and current screenshots. Reviews are now two visible quotations; amenities are visible groups; FAQ rules appear only between questions. Shared closing and property CTAs use photographs, and the footer has brand and navigation columns.

# Customize Cove & Key

This is the eight-page rebuilt native Pagecraft draft for user-approved **B — Horizon Club**. Pages: Home, Stays, Cove House, Palm Terrace, The Lookout, The Coast, Our Story and Contact. Read template-local `PRODUCT.md` for scope and `BRIEF.md` for the approved contract and `DESIGN.md` for actual tokens and component guidance.

## Build and check

From `/Users/braudypedorsa/Projects/pagecraft-premade-sites`:

```bash
npm run template -- build cove-and-key 1.0.0
npm run template -- check cove-and-key 1.0.0
```

The build writes `premade-sites/cove-and-key/1.0.0/draft/site.pagecraft-site.zip`, `draft/manifest.json` and the eight pages under `draft/preview/`. Open `draft/preview/index.html` through a local server for the complete linked preview. For example, run `python3 -m http.server 4877` from the repository root, then open `http://localhost:4877/premade-sites/cove-and-key/1.0.0/draft/preview/index.html` in the built-in browser. Build/check does not promote the template or change the catalog.

## Replace the demonstration content

Edit `source.ts` for reproducible package changes. Edit native nodes in Pagecraft after import for a host-owned customized site. Replace the `homes` records and each detail page's amenities, sleeping arrangements, policies and photography with confirmed facts. Update the reusable Vacation home feature props, gallery captions, image alt text and page destinations consistently. Add replacement assets to `template.config.json`; preserve asset IDs when simply swapping a file.

Replace the fictional Cove & Key logo/name if needed. The graphic logo and symbol are in `assets/`; the branding and directions folders retain preparation evidence. Replace illustrative quotations only with authorized real reviews, or remove the reviews section. Remove demo disclosures only where the underlying content has genuinely been replaced. Set site URL and SEO metadata when the real destination is known.

## Configure inquiry delivery later

The user requested placeholders now and PMS connection later. The home form contains Arrival, Departure, Guests, Name and Email. Property forms omit Name. Contact additionally includes Preferred home. Every form currently uses native `mode: external`, empty `action` and `method: post`, so sending is intentionally disabled.

Later select each native Form, choose **Submission handling → External HTTPS endpoint**, enter the complete endpoint in **Where submissions go**, and use the receiving service's required **Method**. Update all Home, Contact and property forms. In an eligible WordPress installation, **WordPress managed** is another native mode; configure its receiving behavior in that host and verify it there. Do not switch modes merely to hide the unconfigured state. Test required fields, error/success feedback and actual receipt before claiming delivery. Inquiries do not confirm availability or reserve a property.

## Connect a PMS later

On each property page, find the box named `booking-widget` (HTML anchor `booking`) and its “Make this your next stay.” heading with the preview-only reservation disclosure. Replace the placeholder content with Pagecraft's native **Embed** component using the actual provider's supported embed configuration. Keep the surrounding native panel and useful inquiry fallback if appropriate. Map the provider's property ID, dates, rates and booking destination correctly; replace placeholder copy only after verification. Provider script permissions, iframe behavior, responsive sizing, consent requirements and final booking flow need host-specific testing. Do not paste a custom page layout into Embed.

## Review and release boundary

Current independent disposition: **ship — local draft only**. All six material fixes are resolved; native submit sizing uses the documented exception. See `evidence/rebuild/verdict/reviewer.md`. The user rejected the first implementation. Its previous “ship for draft preview” verdict, package hash and interaction evidence do not approve or verify this rebuild.

The rebuilt native source now has a centered desktop headline over the panorama and an opaque mobile title area above the photograph, an overlapping five-field planner, a single-row mobile header with the desktop CTA hidden, a 92% property feature slider, semantic Quote components, compact four-field property booking panels, bold heading tokens, and 18px form text. Native half-width flags control form wrapping; submit width remains intrinsic because the native Form does not expose width/alignment. See `evidence/rebuild/limitations.md` for this limitation and unavailable preparation evidence. All eight page layouts are present. `source.ts` is authoritative for the current artifact.

The final 16 desktop/mobile captures are in `evidence/rebuild/verdict/`. Earlier captures in `evidence/rebuild/` predate the final reviewer fixes. The final 32 viewport checks across all eight pages at 390, 768, 1024 and 1440px passed: no horizontal overflow or broken images, and one H1 per page. Final type checking, three focused tests and template check also passed. The hero overlay's exact value and responsive behavior are recorded in `DESIGN.md`; its prior undocumented-color advisory does not itself establish a visual defect or acceptance.

The independent final verdict is clear for the local draft; it is not user approval or host acceptance. Use the generated `draft/manifest.json` for the current package hash instead of a copied hash in this guide. Historical files under `evidence/` outside `rebuild/` describe the rejected implementation and must not be cited as fresh interaction proof. Final menu, both sliders, accordion and gallery open/close checks passed; see `evidence/rebuild/verdict/interactions.json`. These local checks do not establish a full accessibility audit or either host's acceptance.

Inquiry delivery and the PMS connection remain deliberately blank for the later integration phase. Live inquiry receipt, PMS availability/payment/reservation flow, Cloud acceptance and WordPress import/runtime acceptance remain unverified. Complete both host acceptance gates and obtain release approval before promotion. No catalog promotion, release or production deployment is claimed here.
