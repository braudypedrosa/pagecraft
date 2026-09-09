# Branch deployments

| Branch | Environment | URL |
| --- | --- | --- |
| production | Production | https://build.itspagecraft.com |
| development | Staging | https://staging.itspagecraft.com |

Local edits reach an environment only after commit, push, successful tests and deployment. Review finished development work on staging. Production promotion remains deliberate; production does not automatically merge development.

`.github/workflows/deploy.yml` builds and tests the exact pushed commit and uploads a source bundle containing the built editor and released template packages. Environment secrets contain separate restricted SSH deployment keys and pinned host keys. GitHub environment branch policies and the host's forced commands restrict each key to its branch. Application/database credentials remain on the host.

The host receiver at `~/pagecraft-deploy/receive.py` is provisioned separately from app code. Updating its repository copy does not automatically replace that trusted entrypoint. Deployments install dependencies in a new release, prove startup against the configured database, preserve existing template release hashes, switch the stable app path, restart Passenger, and verify the public `/__deployment` commit. A failed public check restores the previous path and restarts the prior version. Releases and protected deployment logs remain on the host for investigation.

Staging deployment is gated by repository variable `STAGING_DEPLOY_ENABLED=true` until its isolated backend and HTTPS are provisioned. Skipped staging deployment is not a successful staging rollout. Both environment jobs must be inspected before claiming completion.

Staging requires a separate Supabase project and database gateway, independent publication directory and signing keys, and staging-specific authentication redirects. Never point staging at production's database or copy customer accounts/content into staging. Use synthetic test accounts and imports.

Supabase schema migrations and edge functions are not automatically applied by the Node deployment workflow. Backward-compatible backend updates must be tested and applied to the appropriate project before app code requiring them is promoted. WordPress package verification runs on both branches; merging into production does not itself publish a WordPress plugin release.

## Verification and rollback

Check the GitHub deployment result, then read `/__deployment` over HTTPS and compare `commit` to the intended branch SHA. Verify login, the dashboard, editor loading, and template catalog/import for changes affecting those flows. Metadata alone is not full acceptance testing.

The last successful deployment records its previous release in `~/pagecraft-deploy/<app>-current.json`. An operator with hosting SSH access can restore that symlink and restart the corresponding CloudLinux Node application. Do not delete old release directories until rollback retention has been reviewed.
