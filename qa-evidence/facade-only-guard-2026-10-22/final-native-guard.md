# PHP97 final native guard

Content, rejection and installed-file checks pass; strict option allowlist requires root review.

Read-only capture:133tables,129 unchanged. Existing post616 timestamps and meta11146(document_version) changed;12new revisions644-655 all parent616;318new metadata rows11634-11951. Original content restored. All359old revisions and metadata exact. Menus23,264,265,266,267,300,301,302 and all their metadata byte-exact. Original487 remainsVersion73. Protected snapshots and Pagecraft/global options exact.

Only account1session_tokens meta16 changed; passwords/roles/all other user metadata exact. Installed55Builder,19theme,16importer and128historical files exact; only expected4PHP install delta.

Initial rejection: options-only timestamp changes; posts/postmeta/revisions and snapshot exact. Fresh rejection: all133 INSERT tables and snapshot exact. Neither rejection wrote post/revision/metadata rows.

## Strict option review

Five option names changed. Two Elementor options are timestamp-only. Three more lie outside the task allowlist: cron plus theme-pattern cache and timeout. All have identical timestamp-masked values and autoload. Cron event identities/schedule/interval/arguments remain exact; wp_privacy_delete_old_export_files advances3600seconds. These are reported for root review, not silently accepted.

Failures: none. Full details and hashes: [final-native-guard.json](final-native-guard.json). RawSQL/private snapshots stay outside the repository. No mutation, broad tests or browser action performed.
