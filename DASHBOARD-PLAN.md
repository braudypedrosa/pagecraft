# Pagecraft Dashboard Plan

## Purpose

The Pagecraft dashboard is the operational home for creating, finding, and managing sites.
It should answer four questions immediately:

1. What sites do I have?
2. Which sites have unpublished changes or another state that needs attention?
3. How do I continue editing or view a site?
4. How do I create another site?

The initial dashboard is not an analytics product. Sites and their current state are the
primary working surface.

## Product direction

### Visual thesis

A calm digital workshop: warm neutral surfaces, restrained Pagecraft green, strong type,
minimal chrome, and enough density to scan several projects without feeling crowded.

### Content plan

1. Sites workspace
2. Site creation
3. Site management
4. Account and plan context
5. Empty, restricted, and failure states

### Interaction thesis

- Search, sorting, and ownership filters update the workspace immediately.
- Creating a site is a short progressive flow that opens the builder when complete.
- Status changes and destructive actions provide explicit feedback and confirmation.

## Design principles

- Lead with the sites themselves rather than summary cards or vanity metrics.
- Keep the primary navigation small until additional destinations have real content.
- Use cards only when the whole site preview is an interactive object.
- Prefer plain sections, lists, dividers, and drawers for supporting management surfaces.
- Use one accent color for primary actions and important state.
- Write utility copy that explains status, scope, and the next action.
- Keep export and ownership visible; portability is a Pagecraft product promise.
- Do not require a custom domain before a site can be created or shared.

## Current foundation

The `bp/accounts-dashboard` branch already provides the beginning of the dashboard:

- Account registration, confirmation, sign-in, Google sign-in, password reset, and sign-out
- Sites returned according to the signed-in user's memberships
- Site preview cards
- Search and sorting
- Owned and shared-site filtering
- Blank-site creation
- Three-owned-site limit handling
- Published and draft-change states
- Owner and content-editor roles
- Open Builder and View Site actions

This foundation should be treated as Dashboard 1A rather than replaced with a separate
dashboard architecture.

## Dashboard 1A: sites workspace

### Features

- Show all sites available to the signed-in user.
- Display a live preview or a clear preview-unavailable fallback.
- Display site name, current public address, and last edited time.
- Display `Published` or `Draft changes`.
- Display the user's `Owner` or `Content` role.
- Search sites by name.
- Sort sites by last edited or name.
- Filter between `All sites`, `Owned`, and `Shared`.
- Create a blank site from its name.
- Show owned-site allowance, such as `2 of 3 sites used`.
- Open the builder.
- Open the public site in a new tab.
- Provide a compact site-actions menu for management routes as they become available.

### Site card content

Each site card contains:

- Site preview
- Site name
- Pagecraft URL or custom domain
- Last edited time
- Publishing state
- Membership role
- Open Builder
- View Site
- More actions

### Creation flow

The initial creation flow asks only for:

- Site name
- Optional editable slug

Pagecraft generates a valid unique slug, creates the blank document, and opens the builder.
Custom domains are configured after creation.

### Dashboard 1A exit criteria

- A new account can create its first site without administrator intervention.
- A returning user can find and open a site quickly.
- Collaborator sites do not count against the owner's site allowance.
- Published and draft-change states are accurate.
- Search, sorting, and ownership filters work at desktop and mobile widths.
- Empty, limit-reached, failed-preview, and no-result states have useful next actions.
- Keyboard navigation and visible focus states cover every dashboard action.

## Dashboard 1B: site management

Each site receives a management surface outside the builder. It may use a dedicated route or
a spacious drawer, but it must preserve the Sites workspace as the primary dashboard.

### Overview

- Site preview
- Site name and public URL
- Published or draft-change state
- Last edited and last published dates
- Open Builder
- View Site
- Publish changes
- Export site
- Compact export-review summary when unresolved findings exist

### Domain

- Current Pagecraft URL
- Custom-domain field
- DNS instructions
- Domain-verification state
- SSL state
- Retry verification
- Change Pagecraft slug
- Clear warning before an address change breaks existing links

### People

- List owners and content editors
- Invite or grant access by email
- Choose `Owner` or `Content editor`
- Change a member's role
- Remove access
- Prevent removal or demotion of the final owner
- Explain the content editor's permissions in plain language

### Versions

- Version number
- Created date
- Author
- Current draft version
- Current published version
- Preview a previous version
- Restore a previous version
- Require confirmation before restore
- Restore by creating a new version rather than deleting later history

### Export and WordPress

- Download static site ZIP
- Download the editable Pagecraft project
- Export `.pagecraft-site.zip`
- Export individual `.pagecraft-page.zip` packages
- Show WordPress handoff instructions
- Record package type and export date where practical
- State clearly that WordPress receives an independent, WordPress-owned copy
- Do not imply background synchronization or automatic merging

### Settings

- Rename site
- Change slug
- Show site identifier for support
- Archive site
- Delete site with typed confirmation
- Transfer ownership later, after the ownership and acceptance flow is specified

### Dashboard 1B exit criteria

