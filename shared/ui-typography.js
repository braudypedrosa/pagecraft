/** Semantic type roles for editor and Cloud chrome. Keep geometry in the owning
 * component. Legacy class adapters migrate whole roles, never individual IDs.
 * New UI should use these pc-* primitives. This sheet is not copied to canvas. */
export const UI_TYPOGRAPHY_CSS = `
.pc-control-text{font:var(--pc-type-control)}
.pc-input-text,.ctl,select.ctl,textarea.ctl,
.dashboard-app :is(input,select,textarea),
.dashboard-app .pc-custom-select-trigger{font:var(--pc-type-input)}

/* One compact context row, including buttons, native/enhanced selects and pills.
 * A button must not inherit the larger form-action size inside this toolbar. */
.pc-toolbar-context,
.pc-toolbar-context :is(.btn,.pill,select,.pc-custom-select-trigger){font:var(--pc-type-toolbar)}
.pc-toolbar-context :is(.btn,.pill){min-height:var(--pc-control-row)}
.pc-toolbar-context .page-switcher{height:var(--pc-control-row)}
.pc-toolbar-context .page-switcher :is(select,.pc-custom-select-trigger){height:26px;min-height:26px}

.pc-field-label,
.f>label,.wp-link-picker>label,.navitem-body>label,
.swrow,.tog-row span,.frow-control,.repeater-long,
.cms-field>label,.cms-list-tools label,.cms-schema-inputs label,
.dashboard-app :is(.pc-create-field,.pc-settings-field,.pc-site-setting-field) label,
.dashboard-app :is(.pc-sub-filters,.pc-delete-dialog,.pc-integration-list-head) label,
.account .field label{font:var(--pc-type-label)}

.pc-description,.note,.hint,.cms-workspace .note,.tpl small,
.dashboard-app :is(.pc-create-field,.pc-settings-field,.pc-site-setting-field) small,
.dashboard-app :is(.pc-path-copy small,.pc-property-choice small,.pc-platform-choice small,.pc-plan-note),
.account .field small{font:var(--pc-type-description)}

.pc-caption,.brow .bn small,.imgset .an small,.imgdrop span,.navitem-main small,
.cms-entry-open small,.cms-entry-row>span,
.dashboard-app :is(.pc-results,.pc-account-meta,.pc-template-copy small){font:var(--pc-type-caption)}

.pc-table-label,.pages-list-head,
.dashboard-app :is(.pc-sub-table,.pc-connections-table) thead th{font:var(--pc-type-table-label)}
`;
