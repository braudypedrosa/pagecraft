/** Public form-control styles are injected only on pages that render the matching control. */
export const PUBLIC_SELECT_CSS = `
.pagecraft-form[data-pagecraft-controls] .pc-select{position:relative;width:100%;min-width:0}
.pagecraft-form[data-pagecraft-controls] select[data-pagecraft-select][data-pagecraft-enhanced]{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.pagecraft-form[data-pagecraft-controls] .pc-select-button{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-width:0;font:inherit;text-align:left;color:var(--f-text,inherit);background:var(--f-bg,#fff);border:1px solid var(--f-border,#ddd);border-radius:var(--f-radius,8px);padding:var(--f-pad,11px 13px);cursor:pointer}
.pagecraft-form[data-pagecraft-controls] .pc-select-value{min-width:0;overflow-wrap:anywhere}
.pagecraft-form[data-pagecraft-controls] .pc-select-icon{display:grid;place-items:center;flex:0 0 18px;width:18px;height:18px;transition:transform .15s ease}
.pagecraft-form[data-pagecraft-controls] .pc-select-icon svg{width:18px;height:18px}
.pagecraft-form[data-pagecraft-controls] .pc-select-button[aria-expanded=true] .pc-select-icon{transform:rotate(180deg)}
.pagecraft-form[data-pagecraft-controls] .pc-select-button:focus-visible{outline:2px solid var(--f-btn-bg,#333);outline-offset:1px}
.pagecraft-form[data-pagecraft-controls] .pc-select-button[aria-invalid=true]{border-color:#b42318}
.pagecraft-form[data-pagecraft-controls] .pc-select-button:disabled{cursor:not-allowed;opacity:.55}
.pc-select-list[data-pagecraft-select-popover]{position:fixed;z-index:1000;box-sizing:border-box;min-width:0;max-height:min(16rem,50vh);overflow:auto;margin:0;padding:5px;list-style:none;color:var(--f-text,inherit);background:var(--f-bg,#fff);border:1px solid var(--f-border,#ddd);border-radius:var(--f-radius,8px);box-shadow:0 14px 36px rgba(0,0,0,.16)}
.pc-select-list[data-pagecraft-select-popover][hidden]{display:none}
.pc-select-list[data-pagecraft-select-popover] .pc-select-option{padding:9px 10px;overflow-wrap:anywhere;border-radius:max(3px,calc(var(--f-radius,8px) - 3px));cursor:pointer}
.pc-select-list[data-pagecraft-select-popover] .pc-select-option[aria-disabled=true]{cursor:not-allowed;opacity:.45}
.pc-select-list[data-pagecraft-select-popover] .pc-select-option[data-active]{outline:2px solid var(--f-btn-bg,#333);outline-offset:-2px}
.pc-select-list[data-pagecraft-select-popover] .pc-select-option[aria-selected=true]{background:var(--f-btn-bg,#111);color:var(--f-btn-fg,#fff)}
`;

export const PUBLIC_DATE_CSS = `
.pagecraft-form[data-pagecraft-controls] .pc-date{position:relative;width:100%}
.pagecraft-form[data-pagecraft-controls] .pc-date-control{position:relative;width:100%}
.pagecraft-form[data-pagecraft-controls] .pc-date-input{padding-inline-end:48px}
.pagecraft-form[data-pagecraft-controls] .pc-date-trigger{position:absolute;inset:0 0 0 auto;display:grid;place-items:center;width:44px;padding:0;border:0;background:transparent;color:var(--f-text,inherit);cursor:pointer}
.pagecraft-form[data-pagecraft-controls] .pc-date-trigger svg{width:19px;height:19px}
.pagecraft-form[data-pagecraft-controls] .pc-date-trigger:focus-visible{outline:2px solid var(--f-btn-bg,#333);outline-offset:-4px;border-radius:var(--f-radius,8px)}
.pagecraft-form[data-pagecraft-controls] .pc-date-trigger:disabled{cursor:not-allowed;opacity:.55}
.pc-date-positioner[data-pagecraft-date-popover]{--z-index:40;--reference-width:auto;--available-width:100vw;--available-height:100vh;--x:0px;--y:0px;z-index:40;max-width:calc(100vw - 24px)}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-content{box-sizing:border-box;width:min(20rem,calc(100vw - 24px));max-height:min(20rem,var(--available-height,calc(100dvh - 24px)),calc(100dvh - 24px));overflow:auto;padding:12px;color:var(--f-text,inherit);background:var(--f-bg,#fff);border:1px solid var(--f-border,#ddd);border-radius:var(--f-radius,8px);box-shadow:0 18px 44px rgba(0,0,0,.18)}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-content[hidden]{display:none}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-head{display:grid;grid-template-columns:40px 1fr 40px;align-items:center;gap:4px;margin-bottom:8px}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-month{font:inherit;font-weight:650;text-align:center}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-nav{display:grid;place-items:center;width:40px;height:40px;padding:0;border:0;border-radius:6px;background:transparent;color:inherit;cursor:pointer}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-nav:hover{background:color-mix(in srgb,var(--f-btn-bg,#111) 10%,transparent)}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-nav:focus-visible{outline:2px solid var(--f-btn-bg,#333);outline-offset:-2px}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-nav svg{width:18px;height:18px}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-table{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:2px}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-table th{padding:5px 0;font-size:.74em;font-weight:600;color:var(--f-label,inherit);text-align:center}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-day{display:grid;place-items:center;width:100%;aspect-ratio:1;padding:0;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-day:hover:not(:disabled){background:color-mix(in srgb,var(--f-btn-bg,#111) 10%,transparent)}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-day:focus-visible{outline:2px solid var(--f-btn-bg,#333);outline-offset:-2px}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-day[data-selected]{background:var(--f-btn-bg,#111);color:var(--f-btn-fg,#fff);font-weight:650}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-day[data-today]:not([data-selected]){box-shadow:inset 0 0 0 1px var(--f-btn-bg,#333)}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-day[data-outside-range]{opacity:.38}
.pc-date-positioner[data-pagecraft-date-popover] .pc-date-day:disabled{cursor:not-allowed;opacity:.28;text-decoration:line-through}
@media(max-width:480px){.pc-date-positioner[data-pagecraft-date-popover] .pc-date-content{padding:10px}.pc-date-positioner[data-pagecraft-date-popover] .pc-date-day{min-height:38px}}
`;
