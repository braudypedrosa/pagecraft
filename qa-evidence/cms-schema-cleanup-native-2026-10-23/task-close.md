# Task close: CMS schema cleanup and Boolean visibility108

Date: 23 October 2026, Asia/Manila. Project: Pagecraft. Status: bounded slice complete, exhaustive customer QA remains open.

The authorized staging retest reproduced stale pagination after deleting an active collection query field and an unrelated-collection false warning. Cloud commit fbb5f50 scopes cleanup to live result-shaping changes and carries the actual collection source while counting warning references. Boolean comparisons now offer Empty value, Yes and No, preserving unsupported legacy values explicitly. WordPress preview103 is exact Cloud source, committed and pushed as 1ed1613, installed only on the local QA site.

Verification: root full suite2750 passed,5 skipped;30 shared native checks;24 visual PNGs byte-exact to the approved baseline. Both Cloud CI/deployment and WordPress CI passed. Native staging tested Boolean equality/inequality and Category-filter plus numeric Score-sort deletion from page2. Both recovered page1. Both warnings excluded unrelated image fields; all eight other pages and their bindings remained exact. Native History1278 restored the entire nine-page/four-collection project byte-for-byte.

WordPress7.1.3 independent database-free tests passed62 Node and34 security assertions. Exact install preserved SQL bytes. One native Gallery gap24-to25 save survived reload and public rendering. Native History45 restore produced finalVersion47/420revisions. The26-check postguard proves original8nodes and compiled98 artifacts exact, accounts/sessions/global state/prior418revisions preserved, and only the authorized new703/704 revisions. Public1280 and414 views load all3images without horizontal overflow. CPU1, viewport and media resets returned success on tab53.

The initial install gate correctly aborted before file swap on three known cache timestamp/transient-ID changes. Those artifacts remain preserved. The reviewed cache-only baseline refresh did not rewrite the database or weaken the subsequent strict SQL comparison.

Remaining work: common Style/Advanced/Motion state/device/reset combinations, references/components/libraries and unlisted inventory branches. This is not production readiness or exhaustive host CMS acceptance. No production promotion, account plan change, database reset, form send or external communication occurred. Time/billing: not tracked or submitted.

Review: https://staging.itspagecraft.com/edit/c11494e8-3ae5-4be0-b707-e937278a710a and http://pagecraft-wordpress-qa.local/?page_id=616&preview=true. Evidence: acceptance.json, full-project-restoration.json, wordpress-native-after.json, wordpress-native108-post-restoration-guard.json and the final PNGs in this directory.
