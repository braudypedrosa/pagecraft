# Native CMS schema-cleanup slice108, active

## Current state

Cloud staging serves functional commit9595855d62bc83302c19d608a16b402c450a0117. Full QA remains open. The separate107 source fixes and their Cloud plus WordPress102 acceptance are complete and recorded, but their post-deploy evidence is not yet committed. Main generated working artifacts remain protected and must never be rebuilt in place.

The active Cloud QA project is c11494e8-3ae5-4be0-b707-e937278a710a, browser tab34. Baseline is native History1278. Its full project JSON is byte-identical to baseline1238, SHA2560826a13f998d879b0fe66028f1b2e9fd7f5855e3cdf91c47c8bdd5fe98acd9b7. Private original is /private/tmp/pagecraft-cms106-baseline.1xw8jv9p/project-before.json.

The native exported CMS107 fixture was reimported using the builder's own Import project JSON control. It has five entries and six fields in QA mixed conditions107. Root selected its Collection List, set two items per page and Category is not Accessibility, then visited page2, showing Epsilon. In CMS Edit collection, root deleted Category and saved. The query correctly becomes Every item, but preview stays on page2 with Gamma/Delta and three pages. Expected first page is Alpha/Beta.

A second confirmed issue is the delete-field warning. It lists QA Modules / Image / Authored fallback from another collection because both collections use the local field ID `field`. The actual schema cleanup preserves this unrelated binding. Native full-project export proves all eight nonfixture pages remain exact. This is a false warning, not confirmed data loss.

## Evidence and preservation

Safe records and screenshots are in this directory. Raw fixture and after-deletion project JSON remain private in /private/tmp/pagecraft-cms106-baseline.1xw8jv9p/. Current source after deletion is project-after-schema108.json. Original reusable native fixture is project-with-cms107-fixture.json. The current staging draft is deliberately still the schema test, with Category removed. Restore History1278 only after fixing and retesting, then native-export and require complete byte equality to the original backup.

Root's worker tabs_overflow_fix is preparing an isolated108 candidate from exact9595855. Scope is query-change pagination reset during collectionsReplace cleanup and collection-scoped field-reference warning. Entry-data edits should not receive a blanket reset without a specified contract. No production release is authorized. Root owns integration and native proof.

WordPress102 is installed and clean. Canonical checkout /private/tmp/pagecraft-wp-form-runtime.UQrMHS is committed and pushed c1d2c7bfd17444591454f34cd5b98b3a4f4ff6a0. CI39864323014 passed. Native final page616 is Version45 with418 revisions. Original eight nodes and preview98 compiled artifacts are exact. Postguard29 checks passed. Only two new revisions701/702 belong to the authorized Gap24-to25 save and native History43 restore. Temporary text input attempts were blocked by session expiry and did not change any saved text.

The existing QA account pagecraftqa was routinely refreshed for two hours; expiry1792715565. Three cookie writes succeeded, the private cookie JSON was deleted, and secret bindings were nulled. A stale WordPress login overlay was dismissed after renewal. No passwords or roles changed. Local QA services are running after root started the existing Local site. No other Local sites were started or stopped.

Browser tabs34/50/53 are retained for active QA. Temporary tabs64/65/66 are closed. Root's static4944 and gallery4945 servers are stopped. CPU, media and viewport changes were reset with successful responses. Public WordPress final desktop and mobile screenshots are in the107 evidence directory.
