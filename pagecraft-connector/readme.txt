=== Pagecraft Connector ===
Contributors: pagecraft
Requires at least: 6.6
Requires PHP: 8.1
Stable tag: 0.1.0
License: GPLv3 or later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Synchronizes signed, immutable Pagecraft releases to a WordPress single site.

== Description ==

Pagecraft remains the source of truth for managed pages and published releases.
The connector verifies target-bound release envelopes, stages complete releases,
mirrors managed WordPress records, activates one release atomically, and keeps
the last verified release available when Pagecraft cannot be reached.

The connector supports Pagecraft Theme and Existing Theme profiles. Native
WordPress-owned content is not edited by Pagecraft. Managed pages are read-only
in the block editor; production CMS item fields may be written back to the
Pagecraft draft when that capability is enabled.

== Requirements ==

* WordPress 6.6 or newer
* PHP 8.1 or newer with Sodium and Zip support
* HTTPS and pretty permalinks outside the explicit local test harness
* An administrator account for pairing

== Installation ==

1. Install the signed Pagecraft Connector package.
2. Open Pagecraft in WordPress Admin and start pairing.
3. Authenticate as a Pagecraft project owner and select staging or production.
4. Choose Pagecraft Theme or Existing Theme and resolve every blocking preflight item.
5. Publish from Pagecraft. WordPress pulls, verifies, stages, and activates the release.

== Operational safety ==

Disconnecting or losing access freezes the last active release locally. A local
emergency rollback pauses automatic synchronization until an administrator
explicitly resumes it. Uninstall does not delete managed posts, media, releases,
or form submissions by default.

== Production packaging ==

Source checkouts intentionally contain no production Pagecraft root key and
therefore fail closed. The offline key-provisioning operator must build the ZIP
with `php tools/build-package.php --root-public-key-file=/secure/root-public.b64url`.
The file contains only the base64url raw 32-byte Ed25519 public key. The script
injects it into the package copy, omits development dependencies and tests, and
refuses to publish a ZIP if the root marker remains. The root private key must
remain offline and must never be placed in WordPress, this repository, or the
Pagecraft application runtime.

For an HTTP loopback-only test stack, define
`PAGECRAFT_CONNECTOR_ALLOW_INSECURE_LOOPBACK` and
`PAGECRAFT_CONNECTOR_ALLOW_LOCAL_ROOT_OVERRIDE`, and provide
`PAGECRAFT_CONNECTOR_LOCAL_ROOT_PUBLIC_KEY`. These constants never permit a
non-loopback HTTP host.

== License ==

Pagecraft Connector is licensed under the GNU General Public License version 3
or, at your option, any later version.
