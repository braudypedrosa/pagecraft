import { BUILDER_HEADER_CSS } from '../../shared/builder-header.js';
/** Shared Cloud header: dashboard, site management and live reviews. */
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const CLOUD_HEADER_CSS = `
.pc-topbar{height:52px;flex:0 0 52px;display:flex;align-items:center;padding:0 12px 0 0;background:var(--pc-rail);color:var(--pc-rail-text);position:relative;z-index:40}
.pc-topsep{width:1px;height:22px;background:rgba(248,246,239,.16);flex:0 0 1px}
.pc-docname{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pc-spacer{flex:1}
.pc-topbar{--pc-rail:#111311;--pc-rail-text:#f5f7f8;--pc-rail-text-2:#aeb5ad}
.pc-topbar .pc-header-identity{display:flex;align-items:center;gap:10px;color:var(--pc-rail-text-2);font:12px/1.4 "DM Sans",sans-serif}.pc-topbar .pc-header-identity small{display:block;color:inherit}.pc-topbar #viewport-size{color:var(--pc-rail-text-2)}.pc-topbar .pc-header-avatar{width:32px;height:32px;display:grid;place-items:center;border:1px solid rgba(248,246,239,.24);border-radius:50%;color:var(--pc-rail-text);font-size:.76rem;font-weight:600}
.pc-topbar .pc-header-action{min-height:34px;padding:var(--pc-control-padding);font:var(--pc-type-control);background:transparent;border:1px solid rgba(248,246,239,.16);border-radius:var(--pc-control-radius);color:var(--pc-rail-text)}.pc-topbar .pc-header-action:hover{background:#ffffff0f;border-color:#ffffff2e}.pc-topbar .pc-header-action.primary{background:#b7f34a;border-color:#b7f34a;color:#111311}.pc-topbar .pc-header-action.primary:hover{background:#c5fa63}@media(max-width:800px){.pc-topbar:has(.review-devices){height:auto;min-height:92px;flex-basis:auto;flex-wrap:wrap;padding-bottom:8px}.pc-topbar .review-devices{order:5;justify-content:center;margin-inline:auto}.pc-topbar .pc-header-identity,.pc-topbar .all-reviews{display:none}.pc-topbar:has(.review-devices) .pc-spacer{display:none}.pc-topbar:has(.review-devices) .pc-docname{flex:1}}@media(max-width:520px){.pc-topbar{gap:10px}.pc-topbar .pc-brand{padding-inline:12px}.pc-topbar .pc-brand-label,.pc-topbar .pc-topsep{display:none}.pc-topbar .pc-docname{font-size:.78rem}}
${BUILDER_HEADER_CSS}
`;
/** Action and center slots contain trusted application markup, never raw user text. */
export function cloudHeader(label: string, actions: string, center = '') {
  return `<header class="pc-topbar"><a class="pc-brand" href="/" aria-label="Pagecraft sites"><svg width="17" height="22" viewBox="0 0 73 95" aria-hidden="true"><path d="M0 0H73V71H52L46 65L40 71H18V77H40V95H0Z M18 18V77H40V53H55V18Z" fill="#b7f34a" fill-rule="evenodd"/></svg><span class="pc-brand-label">Pagecraft</span></a><span class="pc-topsep"></span><span class="pc-docname">${escape(label)}</span><span class="pc-spacer"></span>${center ? center + '<span class="pc-spacer"></span>' : ''}${actions}</header>`;
}
