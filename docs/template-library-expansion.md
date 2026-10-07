# Template library expansion

Status: discovery taxonomy and candidate roadmap. This document does not add, release or certify template packages.

## Current library

The library currently has five latest templates. Their package IDs, versions and SHA-256 values remain immutable; the discovery layer changes display copy and search metadata only.

| Display name | Package | Industry | Site type | Existing content shape |
| --- | --- | --- | --- | --- |
| Common Ground · Architecture Studio | `architecture-studio@1.0.0` | Architecture & Design | Portfolio, Business | Six-page project, practice, services and contact site |
| Marea · Coastal Stays | `coastal-rentals@1.0.4` | Travel & Hospitality | Accommodation | Nine-page multi-property host site with guest-services content |
| Northline · Creative Studio | `independent-studio@2.0.9` | Creative Services | Portfolio, Business | Four-page studio, services, about and contact site |
| Salt House · Holiday Homes | `salt-house@1.0.0` | Travel & Hospitality | Accommodation | Six-page holiday-home collection with property galleries |
| Stillwood · Cabin Retreat | `stillwood@1.0.0` | Travel & Hospitality | Accommodation | Nine-page cabin collection with experiences and field-guide content |

Accommodation templates provide editable example content and places for booking-provider links. They do not include a booking engine. Provider links need real project configuration before customer use. Cloud can supply managed form submission handling; portable or WordPress output needs a configured form endpoint.

## Discovery model

Industry answers **who the template serves**. Site type answers **what kind of site it is**. Keeping the facets independent prevents labels such as “Hospitality Portfolio” from becoming one-off categories and lets a creative business appear under both Portfolio and Business.

This structure is informed by the categories used in the official [Framer template marketplace](https://www.framer.com/marketplace/templates/) and [Webflow template library](https://webflow.com/templates), which cover portfolios, services, hospitality, publishing and other uses. The priorities below are recommendations based on gaps in Pagecraft's current library; they are not measured customer demand or a competitor ranking.

Controlled industry options should grow only when at least one released template uses them:

- Architecture & Design
- Creative Services
- Travel & Hospitality
- Professional Services
- Food & Drink
- Health & Wellness
- Home & Property
- Retail & Consumer
- Education & Learning
- Arts & Culture
- Community & Nonprofit
- Technology

Controlled site types should describe the primary information architecture rather than an unverified integration:

- Business
- Portfolio
- Accommodation
- Restaurant
- Editorial
- Directory
- Event
- Landing Page
- Nonprofit
- Education
- Product Catalog

“Product Catalog” is deliberately different from “Store”: a store label should wait until checkout, inventory and order behavior are implemented and tested. Accommodation, restaurant and event templates may show external provider links without claiming native booking, reservation or ticketing.

Search should include the new display name and description, stable package ID, previous catalog name, sample name, catalog description and categories, page names and useful aliases. That keeps searches such as “vacation rental,” “Northline Studio” and “Architecture Studio” working after the display-copy change. Unknown future packages keep their catalog name and description and receive no invented controlled facets.

For a larger catalog, promote controlled discovery metadata alongside each approved package. Add new filter options only when the library contains a matching release. Before the picker grows beyond a few dozen entries, replace per-card live iframes with approved package screenshots and open the interactive preview on demand. Add pagination or incremental results after measuring load time and memory; the current five-template picker does not need that machinery.

## Candidate roadmap

Candidates remain proposals until each has a distinct visual direction, an editable native Pagecraft package and current acceptance evidence.

### Phase 1: broad, common business needs

| Candidate | Industry | Site type | Differentiation from the current library |
| --- | --- | --- | --- |
| Neighborhood restaurant or café | Food & Drink | Restaurant, Business | Menu-first navigation, hours, location and dietary information; reservations remain an external link |
| Consultant or small professional firm | Professional Services | Business | Credibility, services, case studies and inquiry flow rather than an image-led portfolio |
| Photographer or illustrator | Creative Services | Portfolio | Media-led project sequencing and commission information, visually distinct from Northline |
| Wellness practice or studio | Health & Wellness | Business | Practitioner, service and schedule information; appointments remain an external link |

### Phase 2: richer content structures

| Candidate | Industry | Site type | Required boundary |
| --- | --- | --- | --- |
| Community nonprofit | Community & Nonprofit | Nonprofit | Programs, impact and volunteer/donation links without claiming donation processing |
| Independent journal | Arts & Culture | Editorial | Article index, story pages and contributors using native content structures |
| Course or workshop provider | Education & Learning | Education | Curriculum and enrollment information without claiming an LMS or payments |
| Property services directory | Home & Property | Directory, Business | Editable listings and inquiries without claiming MLS or portal synchronization |

### Phase 3: capability-gated formats

- A retail product catalog can ship before commerce, with clear external purchase links. Use the Store site type only after native or connected checkout, inventory and order flows pass acceptance.
- Event promotion can ship with schedules and external ticket links. Ticketing language waits for a tested integration.
- Booking-heavy accommodation can expand after provider configuration, error states and published links are tested in both Cloud and WordPress targets.

## Acceptance and evidence

Every candidate follows the existing premade-template workflow: native editable structure, honest fictional content, responsive review, keyboard checks, media and link checks, Cloud import/edit/save/reopen/frontend verification, WordPress import/edit/save/reopen/frontend verification, package integrity checks and immutable promotion. A candidate is not listed as tested because its discovery metadata or preview renders successfully.

The discovery module has unit coverage for the five current mappings, independent facets, search continuity, unknown-package fallback and input/package-identity immutability. Package compatibility remains covered by the existing template acceptance suites and release evidence; any package or host/editor revision change requires fresh evidence.
