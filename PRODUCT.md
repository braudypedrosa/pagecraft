# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pagecraft serves people who need an instant publishable website and WordPress site owners who want the same visual builder without remaining dependent on a hosted runtime. WordPress v1 is initially for Braudy's own controlled test installation before broader customer distribution.

## Product Purpose

Pagecraft is a visual website builder for creating, previewing, and publishing hosted sites, then optionally handing a complete project to WordPress as independently editable local content. Success means a customer can build either in Cloud or directly in WordPress without requiring synchronization or Pagecraft availability for WordPress rendering.

## Positioning

Pagecraft separates a portable, versioned document from the environment that owns it. Pagecraft Cloud owns the cloud copy; after import, WordPress owns the WordPress copy. The two environments share one document model, compiler, renderer, and editor, but never silently synchronize.

## Operating Context

- Authors work in Pagecraft Cloud or through the same full-page editor embedded in WordPress Admin.
- Cloud import is optional and whole-project only. WordPress uses a revocable PKCE connection to download the internal project package; there is no user-facing project upload or page-by-page Cloud import.
- Imported pages are native WordPress `page` records. The Pagecraft document is stored in post metadata and compiled fallback HTML is stored in `post_content`.
- WordPress Pages is the canonical page library. Pagecraft adds badges, filters, and “Edit with Pagecraft” actions instead of a duplicate Pages screen.
- Pagecraft navigation is converted to a native WordPress menu and bound back to the imported navigation component; WordPress owns menu content while Pagecraft owns presentation.

## Capabilities and Constraints

- Pagecraft supports its current element, component, responsive-style, interaction, asset, SEO, and approved custom-code model in both hosts.
- WordPress v1 supports single-site, WordPress 6.6 or newer, PHP 8.1 or newer, HTTPS, pretty permalinks, and the Pagecraft Theme only.
- Pagecraft-managed pages use the Pagecraft editor for layout. Native WordPress fields, revisions, menus, media, status, author, slug, and integrations remain available.
- Generated CSS and runtime assets live under versioned Pagecraft upload paths rather than being written into the installed theme directory.
- Cloud CMS bindings must be flattened with an explicit warning or rejected during import. Native WordPress data providers are deferred.
- Background synchronization, Cloud push, conflict merging, staging promotion, Gutenberg conversion, existing-theme compatibility, multisite, billing, MCP, ecommerce, and vacation-rental widgets are outside v1.

## Brand Commitments

The product is Pagecraft. Its established interface is a calm editorial workbench: Paper is the working surface, Ink provides structure, and Craft Green is reserved for action, focus, selection, and status. Manrope and DM Sans, the existing Pagecraft logo assets, and the current compact control vocabulary are incumbent visual authority.

## Evidence on Hand

- The canonical builder, renderer, persisted document model, revision history, and production Pagecraft deployment are in this repository.
- Brand assets and tokens live under `brand/`.
- The current comprehensive demo and test fixtures exercise Pagecraft's supported element and CMS system.
- No public customer claims, pricing, marketplace approval, or production WordPress compatibility evidence exists yet and must not be fabricated.

## Product Principles

- An import is a copy and an ownership handoff, never an implied synchronization relationship.
- Reimport is manual and whole-project. It matches immutable source IDs, creates revisions before updates, adds new pages, and marks missing Cloud pages without deleting them.
- Stable Pagecraft identities, versioned schemas, deterministic compilation, and file hashes make packages auditable and repeatable.
- Existing WordPress content, navigation, and media are never silently overwritten.
- Published pages retain compiled HTML and CSS so disabling the builder does not blank the site.
- Administrative interfaces state whether content is cloud-owned, imported, or locally WordPress-owned.

## Accessibility & Inclusion

The builder, WordPress administration surfaces, published output, and all existing interactive components must preserve keyboard operation, visible focus, semantic names, responsive reflow, and accessible error/status feedback.
