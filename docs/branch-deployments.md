# Branch deployments

| Branch | Environment | URL |
| --- | --- | --- |
| production | Production | https://build.itspagecraft.com |
| development | Staging | https://staging.itspagecraft.com |

Local edits reach an environment only after commit, push, successful tests and deployment. Review finished development work on staging. Production promotion remains deliberate; production does not automatically merge development.

`.github/workflows/deploy.yml` builds and tests the exact pushed commit and uploads a source bundle containing the built editor and released template packages. Environment secrets contain separate restricted SSH deployment keys and pinned host keys. GitHub environment branch policies and the host's forced commands restrict each key to its branch. Application/database credentials remain on the host.

The host receiver at `~/pagecraft-deploy/receive.py` is provisioned separately from app code. Updating its repository copy does not automatically replace that trusted entrypoint. Deployments install dependencies in a new release, prove startup against the configured database, preserve existing template release hashes, switch the release pointer inside the fixed app directory, restart Passenger, and verify the public `/__deployment` commit. A failed public check restores the previous release pointer and restarts the prior version. Releases and protected deployment logs remain on the host for investigation.

Staging deployment is gated by repository variable `STAGING_DEPLOY_ENABLED=true` until its backend and HTTPS are provisioned. Skipped staging deployment is not a successful staging rollout. Both environment jobs must be inspected before claiming completion.

Temporary setup approved by the user on 2026-09-09: staging shares production's Supabase project and database gateway. Accounts and site records are shared, so changes in either environment affect both. `PAGECRAFT_ALLOW_SHARED_DATABASE=1` makes this explicit. Staging uses its own publication directory and signing keys, with `PAGECRAFT_BACKGROUND_WORKERS=0` to avoid draining shared invitation and webhook queues. Deployment preflights also disable these workers. Revisit database isolation before customer launch.

Supabase schema migrations and edge functions are not automatically applied by the Node deployment workflow. Backward-compatible backend updates must be tested and applied to the appropriate project before app code requiring them is promoted. WordPress package verification runs on both branches; merging into production does not itself publish a WordPress plugin release.

## Verification and rollback

Check the GitHub deployment result, then read `/__deployment` over HTTPS and compare `commit` to the intended branch SHA. Verify login, the dashboard, editor loading, and template catalog/import for changes affecting those flows. Metadata alone is not full acceptance testing.

The last successful deployment records its previous release in `~/pagecraft-deploy/<app>-current.json`. An operator with hosting SSH access can restore the `current` symlink inside the fixed application root and restart the corresponding CloudLinux Node application. Do not delete old release directories until rollback retention has been reviewed.

## Phase 0 receiver retention and capacity

The new receiver imports `tools/deploy/release_storage.py`; install both files in
the same private directory. Provision it as `receive-staging.py` and change only
the development key's forced-command path during the staging rollout. Keep the
production key and its existing `receive.py` intact. Back up `authorized_keys`,
verify file checksums and run the receiver/storage tests on the host before this
change. Repository CI does not install the trusted receiver.

All receiver operations hold the target application's deployment lock. The
deployment SSH client sends keepalives while waiting for that lock, including
the initial legacy-archive cleanup. A disconnected job is a failed deployment;
verify its remote state and rerun the intended commit rather than assuming sync.
The
storage helper accepts only `pagecraft-staging` or `pagecraft-app`, rejects
symlinked roots, and never scans sibling release directories. It preserves the
active release, the recorded rollback target, three additional successful releases
and the in-flight candidate. A success marker is written only after public
verification. Because the legacy receiver had no success markers, its first run
conservatively keeps three additional recent legacy candidates; these are not
claimed as verified successful releases.

Older releases are written to private
`~/pagecraft-deploy/release-archives/<app>/<release>.tar.gz` files. A JSON receipt
contains the archive SHA-256 and a complete inventory of bytes, paths, modes and
symlink targets. Both archive and unchanged source are verified before removing
the expanded inactive directory. Corrupt or unverifiable archives stop cleanup.
Verified archives expire after 30 days. Existing legacy archive directories are
not adopted or deleted automatically.

Before unpacking, the receiver checks filesystem free bytes/inodes and reserves
real blocks plus temporary files to exercise the hosting account's quotas.
The budget includes the prior installed dependency tree and headroom. Reservations
are always removed. A failure leaves the current pointer unchanged and prevents
dependency installation. A competing write can still exhaust capacity after the
probe; ordinary candidate isolation and rollback remain necessary.

For an operational dry run, import `ReleaseStorage` from the installed helper,
load the active symlink and previous path from the target's current JSON record,
then call `retain(active, previous, dry_run=True)`. Review every protected/archive
candidate before the first live run. The helper's `restore(release_name)` verifies
receipt and archive, restores bytes/modes/links into an inactive release directory,
and leaves the current pointer untouched. Never extract an unverified archive over
an active release. To roll back, select the verified inactive directory through
the existing symlink/restart workflow and confirm its public `/__deployment` SHA.

Capacity, retention, archive restore and failed-public-check rollback have local
regressions. Host installation, a live retention run and staging acceptance must be
recorded separately; passing these tests alone does not establish deployment.

CloudLinux resolves the application root to locate its Node environment, so that directory must remain physical. Provision `tools/deploy/launcher.cjs` as its `app.cjs`; releases are selected through an internal `current` symlink. The original source remains available for first-deployment rollback.

## Upload recovery

The receiver stops an upload after 120 seconds without incoming bytes and releases
the environment lock. A partial bundle remains an inactive candidate for normal
retention; it cannot be unpacked, installed or made current. SSH keepalives keep
healthy clients connected while another deployment holds the lock.
