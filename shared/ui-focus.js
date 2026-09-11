/** Border-free focus feedback for application chrome, never published pages. */
export const UI_FOCUS_CSS = `
:focus{outline:none}
:where(.topbar,.rail,.pc-topbar,.pc-rail,.pc-notification){--pc-focus-bg:#34452f;--pc-focus-text:#f5f7f8}
:where(.modal,.pc-menu,.pc-custom-select-popover){--pc-focus-bg:var(--pc-selection-bg);--pc-focus-text:var(--pc-selection-text)}
:where(.primary,.rail .on,.pc-rail .on){--pc-focus-bg:#c5fa63;--pc-focus-text:#111311}
:where(.danger,.pc-delete-site-action){--pc-focus-text:var(--pc-danger,var(--danger,#8f312b))}
:root :is(button,a[href],input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),select,textarea,summary,[role=treeitem],[tabindex]:not([tabindex="-1"]),[contenteditable="true"]):focus-visible{
  outline:none;background-color:var(--pc-focus-bg);color:var(--pc-focus-text);
}
/* Native checkboxes retain their shape; their label carries keyboard feedback. */
label:has(input:is([type=checkbox],[type=radio]):focus-visible){background-color:var(--pc-focus-bg);color:var(--pc-focus-text)}
input:is([type=checkbox],[type=radio],[type=range],[type=color]):focus-visible{filter:brightness(.8)}
`;
