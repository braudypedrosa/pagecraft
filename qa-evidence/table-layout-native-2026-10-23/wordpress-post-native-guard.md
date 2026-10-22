# Table101 WordPress post-native guard

Read-only checks pass against the Gallery Version 28 baseline. QA page 616 is now Version 30. The original eight-node document and all compiled artifact metadata are byte-exact to that baseline. Only the existing document-version metadata and page timestamps changed.

Actual revision count is 391, up from 387. Four new revisions (672 through 675) belong to page 616, with 116 new metadata rows. Two store Version 28 and two store Version 29. This records the observed database result of the Save and History restore actions, rather than assuming one revision per action.

Across 133 tables, 130 table insert sets remain exact. The four other changed option rows contain only known Elementor/theme-cache timestamp updates or transient row-ID renewal. All Pagecraft global options, original page 487 Version 73, menus, protected pages, prior revisions/metadata, accounts and sessions remain exact. Installed Builder, Theme, Importer and historical packages remain exact.

See [checks and hashes](wordpress-post-native-guard.json). Worker made no database or runtime writes. Full builder QA remains open.
