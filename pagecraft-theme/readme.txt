=== Pagecraft ===
Contributors: pagecraft
Requires at least: 6.6
Requires PHP: 8.1
Stable tag: 0.1.0
License: GPLv3 or later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

A neutral, accessible WordPress theme for Pagecraft-managed releases and native WordPress content.

== Description ==

The Pagecraft theme supports two request modes:

1. Managed route mode: Pagecraft Connector supplies the active route body. The theme provides the WordPress document lifecycle while allowing the release to own its visual system.
2. Native fallback mode: Existing WordPress pages, posts, archives, search, comments, and 404 responses use an accessible neutral presentation.

The theme remains functional without Pagecraft Connector. It calls connector APIs only after checking that they exist and catches connector failures before falling back to native WordPress templates.

== Connector integration ==

The optional Pagecraft Connector exposes:

* pagecraft_get_active_release(): ?array
* pagecraft_render_route(?string $path = null): ?string
* pagecraft_render_managed_content(?int $post_id = null): string

The theme does not fetch remote content, store credentials, activate releases, or implement Pagecraft synchronization.

== Installation ==

1. Copy this directory to wp-content/themes/pagecraft.
2. Activate Pagecraft under Appearance > Themes.
3. Optionally install and connect Pagecraft Connector.

== Accessibility ==

Native fallbacks include skip links, landmarks, visible keyboard focus, semantic headings, accessible navigation labels, responsive typography, and reduced-motion handling.

== License ==

Pagecraft is licensed under the GNU General Public License version 3 or, at your option, any later version.
