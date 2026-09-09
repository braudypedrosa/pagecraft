# Cloud Uplisting property integration

Owners open **Site overview → Integrations → Add integration → Uplisting**, choose the platform by name and icon, enter an API key, connect, choose properties and sync. Connected apps appear in a table with status, content type, last sync and a Manage action. The first release reads property information only using the regular account API. No availability, prices, reservations, webhooks, scheduled worker or WordPress connector is included. Sync is manual and saves a draft; publishing is an explicit later action.

## Provider contract

Official references: [Uplisting API and webhooks](https://support.uplisting.io/en/article/api-webhooks-vzlowi/) and [Uplisting API collection](https://documenter.getpostman.com/view/1320372/SWTBfdW6).

`GET https://connect.uplisting.io/properties` uses `Authorization: Basic <base64(API key)>`. JSON:API included resources resolve cover photo (first by order), city, country and amenities. The importer allowlists public property fields; exact street addresses, access instructions, guests, fees and financial information are omitted. Cover photos from Uplisting’s documented cdn.filestackcontent.com host and verified djts5lg061pqs.cloudfront.net distribution are imported into the Pagecraft media library, optimized, and charged to the owner’s media quota. Other hosts fail closed pending verified provider support. Imports accept up to 25 selected properties per operation. Successfully uploaded media can remain in the library if a later document save fails; retry reuses identical image bytes. This version imports one cover photo per property, not a full gallery.

Requests have a 30-second deadline, a 12 MiB response cap, a 1,000-property cap and at most 10 pages. Redirects and pagination outside the fixed HTTPS properties endpoint are rejected. Provider error bodies are never logged or returned. Owner operations are throttled; the provider's 429 response has an actionable retry message.

## CMS behavior

A connection gets its own collection ID. Stable source IDs map to stable CMS item IDs; item slugs are set only on initial import. Sync overwrites imported fields while preserving added editorial fields, item URLs, draft state, pages and layouts. Deleting or unchecking a source property does not delete previously imported content. Changing the types of imported fields blocks sync until restored. Removed imported fields are re-created. Disconnect retains the CMS collection; reconnecting creates a new collection to avoid mixing accounts. The current CMS cannot enforce per-field source ownership; the integration screen explains which values will be refreshed.

Sync uses the document version shown when properties were loaded plus the store's compare-and-swap save. A conflicting edit rejects the whole document save. An open editor with unsaved changes still has to resolve its normal version conflict; save before opening Integrations. No secret is put into the site document, revisions, published HTML or portable package. Site deletion removes this environment's connection under the same operation lock.

## Credential operations

The Node host stores AES-256-GCM encrypted connection records in a **private sibling** of `PAGECRAFT_PUBLICATION_ROOT`, with the suffix `-integrations`. This directory is outside the served publications and deployment releases. Staging and production therefore have separate connections and keys even while their CMS database is shared. Back up both the encrypted records and `encryption.key` using restricted host backups. Files use mode 0600 and the directory 0700. This protects against accidental export and disclosure, not compromise of the application host itself. A future multi-host deployment requires a shared transactional secret store; this implementation targets the existing single-host Passenger deployment.

An exclusive per-site lock prevents overlapping connects, syncs, disconnects and deletion across server processes. Interrupted operations leave a fail-closed `.lock` file. To recover, stop the affected app, confirm no operation is still running, remove only that site's lock, then restart. Filenames are SHA-256 hashes of the site ID. Do not delete the encryption key to troubleshoot a connection. Revoking a provider key belongs in Uplisting; disconnecting Pagecraft removes only its stored copy. Site deletion in another environment cannot erase this environment's private files; purge orphan connection files during account/data-retention operations while the database remains shared.

## Verification

Automated fixtures cover JSON:API mapping, repeat imports, preservation of editorial data/URLs/draft state, unsupported/foreign pagination, provider errors, ciphertext isolation and permissions, concurrent key initialization, owner/CSRF/WordPress-token gates, stale-version rejection, draft-only sync and disconnect retention. A live account test remains necessary to verify that account's enabled property endpoint and actual data. Use identifiable QA content because staging currently shares site records with production.
