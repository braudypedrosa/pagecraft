/** Dialog geometry shared by the portable builder and Cloud. Hosts retain their
 * form density; dialog headers, body insets and optional action rows do not. */
export const DIALOG_CSS = `
.pc-dialog:not(.project-settings){padding:0;border:1px solid var(--pc-border);border-radius:var(--pc-dialog-radius);max-height:calc(100svh - 48px);background:var(--pc-popup-bg);color:var(--pc-ui-text);box-shadow:0 20px 60px #11131124}
.pc-dialog::backdrop{background:var(--pc-dialog-scrim)}
.pc-dialog .pc-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:var(--pc-space-4);padding:var(--pc-dialog-edge) var(--pc-dialog-inset);border-bottom:1px solid var(--pc-border);flex-shrink:0}
.pc-dialog .pc-dialog-title{margin:0;font-family:var(--pc-font-body);font-size:var(--pc-text-dialog);font-weight:600;line-height:1.4;letter-spacing:-.02em;min-width:0;overflow-wrap:anywhere}
.pc-dialog .pc-dialog-head>div{min-width:0}
.pc-dialog .pc-dialog-head p{font:var(--pc-type-description);margin:var(--pc-space-1) 0 0}
.pc-dialog .pc-dialog-body{padding:var(--pc-dialog-inset);min-height:0;overflow:auto;overscroll-behavior:contain}
.pc-dialog .pc-dialog-body>:first-child{margin-top:0}
.pc-dialog .pc-dialog-body>:last-child{margin-bottom:0}
.pc-dialog .pc-dialog-foot{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:var(--pc-action-gap);padding:var(--pc-dialog-edge) var(--pc-dialog-inset);border-top:1px solid var(--pc-border);border-bottom:0;background:var(--pc-popup-bg);flex-shrink:0}
.pc-dialog .pc-dialog-foot:empty{display:none}
.pc-dialog .pc-dialog-close{display:grid;place-items:center;flex:0 0 var(--pc-control-row);width:var(--pc-control-row);height:var(--pc-control-row);min-height:var(--pc-control-row);margin:0;padding:0;border:0;border-radius:var(--pc-control-radius);background:transparent;color:inherit;box-shadow:none;font-size:20px;line-height:1;filter:none}
.pc-dialog .pc-dialog-close:hover{background:var(--pc-hover-bg)}
.pc-dialog .pc-dialog-close svg{width:16px;height:16px}
.pc-dialog .pc-dialog-form{display:block;padding:0;margin:0}
.pc-dialog .pc-dialog-field{display:grid;gap:var(--pc-field-label-gap);margin:var(--pc-field-gap) 0 0}
.pc-dialog .pc-dialog-field input{height:var(--pc-control-height);min-height:var(--pc-control-height)}
.pc-dialog .pc-dialog-description{font:var(--pc-type-input);line-height:1.55}
`;
