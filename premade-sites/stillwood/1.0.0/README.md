# Stillwood — Woodland Cabin Retreats

Native Pagecraft test-run template, 1.0.0 draft. Nine pages; twelve main homepage sections plus a shared photographic closing CTA and footer. Not promoted or deployed.

## Review locally

- Package-rendered preview: http://127.0.0.1:4924/draft/preview/index.html
- Isolated Cloud builder: http://localhost:4929/edit/s2
- Isolated WordPress frontend: http://127.0.0.1:4926/
- Isolated WordPress builder: http://127.0.0.1:4926/wp-admin/admin.php?page=pagecraft-editor&post=11

These are temporary local QA processes. Source, assets, package and records are kept in this directory. Cove & Key's LocalWP installation and pages were preserved.

## Design

Updated from nine annotated browser comments; see evidence/feedback-revision.md. The current design supersedes the initial section descriptions below where they differ.

Warm ivory, forest green, Georgia editorial headlines and restrained sans-serif body copy. An original pine/cabin graphic mark is supplied as PNG for both hosts, with its SVG source retained. Four original generated photographs portray fictional homes and interior inspiration.

Homepage: full-width forest hero; compact date/guest search; three-part welcome; portrait cabin carousel; indoor-season editorial feature; cabin chooser rows; numbered weekend itinerary; staggered field-guide imagery; comforts list; four-slide centered guest stories; brand statement; practical FAQ. Inner pages: cabin collection/comparison, three property pages with galleries and booking placeholders, experiences, field guide, story, contact.

The shared cabin component exposes image, description, capacity, name, stay style and destination. Native galleries, sliders, forms, menu, accordion and responsive node styles are used. There is no custom HTML/CSS replica or preview-only runtime.

## Deliberate setup requirements

The search and four inquiry/booking forms have no service configured. Native Pagecraft disables their controls and reports `form-no-action`. No availability, delivery or PMS connection is claimed. The current Cloud publish gate blocks these unconfigured forms. Configure real integrations before a live business launch; do not invent endpoints to bypass that gate.

## Build

From the template checkout:

```
node tools/premade-sites.ts build stillwood 1.0.0
node tools/premade-sites.ts check stillwood 1.0.0
node tools/premade-sites.ts status stillwood 1.0.0
```

See evidence/test-run.md for the tested scope and outstanding release matrix. The design is a new candidate, not a user-approved library addition.
