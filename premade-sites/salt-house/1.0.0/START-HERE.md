# Salt House — start here

Six redesigned pages for a small vacation-rental collection. Live preview: https://build.itspagecraft.com/templates/salt-house/1.0.0/preview/index.html. Installable release: `site.pagecraft-site.zip`.

1. Change the collection name in the shared header and footer. In Settings / Site Settings, edit Body font (Outfit), Chalk, Olive ink, Terracotta and Sand. Shared text styles carry responsive sizes.
2. Select a Holiday home instance to edit its name, facts, description, photograph, alt text and destination. Content is independent; component styling propagates. Home and The Homes contain separate instances, so update both.
3. Duplicate a property page and connect its corresponding home link. The property galleries and image crop controls remain native. Missing optional listing imagery hides without a broken image.
4. Replace all fictional details and seven packaged generated photographs with verified rental material. Provenance is in ASSETS.json. No real prices, reviews, availability or property claims are supplied.
5. Connect the property action to your booking provider or configure the inquiry form with a real HTTPS receiving endpoint. Verify receipt before removing demo notices. The packaged form is deliberately disabled until configured. Cloud publishing requires configuring or removing it first.
6. Save, reopen and review the page at desktop, tablet and mobile. On WordPress, Site Settings → Save settings generates the selected font resources. Existing WordPress design overrides may intentionally take precedence after import; review them before changing an existing site.

Release acceptance passed in both isolated hosts. See evidence/release-qa/REPORT.json for exact tested revisions, methods and limitations. User visual and production deployment approval is bound to this package checksum. Previous Coastline acceptance is archived and does not apply.

Motion uses native hover and interactive components. Scroll entrance animations were removed after the WordPress importer rejected their markup. GSAP and hidden CSS are not included. WordPress verification applies to Builder and Theme 0.2.1, editor 0.2.14, on WordPress 7.1.

## Example nightly rates
Select a Holiday home instance and edit its **Example nightly rate** field. Dune House uses €240 / night and Blue Shutter Cottage €165 / night as clearly labeled demonstration values. Update the separate property-detail rate when customizing a real collection. Connect a booking provider for current availability and final total prices; these fields do not calculate quotes. The stays section uses the shared Sea sage color token. Booking icons, photograph, shade and FAQ colors are native editable nodes/styles.
