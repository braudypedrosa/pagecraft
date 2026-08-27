=== Pagecraft ===
Contributors: pagecraft
Requires at least: 6.6
Requires PHP: 8.1
Stable tag: 0.2.0
License: GPLv3 or later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

The frontend theme for native WordPress pages created with Pagecraft Builder.

== Description ==

The Pagecraft theme renders ordinary WordPress content and Pagecraft-managed native pages through the standard WordPress template hierarchy. Pagecraft Builder stores compiled fallback HTML in each page's `post_content`; the theme does not fetch remote releases or depend on background synchronization.

Revision-backed Pagecraft header and footer records render across managed and ordinary WordPress routes. The theme loads only the content-hashed global, current-page, and trusted runtime assets referenced by the active records from `wp-content/uploads/pagecraft`. Those files survive theme and plugin updates, and the theme can keep rendering them while Pagecraft Builder is deactivated.

The theme registers Primary, Footer, and Utility navigation locations. Imported Pagecraft navigation is converted to native WordPress menus and assigned to these locations by Pagecraft Builder. The theme renders those native records inside the Pagecraft navigation component so WordPress owns destinations and hierarchy while Pagecraft retains responsive presentation.

== Installation ==

1. Copy this directory to wp-content/themes/pagecraft.
2. Activate Pagecraft under Appearance > Themes.
3. Install and activate Pagecraft Builder.

== Accessibility ==

Native fallbacks include skip links, landmarks, visible keyboard focus, semantic headings, accessible navigation labels, responsive typography, and reduced-motion handling.

== License ==

Pagecraft is licensed under the GNU General Public License version 3 or, at your option, any later version.
