# Pagecraft development and deployment

- Work on `development`. Keep unrelated work intact.
- After completing and testing a reviewable update, commit and push it to `development`, wait for the staging deployment, and verify the result at https://staging.itspagecraft.com. Give the user the staging URL for review. Local URLs are for diagnostics only.
- `production` deploys to https://build.itspagecraft.com. Promote approved development changes to production; do not merge every development update automatically into production.
- GitHub Actions deploys only after tests and the demo build pass. Confirm `/__deployment` reports the intended commit before claiming an environment is synced.
- Staging must use a separate Supabase project, publication directory, signing configuration and test accounts. Never reuse the production database or copy customer data into staging.
- Local uncommitted edits are not deployed. Do not describe them as available on staging.
- Preserve released template versions and their package hashes. Add a new version when published template content changes.
