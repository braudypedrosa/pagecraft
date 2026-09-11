/** Border-free focus feedback for application chrome, never published pages. */
export const UI_FOCUS_CSS = `
:focus{outline:none}
:where(.topbar,.rail,.pc-topbar,.pc-rail,.pc-notification){--pc-focus-bg:#34452f;--pc-focus-text:#f5f7f8}
:where(.modal,.pc-menu,.pc-custom-select-popover){--pc-focus-bg:var(--pc-selection-bg);--pc-focus-text:var(--pc-selection-text)}
:where(.primary,.rail .on,.pc-rail .on){--pc-focus-bg:#c5fa63;--pc-focus-text:#111311}
:where(.danger,.pc-delete-site-action){--pc-focus-text:var(--pc-danger,var(--danger,#8f312b))}
:root :is(button,a[href],summary,[role=treeitem],[tabindex]:not([tabindex="-1"])):not(input,select,textarea,[contenteditable="true"],[role=combobox],.pc-custom-select-trigger):focus-visible{
  outline:none;background-color:var(--pc-focus-bg);color:var(--pc-focus-text);
}
/* Fields keep their resting surface and text color, including readonly fields.
 * Editable text retains its native caret; select labels identify keyboard focus. */
.pc-custom-select-trigger:focus-visible>span{text-decoration:underline;text-underline-offset:3px}
input:is([type=checkbox],[type=radio],[type=range],[type=color]):focus-visible{filter:brightness(.8)}
`;
