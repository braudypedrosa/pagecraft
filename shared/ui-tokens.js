/** Colors, typography and geometry shared by Cloud account pages and the portable editor chrome.
 * Density is intentional: spacious account/CMS forms, compact editor panels, dense rows.
 * These tokens are never injected into a user's published site.
 */
export const UI_TEXT_SIZES = Object.freeze({ label: '11px', body: '12px' });

export const UI_TOKENS_CSS = `:root{
  --pc-surface-subtle:#fafbfc;
  --pc-surface-muted:#f3f5f6;
  --pc-canvas-surround:#f3f5f6;
  --pc-popup-bg:#fff;
  --pc-border:#dfe4e7;
  --pc-border-strong:#cbd2d8;
  --pc-hover-bg:#f4faef;
  --pc-selection-bg:#eef7e5;
  --pc-selection-text:#263d20;
  --pc-selection-muted:#506348;
  --pc-rail-width:88px;
  --pc-rail-padding-x:10px;
  --pc-control-padding-y:6px;
  --pc-control-padding-x:8px;
  --pc-control-padding:var(--pc-control-padding-y) var(--pc-control-padding-x);
  --pc-control-height:44px;
  --pc-control-compact:36px;
  --pc-control-editor:37px;
  --pc-control-row:32px;
  --pc-font-body:Manrope,system-ui,-apple-system,sans-serif;
  --pc-font-label:"DM Sans",system-ui,-apple-system,sans-serif;
  --pc-text-caption:11px;
  --pc-text-label:${UI_TEXT_SIZES.label};
  --pc-text-body:${UI_TEXT_SIZES.body};
  --pc-text-panel:15px;
  --pc-text-dialog:16px;
  --pc-text-section:18px;
  --pc-text-workspace:22px;
  --pc-type-input:400 var(--pc-text-body)/1.4 var(--pc-font-body);
  --pc-type-control:500 var(--pc-text-body)/1.4 var(--pc-font-body);
  --pc-type-toolbar:500 var(--pc-text-label)/1.4 var(--pc-font-body);
  --pc-type-label:500 var(--pc-text-label)/1.5 var(--pc-font-label);
  --pc-type-description:400 var(--pc-text-label)/1.55 var(--pc-font-label);
  --pc-type-caption:400 var(--pc-text-caption)/1.45 var(--pc-font-label);
  --pc-type-table-label:600 var(--pc-text-label)/1.4 var(--pc-font-label);
  --pc-control-font:var(--pc-text-body);
  --pc-control-radius:7px;
  --pc-space-1:4px;
  --pc-space-2:8px;
  --pc-space-3:12px;
  --pc-space-4:16px;
  --pc-space-5:24px;
  --pc-space-6:32px;
}`;
