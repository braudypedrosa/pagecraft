# Rendered review — Common Ground / Index

Package: `3758e6d470cb6caa07a3fde9bcb3f7b99f458c9e329054581e941499fd90d255`.
Reviewer: agent, separate rendered acceptance pass. User final approval remains pending.

## Observations

All six pages were inspected at 390, 768, 1024 and 1440px in the built-in browser using rendered screenshots and DOM measurements. The Home opening retains the selected project directory with a framed exterior. Projects repeats the same facts/media geometry so two studies can be compared. Project Detail uses a wide scene followed by a bounded reading column; About uses a practice statement and three text groups; Services pairs scopes with outcomes; Contact uses explicit labels and a native form. The narrow-screen stack preserves facts before media and scope before outcome. At 768px the Home title occupies three lines; it remains readable and fits its directory column. Images show the courtyard edge and retained trusses clearly at each crop.

Compared with the inspected Northline and Marea desktop references, the dominant sequence is different: no creative evidence ledger or oversized wordmark floor, and no full-bleed scenic booking opening or inventory grid. The restrained light colophon and in-flow project navigation support an architecture portfolio. Familiar navigation and repeated project geometry are functional, not novelty failures. This assessment comes from the rendered pages, not the generation rationale. No originality score was produced.

Native color/font changes, media replacement, long headings, uneven descriptions, 1/3/7 independent project records, reordering/deletion, missing optional imagery, and inspector overrides were exercised. Latest-checksum records are named `current-*` and `native-fields-*`; older records remain historical. Current shared style tests changed Home and About; WordPress kept its flex header. Empty numeric inspector fields retain the previous value, so test image padding was explicitly restored to zero.

## Host limitations

- Cloud uses the actual installation, editor, save and local publication path through the local QA harness, with fixture identity and in-memory persistence. Supabase/OAuth and deployed releases were not tested.
- WordPress 7.1 uses the isolated compatibility patch recorded in `evidence/wordpress-host-patch-v4.json`, based on revision 8311421 with editor 0.2.14. Do not advertise compatibility with the unpatched released host. Existing pages saved by the older editor need resaving with the corrected split-style compiler.
- Cloud editor 0.2.15 reports 1 KB for larger imported media; actual bytes and rendered pixels are intact. This metadata issue remains a host follow-up.
- Native forms in the disposable sites posted successfully to a trusted HTTPS receiver that stores local test receipts. No email was sent. The installable template intentionally ships with delivery unconfigured and cannot claim a successful submission until configured. Earlier receiver rejection/storage-error tests are historical; the latest package repeated successful submissions in both hosts.
- WordPress and Cloud have small native spacing differences, particularly around buttons and page introductions. Both preserve the selected hierarchy and editable document. No pixel-identical rendering claim is made.

## Evidence notes

`painted-*` screenshots follow page scrolling to paint off-screen imagery. Full-page Contact captures at 768/1024 distorted the document during capture; those copies were discarded and replaced with `contact-<host>-<width>-top/bottom.png` viewport evidence and direct browser inspection. Earlier `current-*` image captures may omit off-screen media and are not the preferred visual record. DOM matrices remain useful for geometry and image-load checks. WordPress toolbar Search text is outside the template and is excluded from the template text-floor requirement.

A final restoration check exposed a WordPress save bug that compiled a library image as a bare media ID. The isolated v4 patch resolves native asset IDs before HTML sanitization. Replacement and restoration were repeated through the native editor, saved, reopened, and verified as loaded frontend URLs. `current-restored-sites.json` preserves the earlier failure; `current-wordpress-media-save-fix.json` is the corrected result. Earlier full matrices exercised the same package on v3; v4 adds this narrowly scoped media compiler correction and its targeted browser/regression checks.

## Decision

Agent rendered review: pass within the exact isolated host scope above. Final user visual approval is still required before local promotion. No production deployment is included.
