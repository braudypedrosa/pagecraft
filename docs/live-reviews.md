# Live site reviews

Live reviews use `/review/:token`. Owners create private reviewer, public guest,
or private developer links from Sites → Reviews. Each active link for a site
opens the same page/device-scoped conversation. The old Phase 3 immutable
snapshot approvals remain in the snapshot archive.

## Access

- Public links require a signed-in account or a nonempty guest name. Guest identity
  uses an opaque HttpOnly cookie; only its digest is persisted, with a 30-day expiry.
- Private reviewer links require an invited email, authenticated through the
  existing Pagecraft account flow, and a current site membership.
- Developer invitations use the same account flow and grant reviewer membership
  when the recipient has no existing role. Existing roles are preserved. The site
  therefore appears under Shared. Developer permission to resolve/reopen feedback
  is stored separately and does not confer ownership, publish, or editing access.
- Only owners can create/revoke links and invite/remove review participants.
  Revoking a link denies subsequent reads and writes through it. Removing review
  access preserves any separate site membership; public-link guest access remains
  available while a public link is active.
- Existing registered users receive an in-app invitation notice and email when
  SMTP is configured. New-account invitations use the existing durable invitation
  outbox and authenticated return path. Staging background workers stay disabled.

## Pins and previews

Each pin stores page path, device (1440px desktop, 768px tablet, 390px mobile),
element ID and offsets, plus page coordinates for fallback if the element disappears.
Replies and done/reopen state are shared across links. Reviewers can comment and
reply; owners and invited developers can resolve and reopen.

Previews compile the latest saved document with the existing renderer, including
multi-page/CMS output. Private assets are inlined into the sandboxed frame. The
frame has an opaque origin; the parent validates message source and per-load
channel and handles navigation only to known rendered pages. Review mode prevents
form submissions. External links do not navigate out of the review.

The workspace polls every 15 seconds for comments and saved versions. New site
versions load automatically unless a comment/reply is being composed; a refresh
control then lets the reviewer load the update without losing their draft. Pins
and threads remain stored across saved versions.

## Storage and rollout

Live-review metadata resides in `.live-reviews/reviews.json` under the environment's
persistent publication root, using serialized, atomic file replacement, following
the existing Phase 3 file-store deployment model. Staging and production publication
roots remain distinct; no schema migration or template-version changes are required.
This store is designed for the current single application process. Multi-process
or multi-host scaling requires a transactional shared store first.

Regression tests cover identity/access boundaries, developer permissions, guest
restrictions, device separation, live versions, invitation membership, revocation,
invalid inputs, CSRF, restart persistence, and concurrent writes within a process.
Browser acceptance uses the built-in browser and labelled QA content.

## Review workspace overhaul (local candidate)

The workspace uses Pagecraft's ink header, original logo, Craft Green actions and shared
control tokens. A left comments panel shows a single page dropdown (first page selected by default) and
a flat numbered list filtered by page, device and Open/Resolved/All. Clicking an item
scrolls to its annotation and opens the conversation.
Selecting feedback opens a right conversation inspector; sharing opens
in a dialog. On narrow screens, comments follow the preview and pin selection reveals the
relevant thread.

Annotation has Element and Section targets. Hover outlines the target; clicking locks its
anchor while composing. The selected thread highlights the target again. Builder IDs remain
preferred; inner elements without IDs get deterministic preview-only structural IDs. These
fallback IDs can change when the site's structure changes, so coordinate fallback remains
available. The bridge accepts only parent messages with the matching preview channel.

Authorized owner/content members can open feedback in the editor. The destination selects
the page and matching exported node ID without changing document content. Preview-only
anchors or removed elements fall back to the page. Developer review access alone does not
grant editing rights.

The review workspace and review hub use the same `cloudHeader` renderer and
`CLOUD_HEADER_CSS` as the dashboard/site-management screens. Header corrections are
made locally in that shared module; deploying to staging does not change styling.
