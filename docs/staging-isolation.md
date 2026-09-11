# Deferred pre-launch database isolation

Status updated 2026-09-12: the user confirmed that both current environments are
pre-launch, contain no real customer data, and should continue using the existing
Supabase project. Do not provision a new staging project. The earlier organization
and cost-confirmation request is superseded. No accounts, sites, records or queues
have been moved or deleted.

Keep the explicit shared-backend setting, disabled staging workers, separate
publication directories/signing configuration and identifiable QA fixtures.
Changes to shared records/schema remain visible to both current deployments.
Preserve compatibility with both builds; this approval is not permission to delete
existing fixtures or promote application changes to production automatically.

The actual customer-facing production environment will receive its own database
before launch. At that point, select and provision its project, configure fresh
authentication and credentials, apply the verified schema, and seed only approved
launch data. Do not automatically migrate test accounts, submissions or jobs.
Verify data/authentication/queue isolation in both directions before launch.

The staging-cutover procedure below is retained as a reference only. Its target
must be revised to the agreed launch topology before execution; it is not an
instruction to create a staging project now and no longer gates Phase 1.

The approach follows [Supabase's separate-environment guidance](https://supabase.com/docs/guides/deployment/managing-environments).
Apply this runbook only to the new staging project. Record its project ref and
deployment commit in the private acceptance report, without credential values.

## Provision and seed

1. Confirm the organization and quoted project cost, create the separate staging
   project, and wait for a healthy database. Never repurpose the production or
   restore-drill project.
2. Inventory repository migrations against the source project's migration ledger.
   Apply the complete ordered schema to the new project, reconcile any drift, and
   deploy the repository's `pagecraft-db` edge function. Provision a distinct
   gateway secret and project keys. Do not copy source queue or authentication rows.
3. Configure authentication for `https://staging.itspagecraft.com`, with the exact
   callback paths used by the app. Project auth/provider/SMTP configuration is
   separate from database migrations. Use fictional acceptance accounts and a
   staging mail sink; keep credentials in private operational storage. Do not send
   fixture invitations to real account addresses.
4. Export only the labeled QA Functional Fixes and other explicitly needed QA
   fixtures through the supported site document/asset interfaces. Keep exports
   private. Import into newly created staging accounts with new site/asset ownership;
   rewrite managed asset references and check every referenced asset exists.
   Do not copy members, credentials, integrations, real submissions, notifications
   or pending jobs. Use identifiable fictional submissions when those are needed.
5. Create new staging publications from these fixtures. Preserve source site IDs,
   documents, publication directories and original assets unchanged in the shared
   environment. Record source-to-fixture mappings privately for acceptance.

## Switch the staging host

Back up the staging configuration privately, then update its auth URL/key and
database gateway URL/key together. Set `PAGECRAFT_STAGING_PROJECT_REF` to the new
20-character project ref and remove `PAGECRAFT_ALLOW_SHARED_DATABASE`. Retain the
separate staging publication directory, signing configuration and editor origin.
Keep workers disabled until fixture queues and the mail sink are verified; enable
them only against the isolated project when a phase requires execution.

`validateStagingEnvironment` runs before database connections. It rejects a
production project, mismatched auth/gateway hosts, an unpinned project, noncanonical
gateway URLs, a second database URL, and production publication/origin settings.
The temporary shared exception requires workers off and cannot coexist with the
new project pin. This guard checks configuration; independent-project data and
authentication tests still establish actual isolation.

Prove candidate startup with the complete isolated configuration before restarting
the staging application. Existing shared-project sessions should no longer grant
access; sign in with a fictional staging account. Do not copy browser session
cookies across projects.

## Acceptance and recovery

- Confirm `/__deployment` is the intended development commit.
- Sign in/out and reset credentials using staging-only test accounts. An account
  existing only in the original project must not automatically exist in staging.
- Create and edit an identifiable staging fixture. Verify through separate reads
  that its record and asset writes exist only in the new project; compare the
  original QA records against their pre-cutover versions.
- Check dashboard, builder, CMS, media, native forms, publication, history and the
  expanded gallery/real-screen matrix. Use 768/1024/1440px plus the 767px editor lock.
- Exercise a fictional queue item twice and verify single processing in staging;
  compare production queue state without draining or modifying it.
- Inspect endpoint permissions from each environment. Capture evidence of rejected
  cross-project access and old-session rejection without retaining secret values.

For application rollback, restore a verified earlier release while retaining the
isolated staging configuration. Keep migrations additive and test compatibility
before applying them. If isolation fails, stop staging writes and workers while
repairing the new project. Do not silently restore the shared backend as a normal
rollback: that would invalidate the phase's isolation exit criterion.

The original isolation exit criterion is deferred by the user's 2026-09-12
decision. Remaining Phase 0 application checks still apply, but project creation
and database cutover do not block feature work in the shared pre-launch setup.
