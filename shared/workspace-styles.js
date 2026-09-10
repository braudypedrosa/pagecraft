/** Product workspaces share the Pages layout. These adapters bridge the portable
 * builder and server-rendered Cloud screens; published pages never load them. */
export const WORKSPACE_CSS = `
:root{
  --pc-ui-font:var(--pc-font-body);
  --pc-ui-label-font:var(--pc-font-label);
  --pc-ui-surface:#fff;
  --pc-ui-hover:var(--pc-hover-bg);
  --pc-ui-text:#111311;
  --pc-ui-secondary:#4b504b;
  --pc-ui-border:var(--pc-border);
  --pc-workspace-x:32px;
  --pc-workspace-y:28px;
  --pc-workspace-title:var(--pc-text-workspace);
  --pc-section-title:var(--pc-text-section);
  --pc-dialog-title:var(--pc-text-dialog);
}
:is(.pages-workspace,.cms-workspace,.dashboard-app) .pc-workspace-head{
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;
  gap:24px;padding:24px var(--pc-workspace-x);border-bottom:1px solid var(--pc-ui-border);
  background:var(--pc-ui-surface);flex-shrink:0;
}
:is(.pages-workspace,.cms-workspace,.dashboard-app) .pc-workspace-head h1{
  font-family:var(--pc-ui-font);font-size:var(--pc-workspace-title);line-height:1.3;
  letter-spacing:-.02em;font-weight:700;margin:0;color:var(--pc-ui-text);overflow-wrap:anywhere;
}
:is(.pages-workspace,.cms-workspace,.dashboard-app) .pc-workspace-head p{
  font-size:var(--pc-control-font);line-height:1.5;margin:6px 0 0;color:var(--pc-ui-secondary);
}
:is(.pages-workspace,.cms-workspace,.dashboard-app) .pc-workspace-head :is(.btn,.pc-btn){
  min-height:var(--pc-control-editor);height:var(--pc-control-editor);padding:8px 14px;
}
:is(.pages-workspace,.cms-workspace) .pc-workspace-body{padding:var(--pc-workspace-y) var(--pc-workspace-x)}
.cms-workspace h2{font-size:var(--pc-section-title);line-height:1.4}
.cms-workspace .cms-entry-row{padding:16px 12px;gap:16px}
.cms-workspace .cms-entry-row:hover{background:var(--pc-ui-hover)}
.cms-workspace .cms-entry-open{padding:0;font-weight:500}
.cms-workspace .cms-entry-open b{font-weight:500}
.cms-workspace .cms-entry-row>.btn{width:36px;height:36px;min-height:36px;padding:0;justify-content:center}
.cms-workspace .cms-collections .btn{min-height:37px;border-color:transparent;background:transparent}
.cms-workspace .cms-collections .btn.primary{background:var(--pc-selection-bg);border-color:transparent;color:var(--pc-selection-text)}
.cms-workspace .cms-collections .btn:not(.primary):hover{background:var(--pc-ui-hover)}
:is(.pages-workspace,.cms-workspace) :is(.ctl,.pc-custom-select-trigger){border-radius:var(--pc-control-radius)}
.project-settings .mh{padding:24px var(--pc-workspace-x);min-height:104px}
.project-settings #mTitle{font-size:var(--pc-workspace-title);line-height:1.3;font-weight:700}
.project-settings .settings-nav{width:220px;flex-basis:220px;padding:24px 16px}
.project-settings .settings-content h2{font-size:var(--pc-section-title);line-height:1.4}

/* Selection is distinct from the lighter green hover across editor and Cloud surfaces.
 * Main rail navigation, primary actions and boolean/status indicators retain
 * their stronger colors. Explicit selectors avoid recoloring those roles. */
:is(.pagerow.on,.lrow.sel,.lrow.sel2,.lrow.region.live,.mcard.on,.pickrow.on,.navitem.on){
  --text-2:var(--pc-selection-muted);--text-3:var(--pc-selection-muted);
}
.dashboard-app .pc-settings-nav button[aria-selected="true"],
.dashboard-app .pc-create-modal .pc-template-choice:has(input:checked),
.dashboard-app .pc-template-choice:has(input:checked),
.dashboard-app .pc-property-choice:has(input:checked){
  background:var(--pc-selection-bg);color:var(--pc-selection-text);
}
.dashboard-app :is(.pc-template-choice,.pc-property-choice):has(input:checked){--pc-text-2:var(--pc-selection-muted)}

/* Cloud's old wrappers used nested, centred insets. The workspace owns the
 * page margins; individual forms keep their readable width inside that space. */
.dashboard-app{
  --pc-text:var(--pc-ui-text);--pc-text-2:var(--pc-ui-secondary);--pc-line:var(--pc-ui-border);
  --pc-field:var(--pc-ui-surface);font-family:var(--pc-ui-font);font-size:var(--pc-control-font);line-height:1.5;
}
.dashboard-app .pc-workspace{background:var(--pc-ui-surface);padding:0}
.dashboard-app p{color:var(--pc-ui-secondary)}
.dashboard-app :is(input,textarea)::placeholder{color:#6f7771;opacity:1}
.dashboard-app :is(.pc-content,.pc-manage-content,.pc-settings-content){
  width:100%;max-width:none;margin:0;padding:var(--pc-workspace-y) var(--pc-workspace-x) 40px;
}
.dashboard-app :is(.pc-site-settings,.pc-people,.pc-integrations){width:100%;max-width:none}
.dashboard-app .pc-workspace-head{margin:calc(-1 * var(--pc-workspace-y)) calc(-1 * var(--pc-workspace-x)) var(--pc-workspace-y)}
.dashboard-app :is(.pc-site-setting,.pc-role-guide,.pc-invite,.pc-members){max-width:980px}
.dashboard-app .pc-workspace-head>div:first-child{min-width:0}
.dashboard-app :is(.pc-manage-back,.pc-sub-back){font-family:var(--pc-ui-font);font-size:var(--pc-text-label);margin-bottom:8px}
.dashboard-app .pc-manage-actions{gap:8px;flex-wrap:wrap}
.dashboard-app .pc-btn{font-weight:500!important}
.dashboard-app .pc-btn.primary{font-weight:600!important}
.dashboard-app .pc-btn:hover{background:var(--pc-ui-hover)}
.dashboard-app .pc-btn.primary:hover{background:var(--pc-green-hi,#c5fa63)}
.dashboard-app .pc-workspace :is(h2,h3){letter-spacing:-.015em;line-height:1.4}
.dashboard-app :is(.pc-settings-title,.pc-site-setting-copy,.pc-members-head,.pc-manage-summary,.pc-manage-section) h2{font-size:var(--pc-section-title)}
.dashboard-app .pc-settings-layout{grid-template-columns:220px minmax(0,980px);gap:32px;padding-top:0}
.dashboard-app .pc-settings-nav{top:0}
.dashboard-app .pc-settings-main{max-width:800px}
.dashboard-app .pc-settings-nav button{font-family:var(--pc-ui-font);font-size:var(--pc-control-font);font-weight:500}
.dashboard-app .pc-toolbar{margin-top:0}
.dashboard-app .pc-manage-grid{padding-top:0}

/* Lists and entry dialogs use the same type scale, rules and row spacing. */
.dashboard-app .pc-sub-table{margin-top:0;width:100%;border-collapse:collapse}
.dashboard-app :is(.pc-sub-table,.pc-connections-table) :is(th,td){border-bottom:1px solid var(--pc-ui-border);vertical-align:middle;text-align:left}
.dashboard-app :is(.pc-sub-table,.pc-connections-table) thead th{padding:10px 12px;font-size:var(--pc-text-label);font-weight:600;color:var(--pc-ui-secondary)}
.dashboard-app :is(.pc-sub-table,.pc-connections-table) tbody :is(th,td){padding:16px 12px;font-size:var(--pc-control-font)}
.dashboard-app .pc-connections-table thead{background:var(--pc-ui-surface)}
.dashboard-app .pc-connections-table tbody th{font-weight:500}
.dashboard-app .pc-connections-table tbody tr:hover{background:var(--pc-ui-hover)}
.dashboard-app :is(.pc-form-link,.pc-entry-link){font-weight:500;text-decoration:none;padding:6px 0;line-height:1.5}
.dashboard-app .pc-form-link{display:flex;align-items:center;gap:10px}
.dashboard-app .pc-form-link svg{flex:0 0 14px}
.dashboard-app .pc-sub-table>tbody>tr:hover{background:var(--pc-ui-hover)}
.dashboard-app .pc-sub-filters{margin:0 0 24px;gap:12px;flex-wrap:wrap}
.dashboard-app .pc-sub-filters label{gap:8px}
.dashboard-app .pc-sub-pager{margin-top:24px;gap:12px;font-size:var(--pc-text-label);color:var(--pc-ui-secondary)}
.dashboard-app .pc-entry-delete-icon{height:36px;min-height:36px}
.dashboard-app :is(.pc-entry-dialog,.pc-create-modal,.pc-delete-dialog,.pc-integration-dialog){font-family:var(--pc-ui-font);font-size:var(--pc-control-font);border-radius:16px;color:var(--pc-ui-text)}
.dashboard-app :is(.pc-entry-dialog header,.pc-create-modal-head){padding:20px 24px;border-bottom:1px solid var(--pc-ui-border)}
.dashboard-app :is(.pc-entry-dialog,.pc-create-modal,.pc-delete-dialog,.pc-integration-dialog) h2{font-size:var(--pc-dialog-title);line-height:1.4;font-weight:600;margin:0}
.dashboard-app .pc-entry-dialog [data-close-dialog]{width:32px;height:32px;min-height:32px;padding:0;border:0;background:transparent}
.dashboard-app .pc-entry-dialog footer [data-close-dialog]{width:auto;height:44px;padding:0 18px;border:1px solid var(--pc-line-2,#cbd2d8);background:var(--pc-ui-surface)}
.dashboard-app .pc-entry-body{line-height:1.5}
.dashboard-app .pc-entry-body dt{font-size:var(--pc-text-label);color:var(--pc-ui-secondary)}
.dashboard-app .pc-entry-body dd{margin:4px 0 16px}
.account :is(button,.button,input){border-radius:var(--pc-control-radius)}
.account :is(button,.button){font-weight:500}
.account .primary{font-weight:600}
@media(max-width:1050px){:root{--pc-workspace-x:20px;--pc-workspace-y:20px}}
@media(max-width:760px){
  .dashboard-app .pc-settings-layout{grid-template-columns:1fr;gap:24px}
  .project-settings .settings-nav{width:auto;flex-basis:auto}
  .dashboard-app .pc-sub-table{min-width:560px}
  .dashboard-app .pc-sub-table-wrap{overflow-x:auto}
  .dashboard-app .pc-sub-pager{flex-wrap:wrap}
}
@media(max-width:700px){
  :is(.pages-workspace,.cms-workspace,.dashboard-app) .pc-workspace-head{align-items:flex-start;gap:16px}
  :is(.pages-workspace,.cms-workspace,.dashboard-app) .pc-workspace-head>div:first-child{flex-basis:100%}
  .dashboard-app .pc-sub-actions{margin-left:0;flex-wrap:wrap}
}
`;
