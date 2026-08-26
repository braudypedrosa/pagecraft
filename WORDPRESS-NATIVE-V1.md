# Pagecraft WordPress Native Handoff v1

## Decision record

Pagecraft Cloud and WordPress use the same Pagecraft document model, compiler, renderer, and editor. Import creates an independent WordPress-owned copy. There is no background synchronization, conflict merge, deployment promotion, or CMS write-back.

Approved product decisions:

- After import, WordPress owns that copy and cloud changes never update it automatically.
- Reimport defaults to a new page. Explicit replacement creates a WordPress revision first.
- V1 supports the Pagecraft Theme only. Existing-theme compatibility is deferred.
- WordPress Pages is the only page library; Pagecraft does not add a duplicate Pages submenu.
- Pagecraft navigation becomes a native WordPress menu whose presentation remains controlled by the Pagecraft navigation component.

## Product contract

The Pagecraft web application creates, previews, shares, and exports sites. The WordPress product consists of a Pagecraft Builder plugin and Pagecraft Theme distributed together. Customers may upload an offline package or connect a Pagecraft account to browse and manually import cloud pages.

The WordPress plugin owns the admin menu, package import/export, account connection, full-screen editor, REST adapter, native page integration, revisions, media import, and generated assets. The theme owns frontend templates, Pagecraft header/footer locations, global presentation, and fallback rendering.

## Ownership lifecycle

1. Pagecraft Cloud owns the cloud project and page.
2. Export or manual cloud import produces a versioned package.
3. WordPress creates native page, menu, media, and global-element records.
4. WordPress stores canonical Pagecraft JSON in post metadata and compiled HTML in `post_content`.
5. The WordPress copy is edited and revised locally using the shared Pagecraft editor.
6. A later cloud import creates a new page by default or explicitly replaces a selected page after creating a revision.

No operation silently reconciles the cloud and WordPress copies.

## Shared runtime architecture

- One versioned Pagecraft document schema and migration chain.
- One editor bundle with web and WordPress host adapters.
- One component registry, canvas runtime, compiler, and site renderer.
- Web adapter: Pagecraft authentication, projects, pages, and cloud assets.
- WordPress adapter: REST nonces, pages, revisions, menus, media, options, and capabilities.
- Unsupported newer schemas fail with an actionable upgrade message.

## Native WordPress records

Each imported page is a native WordPress `page` with normal title, slug, status, author, featured image, revisions, menus, SEO hooks, and media relationships.

The page stores at least:

- `_pagecraft_document`
- `_pagecraft_schema_version`
- `_pagecraft_renderer_version`
- `_pagecraft_source_project_id`
- `_pagecraft_source_page_id`
- `_pagecraft_imported_at`
- `_pagecraft_compiled_hash`

Compiled sanitized HTML is stored in `post_content`. Content-hashed global CSS, page CSS, and runtime files are stored below `wp-content/uploads/pagecraft/` and enqueued by the plugin/theme. Uninstall never removes imported content or media by default.

## WordPress administration

The top-level Pagecraft menu contains:

- Overview
- Global Elements
- Import / Export
- Connect Account
- Settings

WordPress Pages remains canonical. Pagecraft adds a Pagecraft filter, ownership badge, compatibility status, “Edit with Pagecraft,” preview, and package-export actions to the native list.

For a new page, “Edit with Pagecraft” offers Start from scratch, Import from Pagecraft Cloud, or Upload a Pagecraft package. Existing Gutenberg content is never silently replaced.

## Navigation conversion

The Pagecraft Theme registers stable menu locations such as Primary Navigation, Footer Navigation, and Utility Navigation.

During full-site import:

1. Import pages and create a Pagecraft-page-ID to WordPress-page-ID map.
2. Create native WordPress menus and items.
3. Convert internal links to page-backed menu items, external links to custom items, and preserve nesting, order, targets, classes, relationships, and anchors.
4. Assign menus to Pagecraft Theme locations.
5. Bind imported Pagecraft navigation components to those locations.

WordPress owns menu content. Pagecraft owns navigation layout, responsive behavior, typography, spacing, colors, and mobile presentation. Editing menu items inside Pagecraft writes to the same native WordPress menu used by Appearance > Menus.

A single-page import never modifies global navigation automatically; it offers an explicit Add to menu action after import.

## Package formats

`.pagecraft-site.zip` contains a manifest, global elements, pages, compiled HTML, styles, assets, previews, schema/renderer versions, and hashes.

`.pagecraft-page.zip` contains one page document, compiled HTML, page CSS, referenced assets, required tokens, provenance, versions, and hashes.

WordPress can export a locally edited page back to the page package format for portability and backup. This does not create synchronization.

## V1 boundaries

Included:

- Pagecraft Theme and Pagecraft Builder plugin
- Same editor and renderer across web and WordPress
- Native WordPress pages, menus, media, revisions, and clean URLs
- Pagecraft global header and footer
- Full-site and single-page offline packages
- Optional account connection for manual page browsing/import
- Versioned generated assets and plugin-disabled rendering fallback

Deferred:

- Existing-theme compatibility
- Gutenberg block conversion or mixed Gutenberg/Pagecraft page bodies
- Background synchronization or merges
- WordPress Navigation block/FSE integration
- Cloud CMS write-back and native WordPress data providers
- Forms integrations, ecommerce, multisite, public marketplace distribution, MCP, and vacation-rental widgets

## Acceptance contract

- Identical documents compile identically on web and WordPress.
- Every current non-CMS Pagecraft element and inspector option renders consistently at desktop, tablet, and mobile widths.
- Imported pages are native WordPress pages and remain publicly renderable when the builder plugin is disabled.
- Pagecraft navigation imports as a native WordPress menu, follows WordPress slug changes, and remains editable from both Pagecraft and WordPress.
- Reimport never overwrites local work without explicit confirmation and a recoverable revision.
- Existing WordPress pages, menus, media, and settings remain untouched unless selected by the administrator.
- Unsupported schema, CMS binding, custom code, or package content fails with a clear remediation message instead of silently degrading.
- Automated tests cover package integrity, migrations, permissions, import idempotency, revisions, navigation mapping, media deduplication, fallback rendering, accessibility, and clean URLs.
