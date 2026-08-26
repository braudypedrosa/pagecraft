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

Version 0.2.0 establishes the native Builder package, compatibility boundary, local capabilities, and managed-page ownership marker. Package import, the embedded editor, native menus, media, global elements, and optional manual cloud import are added through the tracked WordPress v1 milestone.

Pagecraft Builder does not run background synchronization, deployment promotion, webhooks, CMS write-back, or remote release activation.

== Requirements ==

* WordPress 6.6 or newer
* PHP 8.1 or newer
* Single-site WordPress
* HTTPS and pretty permalinks for the completed v1 product
* Pagecraft Theme for v1 frontend support

== Data ownership ==

Import creates an independent WordPress copy. Reimport creates a new page by default. Replacing an existing Pagecraft page must be explicit and revision-backed.

Deactivation and uninstall do not remove imported pages, post content, post metadata, menus, or media.

== License ==

Pagecraft Builder is licensed under the GNU General Public License version 3 or, at your option, any later version.
