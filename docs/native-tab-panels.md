# Editable tab panels

Editor 0.2.18 adds native content panels to Tabs. Existing text-only tabs remain supported.

Select a text-only Tabs element and choose **Use editable panels**. Existing text becomes a normal paragraph inside each panel. Choose **Edit panel** to add or arrange native images, headings, buttons and other elements. Clicking a tab in the canvas selects its panel. Arrow keys, Home and End switch the active panel.

The Tabs inspector edits labels and adds, duplicates, reorders or removes complete panels. The label and its panel move together. Removing the last remaining panel is disabled. The navigator exposes each panel and its ordinary native descendants; generic content belongs inside a panel, not beside the panel containers.

## Hosted authoring contract

Schema 15 stores rich tab items as `{label, panelId}`. Each `panelId` must reference exactly one direct native Box child. IDs must be unique and local to that Tabs element. Missing or orphaned panels, mixed text and rich items, and rich content marked with an older schema are rejected. `pagecraft_template_schema` advertises this relation and its constraints.

Text-only items keep `{label, panel}` and have no children. Conversion is explicit. Saving an older document through the current editor uses the current schema, while immutable older archives retain their original schema and renderer contract.

Schema 15 portable packages require `pagecraft-renderer-3` and a compatible host. Cloud deployment and the WordPress adapter upgrade are separate release steps. The WordPress adapter and sealed editor bundle must be upgraded together before importing these packages. A local compatibility check does not establish a production WordPress plugin release.
