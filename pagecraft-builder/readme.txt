=== Pagecraft Builder ===
Contributors: pagecraft
Requires at least: 6.6
Requires PHP: 8.1
Stable tag: 0.2.0
License: GPLv3 or later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Import and edit Pagecraft content as independently owned native WordPress pages.

== Description ==

Pagecraft Builder is the WordPress host for the Pagecraft editor and portable document format. Imported pages are native WordPress pages. WordPress owns the imported copy and Pagecraft Cloud never updates it automatically.

Version 0.2.0 establishes the native Builder package, compatibility boundary, local capabilities, managed-page ownership, strict page-package import service, and full-screen WordPress editor host. Imported pages retain canonical Pagecraft source and provenance in revision-enabled metadata while sanitized compiled markup remains native `post_content`.

Generated project/global CSS, page CSS, and the trusted Pagecraft interaction runtime are immutable content-hashed files below `wp-content/uploads/pagecraft`. Revision-capable native global-element records hold the Pagecraft header and footer. Updating the plugin or theme does not overwrite those files or records.

WordPress Pages remains the only page list. It receives Pagecraft status, filtering, and Edit with Pagecraft actions. Ordinary Gutenberg pages require an explicit revision-backed conversion before the shared editor can save them. The top-level Pagecraft menu owns overview, global-element, import/export, connection, and settings entry points without creating a second page library.

The editor uses a same-origin nonce-protected WordPress REST adapter, optimistic document versions, visible save/conflict recovery, WordPress revisions, content-hashed styles, and refreshed native fallback markup.

Pagecraft navigation becomes native WordPress menu data assigned to the Pagecraft Theme's Primary, Footer, and Utility locations. Internal destinations remain page-backed, so WordPress slug changes update automatically. Nesting, order, anchors, external URLs, targets, CSS classes, and XFN relationships round-trip through the same records edited under Appearance > Menus. Single-page import never changes navigation automatically; its success screen offers an explicit Add to menu action.

Package images are hash-verified, type-checked, deduplicated by content, and registered as native WordPress Media Library attachments. The importer preserves image dimensions, alt text, captions, and WordPress responsive image sources; it rewrites editable documents, compiled markup, and generated styles to local attachment URLs. Imported pages and revision-backed global elements retain explicit attachment relationships, and referenced attachments cannot be deleted while a current record or recoverable revision still needs them.

The optional account connection is read-only, revocable, and manual-import-only. WordPress uses OAuth-style authorization with PKCE, stores its refresh credential encrypted with WordPress salts, and receives short-lived access tokens. Administrators can browse owned projects, page previews, versions, and modification dates, then deliberately import a new draft, publish a new page, or explicitly replace an earlier copy with a WordPress revision. Disconnecting removes the local credential and leaves every imported page, menu, attachment, and generated file intact.

Pagecraft Builder does not run background synchronization, deployment promotion, webhooks, CMS write-back, or remote release activation.

== Requirements ==

* WordPress 6.6 or newer
* PHP 8.1 or newer
* Single-site WordPress
* HTTPS and pretty permalinks for the completed v1 product
* Pagecraft Theme for v1 frontend support

== Data ownership ==

Import creates an independent WordPress copy. Reimport creates a new page by default. Replacing an existing Pagecraft page must be explicit and revision-backed.

The importer preserves native title, slug, status, author, featured image, and third-party metadata when replacing a Pagecraft-managed page. It refuses to convert an ordinary WordPress page through the low-level import service.

Deactivation and uninstall do not remove imported pages, post content, post metadata, global elements, generated assets, menus, or media.

== License ==

Pagecraft Builder is licensed under the GNU General Public License version 3 or, at your option, any later version.
