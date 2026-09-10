/** Colors and geometry shared by Cloud account pages and the portable editor chrome.
 * Density is intentional: spacious account/CMS forms, compact editor panels, dense rows.
 * These tokens are never injected into a user's published site.
 */
export const UI_TOKENS_CSS = `:root{
  --pc-surface-subtle:#f5f7f8;
  --pc-surface-muted:#edf0f2;
  --pc-canvas-surround:#f3f5f6;
  --pc-border:#dfe4e7;
  --pc-border-strong:#cbd2d8;
  --pc-hover-bg:#f4faef;
  --pc-selection-bg:#eef7e5;
  --pc-selection-text:#263d20;
  --pc-selection-muted:#506348;
  --pc-rail-width:88px;
  --pc-rail-padding-x:10px;
  --pc-control-height:44px;
  --pc-control-compact:36px;
  --pc-control-editor:37px;
  --pc-control-row:32px;
  --pc-control-font:13.5px;
  --pc-control-radius:7px;
  --pc-space-1:4px;
  --pc-space-2:8px;
  --pc-space-3:12px;
  --pc-space-4:16px;
  --pc-space-5:24px;
  --pc-space-6:32px;
}`;
