# Pagecraft WordPress 0.2.0 release candidate

This is the first native WordPress handoff candidate. It is not a synchronization connector: importing creates an independent WordPress-owned copy.

## Included

- Pagecraft Theme and the top-level Pagecraft Builder plugin.
- Native WordPress pages with revision-backed Pagecraft documents and compiled fallback markup.
- Native menus, Media Library attachments, local generated CSS/runtime files, and global header/footer records.
- Full-screen Edit with Pagecraft workflow inside WordPress Admin.
- Offline page-package upload and optional revocable, manual-only Pagecraft Cloud import.
- Deterministic archives, manifest, release notes, and SHA-256 checksums.

## Requirements

- WordPress 6.6 or newer, single-site.
- PHP 8.1 or newer.
- HTTPS and pretty permalinks.
- Pagecraft Theme 0.2.0 and Pagecraft Builder 0.2.0 installed together.

## Install and upgrade

Install and activate `pagecraft-theme-0.2.0.zip`, then install and activate `pagecraft-builder-0.2.0.zip`. Back up WordPress before replacing an earlier test build. Imported content, media, menus, revisions, and generated files are retained when the Builder is deactivated or uninstalled.

## Known v1 boundaries

- Pagecraft Theme only; existing-theme conversion is deferred.
- No multisite, Gutenberg conversion, two-way sync, background deployment, or cloud CMS write-back.
- Cloud CMS bindings and unsupported executable custom code fail import instead of silently degrading.
- Cloud import is administrator-triggered and creates a copy; later imports default to new pages unless replacement is explicitly selected.

## Release gate still pending

The hosted WordPress desktop/mobile acceptance record in `MANUAL-ACCEPTANCE.md` must be completed before publishing this candidate as a GitHub Release.
