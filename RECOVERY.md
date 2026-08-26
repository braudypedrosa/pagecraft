# Pagecraft database recovery

Pagecraft must not be treated as launch-ready until one encrypted `supabase db dump` workflow
archive has completed and that exact roles/schema/data/history artifact has been restored with
`tools/restore-supabase.sh` into a disposable Supabase project. A workflow file by itself is not
recovery proof, and a logical JSON/MCP row load is supplementary evidence rather than a substitute
for the documented archive restore.

## Configure the daily backup

The `encrypted database backup` GitHub Actions workflow runs daily and can also be started
manually. Configure these repository Actions secrets:

- `SUPABASE_DB_URL`: the percent-encoded Session pooler connection string from Supabase.
- `PAGECRAFT_BACKUP_PASSPHRASE`: a long, unique passphrase stored separately from Supabase and
  GitHub recovery codes.

The workflow creates the roles, schema, data, and `supabase_migrations` history dumps recommended
by Supabase, encrypts the archive with AES-256-CBC/PBKDF2 before upload, and retains the encrypted
GitHub artifact for 30 days. Missing secrets, empty dump files, encryption failure, or upload
failure makes the job fail.

For a local backup with the same format:

```sh
SUPABASE_DB_URL='postgresql://...' \
PAGECRAFT_BACKUP_PASSPHRASE='...' \
bash tools/backup-supabase.sh
```

Do not commit `.backups/`, connection strings, or passphrases.

## Restore drill

1. Create a disposable Supabase project in the same region and enable any non-default
   extensions used by Pagecraft.
2. Download one encrypted workflow artifact and its checksum.
3. Verify the encrypted checksum.
4. Restore only to a fresh disposable project with no Pagecraft tables. The confirmation value
   must include the exact database host shown in that project's connection URL:

```sh
shasum -a 256 -c pagecraft-db-*.tar.gz.enc.sha256
SUPABASE_DB_URL='postgresql://new-disposable-project...' \
PAGECRAFT_BACKUP_PASSPHRASE='...' \
PAGECRAFT_RESTORE_CONFIRM='restore-to:db.example-project.supabase.co' \
bash tools/restore-supabase.sh pagecraft-db-*.tar.gz.enc
```

5. Deploy `supabase/functions/pagecraft-db` to the disposable project with `verify_jwt=false`.
   Configure its database URL secret, generate a new gateway key, and store only that key's
   SHA-256 digest in `gateway_config`. Set the local server's `DATABASE_GATEWAY_URL` and
   `DATABASE_GATEWAY_KEY` to this disposable gateway; never reuse production gateway secrets.
6. Run the server through the gateway and verify owner access, site count, current document
   versions, revision history, CMS records, and asset byte hashes. Run `tools/smoke.mjs` against
   that server so the drill proves the deployed topology, not only direct PostgreSQL access.
7. Record the artifact timestamp, restore duration, verification results, and disposable project
   deletion in the release checklist.

## Interim logical snapshot drill — 26 August 2026

**Status: supplementary pass; the archive-based release gate above remains open.**

- Encrypted artifact: `pagecraft-predeploy-20260825T191047Z.json.enc`
- SHA-256: `9b5439a62ff7b965b912f644fb7f1af77fcebb5577533e43d7834f24f984707b`
- Format/source: `pagecraft-logical-json-v1`, PostgreSQL 17.6, captured
  `2026-08-25T19:10:46Z` from production project `pwgwvicrdbjiecjxiyvl`
- Isolated target: project `qbktkoypoqpecqbozbqg` in `ap-southeast-1`
- Verification completed: `2026-08-25T20:18:42Z`

The encrypted checksum and Keychain-backed decryption passed without writing plaintext to disk.
The four local migrations plus the production default-privilege hardening recreated the eight
Pagecraft tables on fresh PostgreSQL 17. Exact typed comparisons matched every snapshot row:
one site at version 37, one user, one owner membership, zero assets, 34 revisions spanning
versions 4–37, two sessions, one login link, and one gateway configuration row. Foreign-key and
current-revision checks reported zero failures. The target's column, constraint, index, access,
and default-ACL signatures exactly matched production.

The copied gateway digest was replaced with a fresh disposable credential before testing. The
deployed Edge gateway rejected missing and invalid keys with `401`, accepted the disposable key,
returned the restored site/history/owner data, and passed the local Node smoke suite. A synthetic
binary asset completed put/get byte-for-byte/remove testing and the asset count returned to zero.
Supabase advisors reported only the expected informational deny-all-RLS and unused-index notices.
Production data was not modified by the drill. The target was paused after verification because
authenticated dashboard deletion was unavailable in this session; it does not consume an active
Free-project slot.

This drill does **not** prove the scheduled GitHub Actions job, `supabase db dump` output,
roles/schema/data/history SQL completeness, the `psql` path in `tools/restore-supabase.sh`, a
crash-consistent multi-table snapshot, Supabase Auth/Storage recovery, real stored asset bytes,
or RPO/RTO. Complete the archive-based drill above before clearing the recovery release gate.

Repeat the drill at least quarterly and after schema or gateway changes. Rotate the backup
passphrase only after all artifacts encrypted with the old passphrase have expired or been
re-encrypted.

Supabase Free projects do not receive the paid plans' automatic daily database backups. The
official guidance is to run regular `supabase db dump` exports and keep them off-site:
https://supabase.com/docs/guides/platform/backups
