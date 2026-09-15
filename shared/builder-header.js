/** Builder-authoritative wordmark and device control, reused by Cloud Reviews. */
export const HEADER_DEVICE_ICONS = {"desktop": "<svg width=\"17\" height=\"17\" viewBox=\"0 0 16 16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"><rect x=\"1.25\" y=\"2.75\" width=\"13.5\" height=\"9.5\" rx=\"1.6\"/><path d=\"M5.5 14.5h5\"/></svg>", "tablet": "<svg width=\"17\" height=\"17\" viewBox=\"0 0 16 16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"><rect x=\"3.25\" y=\"1.5\" width=\"9.5\" height=\"13\" rx=\"1.6\"/><path d=\"M6.75 12.4h2.5\"/></svg>", "mobile": "<svg width=\"17\" height=\"17\" viewBox=\"0 0 16 16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"><rect x=\"5\" y=\"1.5\" width=\"6\" height=\"13\" rx=\"1.7\"/><path d=\"M7.2 12.6h1.6\"/></svg>"};
export const BUILDER_HEADER_CSS = `
.topbar,.pc-topbar{-webkit-font-smoothing:antialiased}
.topbar .brand,.pc-topbar .pc-brand{display:flex;align-items:center;gap:8px;height:52px;padding:0 18px 0 16px;color:var(--pc-surface-subtle);text-decoration:none;font:600 var(--pc-text-dialog)/1.5 var(--pc-font-body);letter-spacing:-.02em;flex:0 0 auto}
.topbar .brand[href],.pc-topbar .pc-brand[href]{cursor:pointer}
.topbar .brand svg,.pc-topbar .pc-brand svg{width:17px;height:22px;display:block;flex:0 0 17px}
.pc-topbar{gap:8px;color:var(--pc-surface-subtle);font:var(--pc-text-body)/1.5 var(--pc-font-body)}.pc-topbar .pc-docname{font:500 var(--pc-text-body)/1.5 var(--pc-font-body);padding:6px 10px;color:var(--pc-surface-subtle)}
:is(#devSeg,.review-devices){display:flex;align-items:center;background:#ffffff0f;border-radius:8px;padding:3px;gap:2px;width:max-content;flex:none}
:is(#devSeg,.review-devices) button{position:relative;gap:6px;width:36px;height:28px;min-height:28px;padding:0;border:0;display:grid;place-items:center;border-radius:5px;background:transparent;color:#aeb5ad;font:500 var(--pc-text-body)/1.5 var(--pc-font-body)}
:is(#devSeg,.review-devices) button:hover{color:var(--pc-surface-subtle);background:#ffffff14}
:is(#devSeg,.review-devices) button:is(.on,[aria-pressed=true]){color:var(--pc-surface-subtle);background:#ffffff1a}
:is(#devSeg,.review-devices) button:is(.on,[aria-pressed=true])::after{content:"";position:absolute;left:8px;right:8px;bottom:2px;height:2px;background:#b7f34a;border-radius:2px}
:is(#devSeg,.review-devices) button svg{width:17px;height:17px;display:block;flex:none}@media(max-width:980px){.topbar .brand{padding-inline:10px}}@media(max-width:600px){.topbar .brand{padding-inline:8px}:is(#devSeg,.review-devices){padding:2px}:is(#devSeg,.review-devices) button{width:30px}}@media(max-width:520px){.pc-topbar .pc-brand{padding-inline:12px}}
`;
