# Connected Mode Retirement Inventory

## Status

Connected mode is retired from the active WordPress product. Its complete implementation, tests, packages, and QA evidence remain recoverable on `bp/connected-v1-checkpoint` at commit `f99bda5`.

The approved replacement is documented in `WORDPRESS-NATIVE-V1.md`: import is a one-way ownership handoff, WordPress owns the imported copy, and no background synchronization or conflict merge runs.

## Classification

### Retain in active use

| Area | Destination | Reason |
| --- | --- | --- |
| Versioned Pagecraft document model and migrations | Shared runtime, Issue #2 | Web and WordPress must edit the same canonical format. |
| Core component registry, compiler, renderer, and responsive behavior | Shared runtime, Issue #2 | Exact host parity is the central product requirement. |
| Pagecraft Theme fallback templates and menu locations | `wordpress/pagecraft-theme`, Issues #6 and #8 | Native WordPress content and menus remain WordPress-owned. |
| PHP 8.1 lint and deterministic archive testing | `wordpress/tests`, Issue #11 | These are valid release gates independent of Connected mode. |
| Production Pagecraft hosting, Supabase gateway, backups, and recovery | Existing server/runtime | WordPress retirement must not change the live web builder. |

### Adapt for native handoff

| Connected implementation | Native destination | Adaptation |
| --- | --- | --- |
| `Autoload` and `Capabilities` | `wordpress/pagecraft-builder` | Use the Builder namespace and local editing/import capabilities. |
| `CanonicalJson` | Package compiler/importer, Issue #3 | Canonicalize manifests and documents without target envelopes. |
| Safe archive checks in `Stager` | Package importer, Issue #3 | Retain traversal, symlink, size, type, count, and hash defenses. |
| `Mapper` identity concepts | Native page/menu/media import, Issues #5, #8, #9 | Map source IDs to local WordPress IDs without release candidates. |
| `ManagedPages` | Native Pages integration, Issue #7 | Imported pages become locally editable Pagecraft pages, not locked mirrors. |
| `Renderer` | Native page rendering, Issues #2 and #5 | Compile into `post_content` plus versioned CSS/runtime files. |
| `HttpClient` authorization primitives | Manual cloud import, Issue #10 | Keep only revocable account authorization and explicit page/package pulls. |
| `Preflight` validation patterns | Package/import validation, Issues #3 and #11 | Check compatibility and storage without staging/production profiles. |
| `Updater` | Future private Builder/Theme updates | Keep separate from content synchronization and defer until release packaging. |
| `WordPressContentPicker` | Manual cloud page browser, Issue #10 | Browse source pages for explicit import only. |

### Archived and removed from the active WordPress package

The checkpoint branch remains the source for all of the following:

- Connection target binding, staging/production profiles, pairing confirmation, and installation cloning protection.
- Signed deployment envelopes, release key rotation, root trust, release promotion, acknowledgements, and webhooks.
- `Sync`, deployment cron jobs, emergency release rollback, release retention, release activation pointers, and target sequences.
- Release repository tables, mirrored route ownership, staging candidates, target-local release mapping, and active-release rendering.
- CMS write-back, content-index export, typed CMS queues, staging read-only behavior, and production draft synchronization.
- Connected forms storage, script approval workflow, SEO adapter matrix, Connected Site Health checks, and Connected WP-CLI commands.
- Existing-theme deployment profile and the Connected Docker staging/production matrix.

These systems solve remote deployment and shared ownership problems that no longer exist in native handoff v1.

## Server and database retirement boundary

This issue does not remove the live Pagecraft server, Supabase gateway, or applied database migrations. Connected endpoints, stores, and tables are dormant legacy code after the WordPress connector is retired. They remain temporarily to avoid changing production while the new package export and manual account import contracts are built.

Their bounded removal sequence is:

1. Define and test the new package formats in Issue #3.
2. Add explicit cloud package/page export endpoints used by Issue #10.
3. Confirm no active client calls Connected release, deployment, acknowledgement, CMS write-back, or webhook endpoints.
4. Remove legacy server routes and stores while retaining database migration history.
5. Leave applied legacy tables dormant until a separately reviewed cleanup migration can prove they contain no required data.

## Active WordPress package boundary

The active package is `wordpress/pagecraft-builder`. It starts with only compatibility checks, local capabilities, a shared-runtime boot point, and a managed-page ownership helper. Import, editing, menus, media, globals, and cloud browsing are added through their scoped v1 issues.

The old `wordpress/pagecraft-connector` package, Connected Docker fixtures, and Connected WordPress QA scripts are not shipped or run on the active branch.

## Safety contract

- No production deployment is part of this retirement.
- No applied Supabase migration is reversed or deleted from production.
- Existing WordPress installations of the prototype are test-only; the old connector is not upgraded in place to the new Builder.
- The Pagecraft Builder uses a new plugin slug and namespace to prevent an accidental Connected-to-native runtime migration.
- Generated dependencies and package archives remain outside Git history.
