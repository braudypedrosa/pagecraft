# Pagecraft development and deployment

- Work on `development`. Keep unrelated work intact.
- After completing and testing a reviewable update, commit and push it to `development`, wait for the staging deployment, and verify the result at https://staging.itspagecraft.com. Give the user the staging URL for review. Local URLs are for diagnostics only.
- `production` deploys to https://build.itspagecraft.com. Promote approved development changes to production; do not merge every development update automatically into production.
- GitHub Actions deploys only after tests and the demo build pass. Confirm `/__deployment` reports the intended commit before claiming an environment is synced.
- Temporary user-approved setup (2026-09-09): staging and production share the Pagecraft Supabase project, accounts and site records. Edits, deletions, imports and schema changes affect both. Keep publication directories and signing configuration separate; staging background queue workers must remain disabled. Use identifiable test content. Revisit database isolation before customer launch.
- Local uncommitted edits are not deployed. Do not describe them as available on staging.
- Preserve released template versions and their package hashes. Add a new version when published template content changes.
