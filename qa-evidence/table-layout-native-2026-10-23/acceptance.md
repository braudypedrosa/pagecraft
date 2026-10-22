# Table101 bounded layout acceptance

The named Table layout slice passed in Cloud and local WordPress: all six Position choices, four Overflow choices, max-width 0px/320.5px/20rem/50%/40ch/reset, Top 0/-12.5/12px and z-index 0/-1/5. Each host has 26 recorded editor cases.

The saved representative uses Sticky, max-width 320px, Top 12px, z-index 5 and Auto overflow. After reload, desktop (1280px), tablet (834px) and mobile (414px) retained these values, received keyboard focus and scrolled horizontally at least 40px without body overflow. Visible overflow intentionally expanded body width. Actual sticky movement inside a sufficiently tall parent was not tested and is not accepted by this record.

Cloud restored its original 20 nodes from Version 1142. WordPress restored its original eight nodes from Version 28 and is now Version 30. Independent read-only guard passes 25 checks. Actual WordPress revisions total 391, with four new revisions rather than the initial estimate of two. Original document and compiled artifact metadata are byte-exact after restoration.

[Cloud desktop](cloud-desktop-preview.png), [Cloud tablet](cloud-tablet-preview.png), [Cloud mobile](cloud-mobile-preview.png), [WordPress desktop](wordpress-desktop-public.png), [WordPress tablet](wordpress-tablet-public.png), [WordPress mobile](wordpress-mobile-public.png), [exact acceptance](acceptance.json), [WordPress guard](wordpress-post-native-guard.md).

Root performed the native flows. This evidence worker checked the supplied records, reviewed the actual WordPress mobile screenshot and captured the independent read-only guard. No browser, database, runtime or source changes were made by this worker. Arbitrary values and combinations, shared Motion/State controls, physical touch, generic CSS architecture and full customer-flow QA remain open.
