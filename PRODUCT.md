# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pagecraft serves people who need a publishable website quickly and site administrators who want a visual builder without surrendering their content to a hosted runtime. Connected WordPress v1 is initially for Braudy's own controlled test installations before broader customer distribution.

## Product Purpose

Pagecraft is a visual website builder whose canonical project can be published either through Pagecraft hosting or as a verified local release on WordPress. Success means an administrator can design once, publish deliberately, and keep the last published WordPress site online even when Pagecraft is unavailable.

## Positioning

Pagecraft separates a portable, signed release from the editor that authored it. WordPress is a self-contained deployment target and integration surface, while Pagecraft remains the source of truth for managed pages, templates, design, and release history.

## Operating Context

- Authors work in the Pagecraft editor directly or through a full-page editor embedded in WordPress Admin.
- Autosave records drafts. Explicit Publish creates immutable releases.
- A project may connect one staging and one production WordPress site; staging verification precedes automatic production promotion.
- WordPress administrators manage connection health, script approvals, synchronization, forms, CMS-item write-back, and emergency rollback.

## Capabilities and Constraints

- Pagecraft supports its complete current element, component, responsive-style, interaction, CMS, asset, form, SEO, and custom-code model.
- Connected WordPress v1 supports WordPress single-site, WordPress 6.6 or newer, PHP 8.1 or newer, HTTPS, and pretty permalinks.
- Pagecraft-managed pages are read-only in Gutenberg. Production WordPress may write CMS item fields and media back to the Pagecraft draft; schemas and templates remain Pagecraft-owned.
- WordPress remains live on the last verified local release when disconnected. The installed Pagecraft theme/connector remain part of that runtime.
- Multisite, native editable handoff, DNS provisioning, billing, public marketplace distribution, arbitrary third-party builder conversion, MCP, and vacation-rental widgets are outside v1.

## Brand Commitments

The product is Pagecraft. Its established interface is a calm editorial workbench: Paper is the working surface, Ink provides structure, and Craft Green is reserved for action, focus, selection, and status. Manrope and DM Sans, the existing Pagecraft logo assets, and the current compact control vocabulary are incumbent visual authority.

## Evidence on Hand

- The canonical builder, renderer, persisted document model, revision history, and production Pagecraft deployment are in this repository.
- Brand assets and tokens live under `brand/`.
- The current comprehensive demo and test fixtures exercise Pagecraft's supported element and CMS system.
- No public customer claims, pricing, marketplace approval, or production WordPress compatibility evidence exists yet and must not be fabricated.

## Product Principles

- Drafts are private; only explicit releases become public.
- A failed deployment never replaces a healthy public release.
- Stable Pagecraft identities, deterministic artifacts, and signatures make synchronization auditable and repeatable.
- Existing WordPress-owned content is never silently overwritten.
- Administrative interfaces state the current target, release, ownership, and recovery action plainly.

## Accessibility & Inclusion

The builder, WordPress administration surfaces, published output, and all existing interactive components must preserve keyboard operation, visible focus, semantic names, responsive reflow, and accessible error/status feedback.
