# Pagecraft phased development roadmap

Approved implementation scope: build → review → publish → maintain. Each phase is
a separately tested staging release. Production promotion and WordPress releases
remain separate. This file records implementation status, not a claim that planned
features are available.

## Confirmed product decisions

- Invited, authenticated reviewers; approval belongs to an immutable snapshot.
- In-house aggregate analytics; no persistent visitor/session identifiers, unique
  visitor counts or funnels. No third-party analytics dependency.
- MCP assistants prepare proposals; a permitted user reviews and applies them in
  the editor. Existing read-only credentials gain no new authority automatically.
- Shared compact UI, 6px/8px control padding, existing semantic densities, neutral
  table resting states, and a 768px minimum editor viewport.
- Updated 2026-09-12: both current environments are pre-launch and may keep the
  existing shared Supabase project. No additional project is required now. The
  actual customer-facing production launch will use its own database.
- Keep publication directories and signing configuration separate, use labeled QA
  records, and keep staging background workers disabled. Schema changes affect
  both current environments and must remain compatible with both deployed builds.

## Delivery tracker

| Phase | Deliverables | State |
| --- | --- | --- |
| 0 | Verified release retention and quota preflight; expanded gallery/real-screen checks; approved shared pre-launch backend | Foundation deployed; remaining acceptance in progress |
| 1 | Shared media browser; search/sort/usage filters/tags; usage details; bulk unused deletion; version-checked Replace everywhere with retained original bytes | Not started |
| 2 | Draft/publication differences by page/CMS/shared assets and styles; immutable preview snapshots; comparison and historical restore as a new draft | Not started |
| 3 | Reviewer role; assigned private previews; anchored comments; request changes/approval/cancellation; in-app and email notifications | Not started |
| 4 | Validated CSV mapping/create-update preview; atomic import and Undo; bulk draft/include actions; saved views; idempotent snapshot scheduling | Not started |
| 5 | Personal/shared read-only libraries; immutable versions and dependencies; locally owned imports; explicit conflict-aware upgrades | Not started |
| 6 | Owner-controlled aggregate analytics; page/referrer/device/action/form totals; comparisons/CSV; short-lived deduplication and bounded ingestion | Not started |
| 7 | Explicit proposal scope; bounded native edits; affected-page preview; version checks; atomic apply and Undo; no publish/code/permission actions | Not started |
| 8 | Shared-layout locale content/CMS/metadata/paths; translation status; private locales; language navigation/canonical/alternate/sitemap output | Not started |

## Phase contracts

- **Media:** upload replacement bytes as a new asset, inspect supported references,
  then commit all replacements in one document version/Undo transaction. Old
  revisions and publications keep their bytes. Opaque custom-code URLs are
  unmanaged. Used assets cannot be bulk-deleted.
- **Publication/review:** whole-site publication uses the exact reviewed snapshot.
  Later edits require a new snapshot. Restoration changes the draft, not the live
  site. Reviewers cannot edit, manage media, inspect submissions or publish.
- **CMS/scheduling:** CSV IDs match existing entries; unmatched rows create items.
  Invalid imports make no changes. Schedules target exact snapshots and pause for
  review if a newer publication supersedes their baseline.
- **Libraries:** recipients import, owners modify; upgrades never silently change
  other sites. Keep local overrides and require resolution of definition conflicts.
- **Analytics:** hourly aggregates for 90 days, daily aggregates for 13 months;
  exclude IPs, raw user agents, query strings and form values. Count accepted native
  forms on the server, isolate QA traffic and exclude private preview/editor routes.
- **MCP:** permit text, existing image references, exposed component properties and
  insertion of existing components. Reject stale proposals. Apply through native
  validated commands in one Undo transaction after explicit user review.
- **Locales:** default URLs stay stable; secondary locales use locale prefixes.
  Detect collisions, publish only enabled locales, flag default-language fallbacks.

## Acceptance and release

Use development, preserve unrelated work, run focused regressions plus the required
suite/demo and applicable deployment tests, then commit/push. Verify deployment
success and `/__deployment` before built-in-browser staging acceptance. Check 768,
1024 and 1440px editor viewports and the 767px lock; published output gets phone
checks when affected. Verify permissions, concurrency, error recovery, Undo and
reload persistence as well as appearance. Private QA evidence must not enter public
assets. Additive schema and host-capability changes require compatibility coverage.

The user explicitly deferred database isolation on 2026-09-12. Organization/cost
confirmation and a new staging project are no longer blockers. Complete the
remaining Phase 0 acceptance against labeled fixtures in the existing project.
Feature development may use that project; new background workflows need scoped,
controlled acceptance without enabling the staging queue consumer globally.
Independent customer-facing production data is a pre-launch requirement, tracked
in [`staging-isolation.md`](staging-isolation.md), not a Phase 1 prerequisite.
