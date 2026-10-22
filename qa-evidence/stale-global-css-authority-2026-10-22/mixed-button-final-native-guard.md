# Mixed Button guard closure and Preview98 baseline

Independent SQL readback confirms both original design option rows, including values and autoloads, are byte-exact after root cleanup. The earlier eval-file exit 0 with blank stdout was not credited. Root executed the explicit include route and this independent capture verifies its result. The worker made no database writes.

QA page 616 Version 26 retains its original eight saved Gallery nodes and no QA component definitions. There are 385 revisions. Eight new revisions (662 through 669) and 232 new metadata rows belong only to page 616 or its new revisions. The only changed existing page metadata is its document version. All 377 previous revisions and their metadata, original page 487 Version 73, menus, global settings and protected pages remain exact.

User, password and role rows remain exact. Only account 1 session_tokens metadata row 16 changed. Its current session duration is 7,200 seconds. Four cache or Elementor options have timestamp-only changes. The cron event set, event payloads and version remain exact; only wp_privacy_delete_old_export_files advanced 3,600 seconds, which also reordered its serialized position.

All 31 guard checks pass. Across 133 tables, 129 table insert sets remain exact. The four changed tables contain only the documented QA page, revision, metadata, environmental option and session changes.

Installed Builder (55 files), Theme (19), Importer (16) and all 130 historical files remain exact. The fresh private Preview98 guard contains SQL, snapshots, three verified installed-directory backups, manifests and the preserved original global stylesheet asset. Runtime remains WordPress commit 1207cf10 with Core 3bf5b4b, preview97.

See [exact final guard](mixed-button-final-native-guard.json) and [fresh baseline](preview98-preguard.json). Raw SQL and account data remain outside the repository. Native positive behavior is recorded separately by the root agent. Full customer QA and production readiness remain open.