- An owner can manage the domain without using the API directly.
- An owner can add and remove collaborators safely.
- An owner can inspect and restore version history.
- An owner can export the site and complete a WordPress handoff.
- Restricted actions are absent or disabled for content editors.
- Every destructive action names its target and requires confirmation.
- Site management remains usable at common desktop, tablet, and mobile widths.

## Account surface

The first account menu contains:

- Name
- Email address
- Change password
- Google sign-in connection status
- Current plan or account status
- Owned-site allowance
- Help and documentation
- Privacy Policy and Terms of Service
- Sign out

Invoices, payment methods, billing history, and cancellation controls are added when paid
subscriptions are active. Empty billing navigation should not ship before then.

## Required states

The dashboard must handle:

- No sites yet
- No shared sites
- Search with no matches
- Owned-site limit reached
- Content editor with no site-creation permission
- Site with unpublished changes
- Domain awaiting verification
- Domain verification failure
- Preview unavailable
- Version conflict
- Export or WordPress-package failure
- Restricted or expired account

Each state provides one relevant next action and avoids generic error copy.

## Later creation options

After blank-site creation is reliable, add:

- Start from a Pagecraft template
- Duplicate an existing site
- Import a Pagecraft project
- Import a portable Pagecraft site package

These options belong in one creation flow rather than separate permanent dashboard sections.

## Deferred premium dashboard features

The following are intentionally outside the initial dashboard:

- Traffic and conversion analytics
- Form-submission analytics
- Review comments and approval workflows
- Activity feeds and audit logs
- Shared agency libraries
- Cross-site component updates
- White-label client portals
- Team workspaces and granular custom roles
- AI credits and generation history
- Advanced billing reports
- Global notification center

They should be introduced only when their underlying product capabilities exist.

## Recommended delivery order

1. Finish and verify the current Sites workspace.
2. Add the site Overview and compact site-actions menu.
3. Surface domain management.
4. Surface collaborators and permission explanations.
5. Surface version history and restore.
6. Add export and native WordPress handoff management.
7. Add account and paid-plan controls when billing is ready.
8. Begin premium collaboration and agency features only after the initial management journey is complete.

## Initial release boundary

The initial dashboard is complete when a user can sign in, create a site, find it later,
understand its state, open the builder, view the public result, manage its domain and people,
recover a previous version, and export or hand it off to WordPress without using an internal
API or asking an administrator to perform routine work.

## Phased development tracker

This tracker turns the product plan into independently testable releases. Complete and verify
one phase before starting the next; do not expose navigation for a capability that has no usable
surface behind it.

### Phase 0: account and dashboard foundation — Complete

- Verified email/password and Google authentication
- Membership-scoped site listing
- Site cards, live preview, search, sorting, publishing state, and role
- Blank-site creation with the three-owned-site limit
- Builder and public-site actions

### Phase 1: Sites workspace completeness — Complete

- Show each site's public address
- Filter All sites, Owned, and Shared without navigating away
- Show the owned-site allowance independently of collaborator sites
- Provide useful search, owned, and shared empty states
- Verify desktop, mobile, keyboard, and preserved filter/search state

Exit gate: a returning user can identify, filter, and open every visible site without a page
reload, and understands how much owned-site capacity remains.

Verified on August 28, 2026 with desktop and mobile browser checks, the authenticated production
dashboard, TypeScript validation, and the complete Pagecraft test suite.

### Phase 2: creation and workspace resilience — Complete

- Add the optional editable slug to the creation flow
- Keep the short creation flow progressive and open the builder after success
- Add preview-unavailable fallback behavior
- Add inline creation errors and duplicate/invalid-slug recovery
- Complete limit-reached and restricted-creation states
- Add the compact site-actions menu with only available actions

Exit gate: first-site creation and all Dashboard 1A failure states recover without exposing raw
API responses or leaving the workspace.

Verified on August 28, 2026 with invalid and duplicate-slug contract tests, desktop and mobile
built-in-browser checks, TypeScript validation, and the complete Pagecraft test suite. The
restricted states use the real profile-missing and creation-unavailable contracts; no fictional
account-status flag was introduced.

### Phase 3: site Overview and management shell — Planned

- Add the owner-aware management route and compact Overview
- Show public and publishing state, last edit and publish dates, builder/view/publish/export actions
- Establish management navigation without displacing the Sites workspace

### Phase 4: domains and addresses — Planned

- Pagecraft slug management, custom domain setup, DNS guidance, verification, SSL, and retries
- Explicit link-breakage warnings before address changes

### Phase 5: people and permissions — Planned

- Member list, invitations, role changes, removals, final-owner protection, and permission copy

### Phase 6: versions and recovery — Planned

- Version list, authorship, draft/published markers, preview, and restore-as-new-version flow

### Phase 7: export and WordPress handoff — Planned

- Static, editable, site-package, and page-package exports
- WordPress handoff guidance and explicit independent-copy ownership language

### Phase 8: account and plan surface — Planned

- Profile, password, Google connection, account status, allowance, help, legal links, and sign out
- Billing controls remain hidden until paid subscriptions are active

### Later phases — Deferred

Templates, duplication, imports, premium collaboration, agency features, analytics, and billing
reporting remain behind the initial management journey and their underlying product capabilities.
