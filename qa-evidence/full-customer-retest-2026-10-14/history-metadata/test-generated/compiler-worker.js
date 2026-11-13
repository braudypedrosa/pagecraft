"use strict";(()=>{var oe=Object.freeze({label:"13px",body:"14px"}),Qr=`:root{
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
  --pc-focus-bg:var(--pc-selection-bg);
  --pc-focus-text:var(--pc-selection-text);
  --pc-rail-width:88px;
  --pc-rail-padding-x:10px;
  --pc-control-padding-y:6px;
  --pc-control-padding-x:8px;
  --pc-control-padding:var(--pc-control-padding-y) var(--pc-control-padding-x);
  --pc-control-height:44px;
  --pc-control-compact:36px;
  --pc-control-editor:40px;
  --pc-control-row:32px;
  --pc-field-label-gap:8px;
  --pc-field-gap:16px;
  --pc-action-gap:8px;
  --pc-dialog-inset:24px;
  --pc-dialog-edge:16px;
  --pc-dialog-radius:16px;
  --pc-dialog-scrim:rgba(17,19,17,.45);
  --pc-motion-quick:120ms;
  --pc-motion-enter:180ms;
  --pc-motion-dialog:200ms;
  --pc-motion-exit:120ms;
  --pc-ease-enter:cubic-bezier(.2,.8,.2,1);
  --pc-ease-exit:cubic-bezier(.4,0,1,1);
  --pc-table-cell-y:4px;
  --pc-table-cell-x:8px;
  --pc-table-cell-padding:var(--pc-table-cell-y) var(--pc-table-cell-x);
  --pc-table-head-padding:6px var(--pc-table-cell-x);
  --pc-table-icon-size:14px;
  --pc-table-icon-gap:8px;
  --pc-font-body:Manrope,system-ui,-apple-system,sans-serif;
  --pc-font-label:"DM Sans",system-ui,-apple-system,sans-serif;
  --pc-text-caption:12px;
  --pc-text-label:${oe.label};
  --pc-text-body:${oe.body};
  --pc-text-prose:16px;
  --pc-text-panel:16px;
  --pc-text-dialog:18px;
  --pc-text-section:18px;
  --pc-text-workspace:22px;
  --pc-type-input:400 var(--pc-text-body)/1.4 var(--pc-font-body);
  --pc-type-control:500 var(--pc-text-body)/1.4 var(--pc-font-body);
  --pc-type-body:400 var(--pc-text-prose)/1.55 var(--pc-font-body);
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
}`;var ue={cms:'<ellipse cx="8" cy="3.8" rx="5.5" ry="2.3"/><path d="M2.5 3.8v8.4c0 1.27 2.46 2.3 5.5 2.3s5.5-1.03 5.5-2.3V3.8"/><path d="M2.5 8c0 1.27 2.46 2.3 5.5 2.3s5.5-1.03 5.5-2.3"/>',section:'<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M4 5.5h8M4 8h8M4 10.5h5"/>',row:'<rect x="1.5" y="3.5" width="13" height="9" rx="1.5"/><path d="M8 3.5v9"/>',table:'<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M1.5 6h13M6.5 6v7.5"/>',codeblock:'<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M5 7l-1.6 1.6L5 10.2M9.2 7l1.6 1.6-1.6 1.6" stroke-linecap="round"/>',crumbs:'<path d="M1.5 8h3.2M7.2 8h3.2M12.9 8h1.6" stroke-linecap="round"/><path d="M5.6 6.4L7 8 5.6 9.6M11.3 6.4L12.7 8l-1.4 1.6" stroke-linecap="round"/>',slider:'<rect x="1.5" y="3.5" width="8" height="9" rx="1.5"/><path d="M12 5.2v5.6M14.3 6.6v2.8"/>',column:'<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M5.6 2.5v11M10.4 2.5v11"/>',columns:'<rect x="1.5" y="3.5" width="13" height="9" rx="1.5"/><path d="M5.8 3.5v9M10.2 3.5v9"/>',heading:'<path d="M4 13V3M12 13V3M4 8h8" stroke-linecap="round"/>',text:'<path d="M2.5 3.5h11M2.5 6.6h11M2.5 9.7h11M2.5 12.8h6" stroke-linecap="round"/>',quote:'<path d="M6.6 4.3C4.5 5.3 3.3 7 3.3 8.9c0 1.4.9 2.4 2.2 2.4 1.1 0 1.9-.8 1.9-1.8s-.7-1.7-1.7-1.7M13.6 4.3c-2.1 1-3.3 2.7-3.3 4.6 0 1.4.9 2.4 2.2 2.4 1.1 0 1.9-.8 1.9-1.8s-.7-1.7-1.7-1.7" stroke-linecap="round" stroke-linejoin="round"/>',image:'<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><circle cx="5.6" cy="6.4" r="1.2"/><path d="M1.8 11.6l3.4-3 3 2.6 2.3-2 3.7 3.3"/>',video:'<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M6.6 5.9l4 2.1-4 2.1z" fill="currentColor" stroke="none"/>',button:'<rect x="1.5" y="4.5" width="13" height="7" rx="3.5"/><path d="M5 8h6" stroke-linecap="round"/>',spacer:'<path d="M2.5 2.5h11M2.5 13.5h11" stroke-linecap="round"/><path d="M8 5v6M6.2 6.6L8 4.8l1.8 1.8M6.2 9.4L8 11.2l1.8-1.8"/>',divider:'<path d="M1.5 8h13" stroke-linecap="round"/><path d="M4 4.6h8M4 11.4h8" opacity=".4"/>',nav:'<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7" stroke-linecap="round"/>',form:'<rect x="2" y="2.5" width="12" height="4" rx="1.2"/><rect x="2" y="9.5" width="12" height="4" rx="1.2"/><path d="M4.5 4.5h3M4.5 11.5h5" stroke-linecap="round"/>',globe:'<circle cx="8" cy="8" r="6.3"/><path d="M1.9 6.2h12.2M1.9 9.8h12.2M8 1.7c-1.6 1.7-2.5 3.9-2.5 6.3S6.4 12.6 8 14.3c1.6-1.7 2.5-3.9 2.5-6.3S9.6 3.4 8 1.7z"/>',lock:'<rect x="3.5" y="7" width="9" height="6.5" rx="1.3"/><path d="M5.8 7V5.2a2.2 2.2 0 014.4 0V7"/>',external:'<path d="M9.5 2.5H13V6"/><path d="M13 2.5L7.5 8"/><path d="M11.5 9.5v3H3.5v-8h3" stroke-linecap="round"/>',link:'<path d="M6.5 9.5l3-3M5.6 7.6L4.2 9a2.3 2.3 0 003.2 3.2l1.4-1.4M10.4 8.4l1.4-1.4A2.3 2.3 0 008.6 3.8L7.2 5.2" stroke-linecap="round"/>',unlink:'<path d="M5.6 7.6L4.2 9a2.3 2.3 0 003.2 3.2l1.4-1.4M10.4 8.4l1.4-1.4A2.3 2.3 0 008.6 3.8L7.2 5.2" stroke-linecap="round"/><path d="M2.5 2.5l11 11" stroke-linecap="round" opacity=".7"/>',reset:'<path d="M3.1 5.1A5.7 5.7 0 111.9 9.4" stroke-linecap="round"/><path d="M2.7 2.4v3.4h3.4" stroke-linecap="round" stroke-linejoin="round"/>',icon:'<path d="M8 1.8l1.9 4 4.3.6-3.1 3 .8 4.3L8 11.7 4.1 13.7l.8-4.3-3.1-3 4.3-.6z"/>',caret:'<path d="M3.5 5.5L8 10l4.5-4.5" stroke-linecap="round" stroke-linejoin="round"/>',caretUp:'<path d="M3.5 10.5L8 6l4.5 4.5" stroke-linecap="round" stroke-linejoin="round"/>',close:'<path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round"/>',trash:'<path d="M2.8 4.5h10.4M6.2 4.5V2.8h3.6v1.7M4.2 4.5l.6 8.2c0 .5.5.8 1 .8h4.4c.5 0 1-.3 1-.8l.6-8.2" stroke-linecap="round"/>',copy:'<rect x="5.5" y="5.5" width="8" height="8" rx="1.4"/><path d="M10.5 5.5v-2A1 1 0 009.5 2.5h-6a1 1 0 00-1 1v6a1 1 0 001 1h2"/>',component:'<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><rect x="5.5" y="5.5" width="5" height="5" rx="1" fill="currentColor" stroke="none"/>',library:'<rect x="2" y="2.5" width="3" height="11" rx=".6"/><rect x="6.4" y="2.5" width="3" height="11" rx=".6"/><path d="M10.4 3.6l2.8-.8 2.3 9.9-2.8.8z" stroke-linejoin="round"/>',more:'<circle cx="3.6" cy="8" r="1.15" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1.15" fill="currentColor" stroke="none"/><circle cx="12.4" cy="8" r="1.15" fill="currentColor" stroke="none"/>',drag:'<circle cx="6" cy="4" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="4" r="1.1" fill="currentColor" stroke="none"/><circle cx="6" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="6" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="12" r="1.1" fill="currentColor" stroke="none"/>',eye:'<path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="1.9"/>',eyeoff:'<path d="M2 2l12 12" stroke-linecap="round"/><path d="M6.2 6.3A2 2 0 008 10a2 2 0 001.7-1M4.2 4.6C2.5 5.9 1.5 8 1.5 8S3.9 12.5 8 12.5c1 0 1.9-.2 2.7-.6M12.4 10.4c1.3-1.2 2.1-2.4 2.1-2.4S12.1 3.5 8 3.5c-.4 0-.8 0-1.2.1"/>',desktop:'<rect x="1.5" y="2.5" width="13" height="9" rx="1.5"/><path d="M5.5 14h5"/>',tablet:'<rect x="3.5" y="1.5" width="9" height="13" rx="1.5"/>',mobile:'<rect x="4.5" y="1.5" width="7" height="13" rx="1.5"/>',alignL:'<path d="M2 3.5h12M2 8h7M2 12.5h10" stroke-linecap="round"/>',alignC:'<path d="M2 3.5h12M4.5 8h7M3 12.5h10" stroke-linecap="round"/>',alignR:'<path d="M2 3.5h12M7 8h7M4 12.5h10" stroke-linecap="round"/>',alignJ:'<path d="M2 3.5h12M2 8h12M2 12.5h12" stroke-linecap="round"/>',vTop:'<path d="M2 2.5h12" stroke-linecap="round"/><rect x="5" y="5" width="6" height="8" rx="1"/>',vMid:'<path d="M2 8h12" stroke-linecap="round" opacity=".5"/><rect x="5" y="4" width="6" height="8" rx="1"/>',vBot:'<path d="M2 13.5h12" stroke-linecap="round"/><rect x="5" y="3" width="6" height="8" rx="1"/>',toTop:'<path d="M3 2.8h10M8 13.2V6M5 8.9L8 5.9l3 3" stroke-linecap="round" stroke-linejoin="round"/>',toBottom:'<path d="M3 13.2h10M8 2.8V10M5 7.1L8 10.1l3-3" stroke-linecap="round" stroke-linejoin="round"/>',plus:'<path d="M8 3v10M3 8h10" stroke-linecap="round"/>',edit:'<path d="M11.2 2.6l2.2 2.2-8 8L3 13.5l.7-2.4z" stroke-linejoin="round"/>',arrow:'<path d="M6 3.5L10.5 8 6 12.5" stroke-linecap="round" stroke-linejoin="round"/>',check:'<path d="M3 8.5l3.2 3.2L13 5" stroke-linecap="round" stroke-linejoin="round"/>',page:'<rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h4"/>',code:'<path d="M5.5 5L2.5 8l3 3M10.5 5l3 3-3 3M9.3 3.2l-2.6 9.6" stroke-linecap="round"/>',tabs:'<path d="M1.8 6.2h12.4v7.6a.9.9 0 01-.9.9H2.7a.9.9 0 01-.9-.9z" stroke-linejoin="round"/><path d="M1.8 6.2l1.4-3.4h3.6l.7 3.4" stroke-linecap="round" stroke-linejoin="round"/>',accordion:'<rect x="1.5" y="2.2" width="13" height="3.6" rx="1"/><rect x="1.5" y="7.4" width="13" height="6.4" rx="1"/><path d="M4 9.9h6M4 11.9h4" opacity=".5"/>',gallery:'<rect x="1.5" y="2.5" width="5.4" height="5.4" rx="1"/><rect x="9.1" y="2.5" width="5.4" height="5.4" rx="1"/><rect x="1.5" y="9.6" width="5.4" height="3.9" rx="1"/><rect x="9.1" y="9.6" width="5.4" height="3.9" rx="1"/>',pipette:'<path d="M9.6 2.4l4 4" stroke-linecap="round"/><path d="M12.3 5.1L6.2 11.2l-2.9.9.9-2.9 6.1-6.1z" stroke-linecap="round" stroke-linejoin="round"/>'},j=(e,t=14,n="")=>`<svg class="${n}" width="${t}" height="${t}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">${ue[e]||""}</svg>`,pt=[["Interface",[["check",'<path d="M20 6.5L9.2 17.3 4 12.1"/>'],["check-circle",'<circle cx="12" cy="12" r="9"/><path d="M8.2 12.4l2.6 2.6 5-5.6"/>'],["plus",'<path d="M12 5v14M5 12h14"/>'],["minus",'<path d="M5 12h14"/>'],["close",'<path d="M6 6l12 12M18 6L6 18"/>'],["arrow-right",'<path d="M4 12h15M13.2 6l6 6-6 6"/>'],["arrow-up-right",'<path d="M7 17L17.2 6.8M8.4 6.8h8.8v8.8"/>'],["chevron-down",'<path d="M6 9.5l6 6 6-6"/>'],["chevron-right",'<path d="M9.5 6l6 6-6 6"/>'],["menu",'<path d="M4 7h16M4 12h16M4 17h16"/>'],["search",'<circle cx="11" cy="11" r="6.4"/><path d="M15.8 15.8l4.7 4.7"/>'],["settings",'<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v3.1M12 18.3v3.1M4.4 7.2l2.7 1.6M16.9 15.2l2.7 1.6M4.4 16.8l2.7-1.6M16.9 8.8l2.7-1.6"/>'],["external",'<path d="M14 4h6v6M20 4l-8.6 8.6M17 14.4v5.1H4.5V7h5.1"/>'],["download",'<path d="M12 4v11.4M7.4 11l4.6 4.6L16.6 11M4.4 19.6h15.2"/>']]],["Signals",[["star",'<path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.4 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.4 6.1-.9z"/>'],["heart",'<path d="M12 20.2C9.5 18.4 4.6 14.9 4.6 11a3.9 3.9 0 017.4-1.8A3.9 3.9 0 0119.4 11c0 3.9-4.9 7.4-7.4 9.2z"/>'],["zap",'<path d="M13.4 2.4L4.6 14.2H10l-1.4 7.4 8.8-11.8h-5.4z"/>'],["sparkle",'<path d="M10 3.2l1.7 4.6 4.6 1.7-4.6 1.7L10 15.8 8.3 11.2 3.7 9.5l4.6-1.7z"/><path d="M17.6 14.4l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>'],["info",'<circle cx="12" cy="12" r="9"/><path d="M12 11.1v5.6M12 7.5v.9"/>'],["alert",'<path d="M12 3.6l8.8 15.8H3.2z"/><path d="M12 9.4v4.4M12 16.6v.9"/>'],["shield",'<path d="M12 3l8 3v5.9c0 5-3.4 8.1-8 9.1-4.6-1-8-4.1-8-9.1V6z"/>'],["lock",'<rect x="4.8" y="10.9" width="14.4" height="9.4" rx="2"/><path d="M8.2 10.9V8a3.8 3.8 0 017.6 0v2.9"/>']]],["Contact",[["mail",'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.6 6.6L12 12.5l8.4-5.9"/>'],["phone",'<path d="M6.1 3.2h2.8l1.9 4.7-2.1 1.4a12.3 12.3 0 005.9 5.9l1.4-2.1 4.7 1.9v2.8a2 2 0 01-2.2 2A16.6 16.6 0 014.1 5.4a2 2 0 012-2.2z"/>'],["chat",'<path d="M20 14.8a2 2 0 01-2 2H8.6L4 20.6V6a2 2 0 012-2h12a2 2 0 012 2z"/>'],["map-pin",'<path d="M12 21.2C12 21.2 5 15.1 5 10.4a7 7 0 1114 0c0 4.7-7 10.8-7 10.8z"/><circle cx="12" cy="10.2" r="2.6"/>'],["clock",'<circle cx="12" cy="12" r="9"/><path d="M12 6.9v5.5l3.6 2.2"/>'],["calendar",'<rect x="3.6" y="5.1" width="16.8" height="15.3" rx="2"/><path d="M3.6 10.1h16.8M8.2 3v4.1M15.8 3v4.1"/>'],["users",'<circle cx="9.2" cy="8" r="3.4"/><path d="M2.6 20a6.6 6.6 0 0113.2 0"/><path d="M16.2 5.2a3.4 3.4 0 010 5.6M17.6 14.5A6.6 6.6 0 0121.4 20"/>']]],["Craft",[["code",'<path d="M8.4 7.4L3.8 12l4.6 4.6M15.6 7.4L20.2 12l-4.6 4.6M13.7 4.4l-3.4 15.2"/>'],["layers",'<path d="M12 3l9 4.8-9 4.8-9-4.8z"/><path d="M3 12.6l9 4.8 9-4.8"/>'],["box",'<path d="M12 3.2l8.4 4.4v8.8L12 20.8l-8.4-4.4V7.6z"/><path d="M3.6 7.6L12 12l8.4-4.4M12 12v8.8"/>'],["chart",'<path d="M3 20.2h18"/><path d="M6.6 20.2v-6.4M12 20.2V7.4M17.4 20.2v-9.2"/>'],["globe",'<circle cx="12" cy="12" r="9"/><path d="M3.2 9.4h17.6M3.2 14.6h17.6"/><path d="M12 3c-2.4 2.6-3.7 5.7-3.7 9s1.3 6.4 3.7 9c2.4-2.6 3.7-5.7 3.7-9S14.4 5.6 12 3z"/>'],["play",'<circle cx="12" cy="12" r="9"/><path d="M10.2 8.4l6 3.6-6 3.6z"/>']]]],pe=pt.reduce((e,[,t])=>(t.forEach(([n,o])=>{e[n]=o}),e),{}),qn=Object.keys(pe),ze=(e,t="")=>`<svg ${t} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${pe[e]||pe.check}</svg>`;var ut=["bounce","bounce-down","bounce-in","bounce-up","elastic","fade-down","fade-in","fade-out","fade-up","flip-x","flip-y","rotate-in","rotate-in-left","rotate-in-right","scale-down","scale-up","slide-down","slide-fade-down","slide-fade-left","slide-fade-right","slide-fade-up","slide-left","slide-right","slide-up","spin","zoom-in","zoom-out"],$e=`@keyframes bpFadeIn{from{opacity:0}to{opacity:1}}@keyframes bpSlideLeft{from{opacity:0;transform:translateX(-50px)}to{opacity:1;transform:translateX(0)}}@keyframes bpSlideRight{from{opacity:0;transform:translateX(50px)}to{opacity:1;transform:translateX(0)}}@keyframes bpScaleUp{from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}}@keyframes bpFadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}@keyframes bpFadeDown{from{opacity:0;transform:translateY(-30px)}to{opacity:1;transform:translateY(0)}}@keyframes bpCard{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}@keyframes bpDoneDemo{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes bpFadeOut{from{opacity:1}to{opacity:0}}@keyframes bpSlideUp{from{opacity:0;transform:translateY(50px)}to{opacity:1;transform:translateY(0)}}@keyframes bpSlideDown{from{opacity:0;transform:translateY(-50px)}to{opacity:1;transform:translateY(0)}}@keyframes bpScaleDown{from{opacity:0;transform:scale(1.2)}to{opacity:1;transform:scale(1)}}@keyframes bpZoomIn{from{opacity:0;transform:scale(0.5)}to{opacity:1;transform:scale(1)}}@keyframes bpZoomOut{from{opacity:0;transform:scale(1.5)}to{opacity:1;transform:scale(1)}}@keyframes bpRotateIn{from{opacity:0;transform:rotate(-180deg)}to{opacity:1;transform:rotate(0deg)}}@keyframes bpRotateInLeft{from{opacity:0;transform:rotate(-90deg) translateX(-50px)}to{opacity:1;transform:rotate(0deg) translateX(0)}}@keyframes bpRotateInRight{from{opacity:0;transform:rotate(90deg) translateX(50px)}to{opacity:1;transform:rotate(0deg) translateX(0)}}@keyframes bpBounce{0%,20%,50%,80%,100%{opacity:1;transform:translateY(0)}40%{opacity:1;transform:translateY(-30px)}60%{opacity:1;transform:translateY(-15px)}}@keyframes bpBounceIn{0%{opacity:0;transform:scale(0.3)}50%{opacity:1;transform:scale(1.05)}70%{transform:scale(0.9)}100%{opacity:1;transform:scale(1)}}@keyframes bpBounceUp{0%{opacity:0;transform:translateY(50px)}60%{opacity:1;transform:translateY(-10px)}80%{transform:translateY(5px)}100%{opacity:1;transform:translateY(0)}}@keyframes bpBounceDown{0%{opacity:0;transform:translateY(-50px)}60%{opacity:1;transform:translateY(10px)}80%{transform:translateY(-5px)}100%{opacity:1;transform:translateY(0)}}@keyframes bpFlipX{from{opacity:0;transform:perspective(400px) rotateX(90deg)}to{opacity:1;transform:perspective(400px) rotateX(0deg)}}@keyframes bpFlipY{from{opacity:0;transform:perspective(400px) rotateY(90deg)}to{opacity:1;transform:perspective(400px) rotateY(0deg)}}@keyframes bpSpin{from{opacity:0;transform:rotate(0deg) scale(0.8)}to{opacity:1;transform:rotate(360deg) scale(1)}}@keyframes bpElastic{0%{opacity:0;transform:scale(0)}50%{opacity:1;transform:scale(1.1)}70%{transform:scale(0.95)}100%{opacity:1;transform:scale(1)}}@keyframes bpSlideFadeUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}@keyframes bpSlideFadeDown{from{opacity:0;transform:translateY(-40px)}to{opacity:1;transform:translateY(0)}}@keyframes bpSlideFadeLeft{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:translateX(0)}}@keyframes bpSlideFadeRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}.pc-fade-in{opacity:0}.pc-fade-in.bp-is-animating{animation:bpFadeIn .6s ease-in-out forwards}.pc-slide-left{opacity:0;transform:translateX(-50px)}.pc-slide-left.bp-is-animating{animation:bpSlideLeft .6s ease-in-out forwards}.pc-slide-right{opacity:0;transform:translateX(50px)}.pc-slide-right.bp-is-animating{animation:bpSlideRight .6s ease-in-out forwards}.pc-scale-up{opacity:0;transform:scale(0.8)}.pc-scale-up.bp-is-animating{animation:bpScaleUp .6s ease-in-out forwards}.pc-fade-up{opacity:0;transform:translateY(30px)}.pc-fade-up.bp-is-animating{animation:bpFadeUp .6s ease-in-out forwards}.pc-fade-down{opacity:0;transform:translateY(-30px)}.pc-fade-down.bp-is-animating{animation:bpFadeDown .6s ease-in-out forwards}.pc-fade-out{opacity:1}.pc-fade-out.bp-is-animating{animation:bpFadeOut .6s ease-in-out forwards}.pc-slide-up{opacity:0;transform:translateY(50px)}.pc-slide-up.bp-is-animating{animation:bpSlideUp .6s ease-in-out forwards}.pc-slide-down{opacity:0;transform:translateY(-50px)}.pc-slide-down.bp-is-animating{animation:bpSlideDown .6s ease-in-out forwards}.pc-scale-down{opacity:0;transform:scale(1.2)}.pc-scale-down.bp-is-animating{animation:bpScaleDown .6s ease-in-out forwards}.pc-zoom-in{opacity:0;transform:scale(0.5)}.pc-zoom-in.bp-is-animating{animation:bpZoomIn .6s ease-in-out forwards}.pc-zoom-out{opacity:0;transform:scale(1.5)}.pc-zoom-out.bp-is-animating{animation:bpZoomOut .6s ease-in-out forwards}.pc-rotate-in{opacity:0;transform:rotate(-180deg)}.pc-rotate-in.bp-is-animating{animation:bpRotateIn .8s ease-in-out forwards}.pc-rotate-in-left{opacity:0;transform:rotate(-90deg) translateX(-50px)}.pc-rotate-in-left.bp-is-animating{animation:bpRotateInLeft .8s ease-in-out forwards}.pc-rotate-in-right{opacity:0;transform:rotate(90deg) translateX(50px)}.pc-rotate-in-right.bp-is-animating{animation:bpRotateInRight .8s ease-in-out forwards}.pc-bounce{opacity:0}.pc-bounce.bp-is-animating{animation:bpBounce 1s ease-in-out forwards}.pc-bounce-in{opacity:0;transform:scale(0.3)}.pc-bounce-in.bp-is-animating{animation:bpBounceIn .8s ease-in-out forwards}.pc-bounce-up{opacity:0;transform:translateY(50px)}.pc-bounce-up.bp-is-animating{animation:bpBounceUp .8s ease-in-out forwards}.pc-bounce-down{opacity:0;transform:translateY(-50px)}.pc-bounce-down.bp-is-animating{animation:bpBounceDown .8s ease-in-out forwards}.pc-flip-x{opacity:0;transform:perspective(400px) rotateX(90deg)}.pc-flip-x.bp-is-animating{animation:bpFlipX .8s ease-in-out forwards}.pc-flip-y{opacity:0;transform:perspective(400px) rotateY(90deg)}.pc-flip-y.bp-is-animating{animation:bpFlipY .8s ease-in-out forwards}.pc-spin{opacity:0;transform:rotate(0deg) scale(0.8)}.pc-spin.bp-is-animating{animation:bpSpin .8s ease-in-out forwards}.pc-elastic{opacity:0;transform:scale(0)}.pc-elastic.bp-is-animating{animation:bpElastic .8s ease-in-out forwards}.pc-slide-fade-up{opacity:0;transform:translateY(40px)}.pc-slide-fade-up.bp-is-animating{animation:bpSlideFadeUp .6s ease-in-out forwards}.pc-slide-fade-down{opacity:0;transform:translateY(-40px)}.pc-slide-fade-down.bp-is-animating{animation:bpSlideFadeDown .6s ease-in-out forwards}.pc-slide-fade-left{opacity:0;transform:translateX(-40px)}.pc-slide-fade-left.bp-is-animating{animation:bpSlideFadeLeft .6s ease-in-out forwards}.pc-slide-fade-right{opacity:0;transform:translateX(40px)}.pc-slide-fade-right.bp-is-animating{animation:bpSlideFadeRight .6s ease-in-out forwards}
`,ft=`/**
 * BP Animate Library
 * 
 * A lightweight animation library that adds animation triggers when elements
 * come into view. The base class "bp-animate" doesn't start animations itself,
 * but triggers the "bp-is-animating" class when elements enter the viewport.
 * When the animation completes, it adds the "bp-is-done-animating" class.
 * 
 * @version 1.2.2
 */

(function() {
    'use strict';

    /**
     * Get animation attributes from element
     * 
     * Reads custom animation attributes (bp-duration, bp-delay, bp-easing)
     * from the element. Returns null if no custom attributes are provided.
     * 
     * @param {HTMLElement} element - The element to read attributes from
     * @returns {Object|null} Object containing duration, delay, and easing values, or null
     * @since 1.0.0
     */
    function getAnimationAttributes(element) {
        // Check if any custom attributes are provided
        const hasDuration = element.hasAttribute('bp-duration');
        const hasDelay = element.hasAttribute('bp-delay');
        const hasEasing = element.hasAttribute('bp-easing');
        
        // If no custom attributes, return null to use CSS defaults
        if (!hasDuration && !hasDelay && !hasEasing) {
            return null;
        }
        
        // Keep absent or empty values unset so the chosen preset retains its own defaults.
        const duration = hasDuration ? (element.getAttribute('bp-duration') || '').trim() : '';
        const delay = hasDelay ? (element.getAttribute('bp-delay') || '').trim() : '';
        const easing = hasEasing ? (element.getAttribute('bp-easing') || '').trim() : '';

        if (!duration && !delay && !easing) {
            return null;
        }
        
        return {
            duration: duration,
            delay: delay,
            easing: easing
        };
    }

    /**
     * Get keyframe name from animation class
     * 
     * Maps animation class names to their corresponding keyframe names.
     * 
     * @param {HTMLElement} element - The element to check for animation classes
     * @returns {string|null} The keyframe name or null if no animation class found
     * @since 1.0.0
     */
    function getKeyframeName(element) {
        // Map of animation classes to their keyframe names
        const animationMap = {
            'pc-fade-in': 'bpFadeIn',
            'pc-fade-out': 'bpFadeOut',
            'pc-fade-up': 'bpFadeUp',
            'pc-fade-down': 'bpFadeDown',
            'pc-slide-left': 'bpSlideLeft',
            'pc-slide-right': 'bpSlideRight',
            'pc-slide-up': 'bpSlideUp',
            'pc-slide-down': 'bpSlideDown',
            'pc-scale-up': 'bpScaleUp',
            'pc-scale-down': 'bpScaleDown',
            'pc-zoom-in': 'bpZoomIn',
            'pc-zoom-out': 'bpZoomOut',
            'pc-rotate-in': 'bpRotateIn',
            'pc-rotate-in-left': 'bpRotateInLeft',
            'pc-rotate-in-right': 'bpRotateInRight',
            'pc-bounce': 'bpBounce',
            'pc-bounce-in': 'bpBounceIn',
            'pc-bounce-up': 'bpBounceUp',
            'pc-bounce-down': 'bpBounceDown',
            'pc-flip-x': 'bpFlipX',
            'pc-flip-y': 'bpFlipY',
            'pc-spin': 'bpSpin',
            'pc-elastic': 'bpElastic',
            'pc-slide-fade-up': 'bpSlideFadeUp',
            'pc-slide-fade-down': 'bpSlideFadeDown',
            'pc-slide-fade-left': 'bpSlideFadeLeft',
            'pc-slide-fade-right': 'bpSlideFadeRight',
            'pc-card': 'bpCard',
            'pc-done-demo': 'bpDoneDemo'
        };

        // Check each class on the element to find a matching animation class
        for (let className of element.classList) {
            if (animationMap.hasOwnProperty(className)) {
                return animationMap[className];
            }
        }

        return null;
    }

    /**
     * Apply animation styles to element
     * 
     * Applies only the supplied duration, delay, and easing longhands. The animation name,
     * fill mode, and any timing value the author left empty stay owned by the CSS preset.
     * 
     * @param {HTMLElement} element - The element to apply styles to
     * @param {Object} attributes - Animation attributes object
     * @since 1.0.0
     */
    function applyAnimationStyles(element, attributes) {
        // Get the keyframe name for this element's animation class
        const keyframeName = getKeyframeName(element);
        
        if (keyframeName) {
            element.style.animationDuration = '';
            element.style.animationDelay = '';
            element.style.animationTimingFunction = '';
            if (attributes.duration) element.style.animationDuration = attributes.duration;
            if (attributes.delay) element.style.animationDelay = attributes.delay;
            if (attributes.easing) element.style.animationTimingFunction = attributes.easing;
        }
    }

    /**
     * Check if element is actually visible
     * 
     * Checks if an element is truly visible, not just in the viewport.
     * An element is considered visible if:
     * - It has dimensions (width and height > 0)
     * - It's not display: none
     * - It's not visibility: hidden
     * - It has opacity > 0 OR has animation classes AND is not intentionally hidden
     * 
     * This prevents triggering animations on elements that are intentionally hidden
     * via opacity: 0 but are not part of an animation sequence.
     * 
     * @param {HTMLElement} element - The element to check
     * @returns {boolean} True if element is visible, false otherwise
     * @since 1.0.0
     */
    function isElementVisible(element) {
        // Get computed styles
        const style = window.getComputedStyle(element);
        
        // Check if element is hidden via display
        if (style.display === 'none') {
            return false;
        }
        
        // Check if element is hidden via visibility
        if (style.visibility === 'hidden') {
            return false;
        }
        
        // Check if element has dimensions
        const rect = element.getBoundingClientRect();
        
        // Check if element has a valid animation class (predefined or custom)
        // Custom animation classes often start with "animation-" prefix
        const hasAnimationClass = getKeyframeName(element) !== null;
        const hasCustomAnimationClass = Array.from(element.classList).some(className => 
            className.startsWith('animation-') || 
            className.includes('animate') ||
            className.includes('grow') ||
            className.includes('slide') ||
            className.includes('fade') ||
            className.includes('scale') ||
            className.includes('rotate') ||
            className.includes('bounce') ||
            className.includes('flip')
        );
        
        // If element has zero dimensions, check if it has an animation class
        // Animations like growWidth, scale-up, etc. may intentionally start from zero
        if (rect.width === 0 && rect.height === 0) {
            // Allow zero dimensions if element has an animation class (predefined or custom)
            // The animation will handle making it visible
            if (hasAnimationClass || hasCustomAnimationClass) {
                // Element has animation class and zero dimensions - this is likely intentional
                // (e.g., animation-growWidth starts from width: 0)
                // Continue with visibility check
            } else {
                // No animation class and zero dimensions - element is truly hidden
                return false;
            }
        }
        
        // Check opacity
        const opacity = parseFloat(style.opacity);
        
        // If opacity is 0, we need to be more careful
        if (opacity === 0) {
            // Check if element has a valid animation class
            const hasAnimationClass = getKeyframeName(element) !== null;
            
            // If it doesn't have a valid animation class, it's intentionally hidden
            if (!hasAnimationClass) {
                return false;
            }
            
            // Element has opacity 0 and an animation class
            // Check if opacity is set via inline style (intentional hiding)
            const inlineOpacity = element.style.opacity;
            if (inlineOpacity === '0' || inlineOpacity === '0px') {
                // Opacity is explicitly set to 0 via inline style - this is intentional hiding
                // Even if it has an animation class, don't trigger if opacity is explicitly 0
                return false;
            }
            
            // Check if element has position fixed/absolute
            // Fixed/absolute elements with opacity 0 are often intentionally hidden (like menus)
            // Only trigger if explicitly allowed via data attribute
            const position = style.position;
            if ((position === 'fixed' || position === 'absolute') && opacity === 0) {
                // For fixed/absolute elements with opacity 0, require explicit permission
                // This prevents menus and other hidden fixed elements from auto-triggering
                if (!element.hasAttribute('data-bp-allow-hidden-animate')) {
                    return false;
                }
            }
            
            // Element has opacity 0 but has a valid animation class and passes other checks
            // Opacity 0 is the initial state for fade-in, slide, etc. animations
            return true;
        }
        
        // Element has opacity > 0, so it's visible
        return true;
    }

    /**
     * Handle animation completion
     * 
     * This function listens for transitionend and animationend events
     * to detect when CSS animations/transitions are complete.
     * When complete, it adds the "bp-is-done-animating" class.
     * 
     * @param {HTMLElement} element - The element that is animating
     * @since 1.0.0
     */
    function handleAnimationComplete(element) {
        // Track if we've already added the done class for this animation cycle
        // This prevents multiple triggers if there are multiple transitions
        let isDone = false;

        /**
         * Function to add the done class (only once per animation cycle)
         */
        function addDoneClass() {
            if (!isDone) {
                isDone = true;
                element.classList.add('bp-is-done-animating');
            }
        }

        // Listen for CSS transition end events
        // This fires when any CSS transition property finishes animating
        element.addEventListener('transitionend', function(event) {
            // Only handle transitions on the element itself, not child elements
            if (event.target === element) {
                addDoneClass();
            }
        }, { once: true }); // { once: true } removes listener after first trigger

        // Listen for CSS animation end events
        // This fires when any CSS animation finishes
        element.addEventListener('animationend', function(event) {
            // Only handle animations on the element itself, not child elements
            if (event.target === element) {
                addDoneClass();
            }
        }, { once: true }); // { once: true } removes listener after first trigger
    }

    /**
     * Initialize the BP Animate library
     * 
     * This function sets up an Intersection Observer to watch for elements
     * with the "bp-animate" class. When these elements come into view,
     * it adds the "bp-is-animating" class to trigger animations.
     * When animations complete, it adds the "bp-is-done-animating" class.
     * 
     * @since 1.0.0
     */
    function initBPAnimate() {
        // Get all elements with the bp-animate class
        const animateElements = document.querySelectorAll('.bp-animate');

        // If no elements found, exit early
        if (animateElements.length === 0) {
            return;
        }

        /**
         * Intersection Observer options
         * 
         * root: null means we're observing relative to the viewport
         * rootMargin: '0px' means no offset (you can adjust this to trigger earlier/later)
         * threshold: 0 means trigger when any part of the element enters the viewport
         */
        const observerOptions = {
            root: null,           // Viewport is the root
            rootMargin: '0px',    // No margin offset
            threshold: 0          // Trigger when element is 0% visible
        };

        /**
         * Callback function that runs when observed elements intersect with the viewport
         * 
         * @param {IntersectionObserverEntry[]} entries - Array of intersection entries
         * @param {IntersectionObserver} observer - The observer instance
         */
        function handleIntersection(entries, observer) {
            entries.forEach(entry => {
                // Check if the element is currently intersecting (visible in viewport)
                if (entry.isIntersecting) {
                    const element = entry.target;
                    
                    // Check if element is actually visible
                    const isVisible = isElementVisible(element);
                    
                    if (isVisible) {
                        // Element is in viewport AND actually visible
                        // Remove hidden class if it exists
                        element.classList.remove('bp-is-hidden');
                        
                        // Always add bp-is-visible class when element is in viewport and visible
                        // This works for elements with or without animation classes
                        element.classList.add('bp-is-visible');
                        
                        // Check if element has an animation class
                        // Only trigger animation if element has a valid animation class
                        const hasAnimationClass = getKeyframeName(element) !== null;
                        
                        if (hasAnimationClass) {
                            // Get animation attributes (duration, delay, easing)
                            // Returns null if no custom attributes are provided
                            const attributes = getAnimationAttributes(element);
                            
                            // Apply animation styles only if custom attributes are provided
                            if (attributes !== null) {
                                applyAnimationStyles(element, attributes);
                            }
                            
                            // Remove done class if it exists (for re-animations)
                            element.classList.remove('bp-is-done-animating');
                            
                            // Add the bp-is-animating class to trigger the animation
                            element.classList.add('bp-is-animating');
                            
                            // Set up listeners to detect when animation completes
                            handleAnimationComplete(element);
                            
                            // Check if animation should only run once
                            const animationOnce = element.getAttribute('bp-animation-once');
                            if (animationOnce === 'true') {
                                // Unobserve the element to prevent re-triggering
                                observer.unobserve(element);
                            }
                        }
                    } else {
                        // Element is in viewport but NOT actually visible (hidden via CSS)
                        // Remove visible class if it exists
                        element.classList.remove('bp-is-visible');
                        
                        // Add bp-is-hidden class to indicate element is in viewport but hidden
                        element.classList.add('bp-is-hidden');
                    }
                } else {
                    const element = entry.target;
                    // Remove all state classes when element leaves viewport
                    element.classList.remove('bp-is-animating');
                    element.classList.remove('bp-is-visible');
                    element.classList.remove('bp-is-hidden');
                    // Clear inline animation style when element leaves view
                    // This allows CSS defaults to work if element re-enters without custom attributes
                    element.style.animation = '';
                    element.style.animationDuration = '';
                    element.style.animationDelay = '';
                    element.style.animationTimingFunction = '';
                }
            });
        }

        // Create a new Intersection Observer instance
        const observer = new IntersectionObserver(handleIntersection, observerOptions);

        // Start observing each element with the bp-animate class
        animateElements.forEach(element => {
            observer.observe(element);
        });
        
        // Store observer globally so we can add new elements to it later
        window._bpAnimateObserver = observer;
        
        return observer;
    }
    
    /**
     * Observe a new element that was dynamically added to the DOM
     * 
     * This function adds a new element to the Intersection Observer
     * and sets up visibility change watching for dynamically added elements.
     * 
     * @param {HTMLElement} element - The element to observe
     * @since 1.2.1
     */
    function observeNewElement(element) {
        // Check if element has bp-animate class
        if (!element.classList.contains('bp-animate')) {
            return;
        }
        
        // Check if element is already being observed
        if (element.dataset.bpObserved === 'true') {
            return;
        }
        
        // Mark as observed
        element.dataset.bpObserved = 'true';
        
        // Get or create the observer
        let observer = window._bpAnimateObserver;
        
        if (!observer) {
            // Observer doesn't exist yet, initialize it
            initBPAnimate();
            observer = window._bpAnimateObserver;
        }
        
        if (observer) {
            // Add element to Intersection Observer
            observer.observe(element);
            
            // Set up visibility change watching
            watchForVisibilityChanges([element]);
            
            // If element is already in viewport, trigger check immediately
            const rect = element.getBoundingClientRect();
            const isInViewport = rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
                                rect.bottom > 0 &&
                                rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
                                rect.right > 0;
            
            if (isInViewport) {
                // Small delay to ensure CSS is applied
                setTimeout(function() {
                    triggerAnimation(element);
                }, 50);
            }
        }
    }
    
    /**
     * Watch for dynamically added elements with bp-animate class
     * 
     * Sets up a MutationObserver to watch the entire document for new elements
     * being added that have the bp-animate class.
     * 
     * @since 1.2.1
     */
    function watchForNewElements() {
        // Create a MutationObserver to watch for new elements
        const domObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                // Check for newly added nodes
                mutation.addedNodes.forEach(function(node) {
                    // Only process element nodes
                    if (node.nodeType === 1) { // Element node
                        // Check if the node itself has bp-animate class
                        if (node.classList && node.classList.contains('bp-animate')) {
                            observeNewElement(node);
                        }
                        
                        // Also check for bp-animate elements within the added node
                        const bpAnimateElements = node.querySelectorAll && node.querySelectorAll('.bp-animate');
                        if (bpAnimateElements) {
                            bpAnimateElements.forEach(function(element) {
                                observeNewElement(element);
                            });
                        }
                    }
                });
            });
        });
        
        // Start observing the document body for child additions
        domObserver.observe(document.body, {
            childList: true,    // Watch for added/removed children
            subtree: true       // Watch all descendants, not just direct children
        });
        
        // Store observer so it persists
        window._bpAnimateDOMObserver = domObserver;
    }

    /**
     * Manually trigger animation for an element
     * 
     * This function allows you to manually trigger an animation on an element,
     * useful when elements become visible dynamically via class or CSS changes.
     * 
     * @param {HTMLElement|string} element - The element or selector to trigger animation on
     * @returns {boolean} True if animation was triggered, false otherwise
     * @since 1.1.0
     */
    function triggerAnimation(element) {
        // Get element if selector string provided
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        
        // Check if element exists and has bp-animate class
        if (!element || !element.classList.contains('bp-animate')) {
            return false;
        }
        
        // Check if element is actually visible now
        const isVisible = isElementVisible(element);
        
        if (isVisible) {
            // Element is visible - add bp-is-visible, remove bp-is-hidden
            element.classList.remove('bp-is-hidden');
            element.classList.add('bp-is-visible');
            
            // Check if element has an animation class
            const hasAnimationClass = getKeyframeName(element) !== null;
            
            if (hasAnimationClass) {
                // Get animation attributes
                const attributes = getAnimationAttributes(element);
                
                // Apply animation styles if custom attributes provided
                if (attributes !== null) {
                    applyAnimationStyles(element, attributes);
                }
                
                // Remove done class if it exists (for re-animations)
                element.classList.remove('bp-is-done-animating');
                
                // Add the bp-is-animating class to trigger the animation
                element.classList.add('bp-is-animating');
                
                // Set up listeners to detect when animation completes
                handleAnimationComplete(element);
            }
            
            return true;
        } else {
            // Element is in viewport but not visible - add bp-is-hidden
            element.classList.remove('bp-is-visible');
            element.classList.add('bp-is-hidden');
            return false;
        }
    }

    /**
     * Watch for dynamic visibility changes
     * 
     * Sets up a MutationObserver to watch for class and style changes
     * that might make elements visible, and triggers animations accordingly.
     * 
     * @param {HTMLElement[]} elements - Array of elements to watch
     * @since 1.1.0
     */
    function watchForVisibilityChanges(elements) {
        elements.forEach(element => {
            // Only watch elements that haven't been observed yet
            if (element.dataset.bpWatched === 'true') {
                return;
            }
            
            element.dataset.bpWatched = 'true';
            
            // Watch for class and style attribute changes
            const observer = new MutationObserver(function(mutations) {
                let shouldCheck = false;
                
                mutations.forEach(function(mutation) {
                    // Check if class or style changed
                    if (mutation.type === 'attributes' && 
                        (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                        shouldCheck = true;
                    }
                });
                
                // If relevant changes occurred, check if element is now visible
                if (shouldCheck) {
                    // Small delay to allow CSS to update
                    setTimeout(function() {
                        // Only trigger if element is not already animating
                        if (!element.classList.contains('bp-is-animating') && 
                            !element.classList.contains('bp-is-done-animating')) {
                            
                            // Check if element is now visible
                            if (isElementVisible(element)) {
                                // Check if element is in viewport
                                const rect = element.getBoundingClientRect();
                                const isInViewport = rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
                                                    rect.bottom > 0 &&
                                                    rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
                                                    rect.right > 0;
                                
                                if (isInViewport) {
                                    // Trigger animation/visibility detection
                                    // This will add bp-is-visible or bp-is-hidden as appropriate
                                    triggerAnimation(element);
                                }
                            }
                        }
                    }, 50);
                }
            });
            
            observer.observe(element, {
                attributes: true,
                attributeFilter: ['class', 'style']
            });
        });
    }

    /**
     * Initialize when DOM is ready
     * 
     * We wait for the DOM to be fully loaded before initializing.
     * This ensures all elements with .bp-animate are available.
     */
    if (document.readyState === 'loading') {
        // DOM is still loading, wait for DOMContentLoaded event
        document.addEventListener('DOMContentLoaded', function() {
            initBPAnimate();
            // Watch for dynamic visibility changes
            const animateElements = document.querySelectorAll('.bp-animate');
            watchForVisibilityChanges(Array.from(animateElements));
            // Watch for dynamically added elements
            watchForNewElements();
        });
    } else {
        // DOM is already loaded, initialize immediately
        initBPAnimate();
        // Watch for dynamic visibility changes
        const animateElements = document.querySelectorAll('.bp-animate');
        watchForVisibilityChanges(Array.from(animateElements));
        // Watch for dynamically added elements
        watchForNewElements();
    }

    // Expose public API
    window.bpAnimate = {
        trigger: triggerAnimation,
        init: initBPAnimate,
        observe: observeNewElement
    };

})();

`;var Se=e=>{let t=String(e??"").trim();return t&&(/^(https?:\/\/|mailto:|tel:|#|\/|\.{1,2}\/)/i.test(t)||/^data:image\//i.test(t)||/^asset:[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(t)||/^[\w.-]+(\/|\?|#|$)/.test(t))?t:""},mt=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),gt={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:"\xA0",colon:":",Tab:"	",NewLine:`
`,sol:"/",lpar:"(",rpar:")",period:".",comma:",",semi:";",equals:"=",excl:"!",num:"#",quest:"?",plus:"+"},Fe=e=>e.replace(/&(?:#(\d+)|#x([0-9a-f]+));?|&([A-Za-z]+);/gi,(t,n,o,i)=>{if(i)return Object.prototype.hasOwnProperty.call(gt,i)?gt[i]:t;let r=n?parseInt(n,10):parseInt(o,16);return r>0&&r<=1114111&&!(r>=55296&&r<=57343)?String.fromCodePoint(r):"\uFFFD"}),ht=e=>Fe(e).replace(/[\u0000- \u007f]/g,"").toLowerCase(),re=e=>e===" "||e==="	"||e===`
`||e==="\r"||e==="\f";function bt(e,t){let n=t+1,o="";for(;n<e.length&&!re(e[n])&&e[n]!=="/"&&e[n]!==">";)o+=e[n++];let i=[],r=!1;for(;n<e.length;){let a=e[n];if(re(a)){n++;continue}if(a===">")return{name:o,attrs:i,selfClosing:r,end:n+1};if(a==="/"){n++,r=e[n]===">";continue}r=!1;let s=e[n++];for(;n<e.length&&!re(e[n])&&e[n]!=="/"&&e[n]!==">"&&e[n]!=="=";)s+=e[n++];for(;n<e.length&&re(e[n]);)n++;if(e[n]!=="="){i.push({name:s,value:null});continue}for(n++;n<e.length&&re(e[n]);)n++;let l=e[n];if(l==='"'||l==="'"){let d=e.indexOf(l,n+1);if(d<0)return null;i.push({name:s,value:Fe(e.slice(n+1,d))}),n=d+1;continue}let p="";for(;n<e.length&&!re(e[n])&&e[n]!==">";)p+=e[n++];i.push({name:s,value:Fe(p)})}return null}function yt(e){let t=0,n=String(e??"").replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,()=>(t++,"")).replace(/<script\b[^>]*\/?>/gi,()=>(t++,"")),o=/<[a-z]/gi,i="",r=0;for(;;){o.lastIndex=r;let a=o.exec(n);if(!a){i+=n.slice(r);break}i+=n.slice(r,a.index);let s=bt(n,a.index);if(!s)break;if(r=s.end,s.name.toLowerCase()==="script"){t++;continue}let l=s.attrs.filter(p=>{let d=p.name.toLowerCase(),u=p.value==null?"":ht(p.value),m=!/^[a-z_:][-a-z0-9_:.]*$/.test(d)||d.startsWith("on")||d==="srcdoc"||/(java|vb)script:/.test(u)||d==="attributename"&&u.startsWith("on");return m&&t++,!m});i+=`<${s.name}${l.map(p=>" "+p.name+(p.value==null?"":`="${mt(p.value)}"`)).join("")}${s.selfClosing?"/":""}>`}return{html:i,stripped:t}}var Wn=new Set(["p","br","h2","h3","blockquote","ul","ol","li","b","strong","i","em","u","s","strike","a","div"]),Un=new Set(["script","style","textarea","option","noscript","template","title","iframe","xmp","noembed","noframes"]),Vn="<!--",Gn=new Set(["p","div","h2","h3","ul","ol","blockquote"]),Yn=e=>{let t=ht(e);return/^(https?:|mailto:|tel:)/.test(t)?!0:!t.startsWith("//")&&!/^[^/?#]*:/.test(t)};function je(e){let t=String(e??""),n=t.toLowerCase(),o=/<\/([a-z][^\s/>]*)[^>]*>/iy,i=[],r=l=>{let p="";for(;i.length>l;)p+=`</${i.pop()}>`;return p},a="",s=0;for(;s<t.length;){let l=t.indexOf("<",s);if(l<0){a+=t.slice(s).replace(/>/g,"&gt;");break}a+=t.slice(s,l).replace(/>/g,"&gt;");let p=t[l+1]||"";if(t.startsWith(Vn,l)){let g=t.indexOf("-->",l+2);s=g<0?t.length:g+3;continue}if(p==="!"||p==="?"||p==="/"&&!/[a-z]/i.test(t[l+2]||"")){let g=t.indexOf(">",l);s=g<0?t.length:g+1;continue}if(p==="/"){o.lastIndex=l;let g=o.exec(t);if(!g)break;let $=i.lastIndexOf(g[1].toLowerCase());$>=0&&(a+=r($)),s=l+g[0].length;continue}if(!/[a-z]/i.test(p)){a+="&lt;",s=l+1;continue}let d=bt(t,l);if(!d)break;let u=d.name.toLowerCase();if(s=d.end,Un.has(u)){let g=n.indexOf(`</${u}`,s),$=g<0?-1:t.indexOf(">",g);s=$<0?t.length:$+1;continue}if(!Wn.has(u))continue;if(u==="br"){a+="<br>";continue}if(Gn.has(u)&&i.includes("p")&&(a+=r(i.lastIndexOf("p"))),u==="li"){for(let g=i.length-1;g>=0&&!["ul","ol","blockquote","h2","h3"].includes(i[g]);g--)if(i[g]==="li"){a+=r(g);break}}let m=u==="a"?d.attrs.find(g=>g.name.toLowerCase()==="href"&&g.value!=null):null;a+=m&&Yn(m.value)?`<a href="${mt(m.value)}">`:`<${u}>`,i.push(u)}return a+r(0)}var xt=0,Xn=()=>(xt++,"n"+Date.now().toString(36).slice(-5)+xt.toString(36)+Math.floor(Math.random()*1296).toString(36)),f=e=>String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");var _t="pagecraft:wordpress-content:",Zn="%%PAGECRAFT_WP_CONTENT:",me="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";function nt(e){let t=new TextEncoder().encode(e),n="";for(let o=0;o<t.length;o+=3){let i=t[o],r=o+1<t.length?t[o+1]:0,a=o+2<t.length?t[o+2]:0,s=i<<16|r<<8|a;n+=me[s>>18&63]+me[s>>12&63]+(o+1<t.length?me[s>>6&63]:"")+(o+2<t.length?me[s&63]:"")}return n}function Jn(e){if(!e||/[^A-Za-z0-9_-]/.test(e))return null;let t=[],n=0,o=0;for(let i of e){let r=me.indexOf(i);if(r<0)return null;n=n<<6|r,o+=6,o>=8&&(o-=8,t.push(n>>o&255),n&=(1<<o)-1)}if(o&&n!==0)return null;try{return new TextDecoder("utf-8",{fatal:!0}).decode(new Uint8Array(t))}catch{return null}}function Ht(e){let t=String(e??"").trim();return!t||t.length>2048||/[?#\\\u0000-\u001f\u007f]/.test(t)?null:(t=("/"+t.replace(/^\/+/,"")).replace(/\/{2,}/g,"/"),t!=="/"&&!/\.[^/]+\/?$/.test(t)&&!t.endsWith("/")&&(t+="/"),t)}function Qn(e,t){if(e!=="page"&&e!=="post")return"";let n=Ht(t);return n?`${_t}${e}:${nt(n)}`:""}function qt(e){let n=String(e??"").trim().match(/^pagecraft:wordpress-content:(page|post):([A-Za-z0-9_-]+)$/);if(!n)return null;let o=Jn(n[2]),i=o==null?null:Ht(o);return!i||i!==o||nt(i)!==n[2]?null:{objectType:n[1],path:i}}function eo(e){let t=Qn(e.objectType,e.path),n=t?qt(t):null;return n?`${Zn}${n.objectType}:${nt(n.path)}%%`:""}var Ve="";function wt(){return!!Ve}var to=e=>{let t=String(e??"").trim();if(!/^https:\/\//i.test(t))return"";try{let n=new URL(t);return n.protocol!=="https:"||!n.hostname||n.username||n.password?"":t}catch{return""}};function no(e,t=""){let n=String(e.action||"").trim(),o=to(n),i=e.method==="get"?"get":"post";return Ve?n?o?{kind:"external",action:o,method:i,reason:"",note:"Sends entries to the configured external HTTPS destination."}:{kind:"disabled",action:"",method:i,reason:"unsafe",note:"Disabled until the destination is a complete HTTPS URL."}:i==="get"?{kind:"disabled",action:"",method:i,reason:"missing",note:"Add an HTTPS destination for this search, or choose POST to save inquiries in Submissions."}:{kind:"cloud",action:Ve+"/"+encodeURIComponent(t),method:"post",reason:"",note:"Saves entries to this site\u2019s Submissions inbox when published."}:e.mode==="wordpress"?{kind:"wordpress",action:`%%PAGECRAFT_FORM_ENDPOINT:${t}%%`,method:"post",reason:"",note:"Handled by the connected WordPress site."}:o?{kind:"external",action:o,method:i,reason:"",note:"Sends entries to the configured external HTTPS destination."}:{kind:"disabled",action:"",method:i,reason:n?"unsafe":"missing",note:n?"Disabled until the destination is a complete HTTPS URL.":`${i.toUpperCase()} needs a complete HTTPS destination before publishing.`}}var ae=e=>JSON.parse(JSON.stringify(e)),Wt=e=>String(e).toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"page";var Be="index.html",Ut=[["is","is"],["not","is not"],["has","contains"],["set","has any value"],["unset","is empty"]],vt=(e,t,n,o)=>({"padding-top":e,"padding-right":t,"padding-bottom":n,"padding-left":o}),Vt={"padding-top":"13px","padding-right":"26px","padding-bottom":"13px","padding-left":"26px","border-radius":"8px","background-color":"var(--c-brand)"},v={size:["px","rem","em","vw"],len:["px","rem","%","vw","vh"],space:["px","rem","%"],radius:["px","rem","%"],line:["","px","em","%"],track:["em","px"],border:["px","rem"]},G="--pc-column-v-align";function oo(e){return[["follow",`Follow row \xB7 ${To(e)}`],["flex-start","Top"],["center","Center"],["flex-end","Bottom"]]}var kt={s:"system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",f:"Georgia,'Times New Roman',serif",d:"system-ui,-apple-system,sans-serif",m:"ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"},ro={s:"Sans serif",f:"Serif",d:"Display",m:"Monospace"},L="400;500;600;700",ot=[["Manrope","s",L],["DM Sans","s",L],["Inter","s",L],["Figtree","s",L],["Plus Jakarta Sans","s",L],["Work Sans","s",L],["Outfit","s",L],["Sora","s",L],["Space Grotesk","s","400;500;600;700"],["Epilogue","s",L],["Archivo","s",L],["Karla","s",L],["Rubik","s",L],["Poppins","s","400;500;600;700"],["Montserrat","s",L],["Raleway","s",L],["Nunito Sans","s",L],["Open Sans","s",L],["Lato","s","400;700"],["Roboto","s","400;500;700"],["Source Sans 3","s",L],["IBM Plex Sans","s","400;500;600;700"],["Mulish","s",L],["Public Sans","s",L],["Playfair Display","f","400;500;600;700"],["Fraunces","f",L],["Lora","f","400;500;600;700"],["Merriweather","f","400;700"],["Source Serif 4","f",L],["Crimson Pro","f",L],["Libre Baskerville","f","400;700"],["EB Garamond","f","400;500;600;700"],["Cormorant Garamond","f","400;500;600;700"],["Spectral","f","400;500;600;700"],["Newsreader","f",L],["DM Serif Display","f","400"],["Instrument Serif","f","400"],["Bebas Neue","d","400"],["Anton","d","400"],["Oswald","d","400;500;600;700"],["Archivo Black","d","400"],["Syne","d","400;500;600;700;800"],["Chivo","d",L],["JetBrains Mono","m","400;500;600;700"],["IBM Plex Mono","m","400;500;600;700"],["Space Mono","m","400;700"],["Roboto Mono","m",L],["Fira Code","m",L],["DM Mono","m","400;500"]],Gt=Object.fromEntries(ot.map(([e,t,n])=>[e.toLowerCase(),{fam:e,cat:t,w:n}])),io=(e,t)=>`'${e}',${kt[t]||kt.s}`;function ao(e){return String(e||"").split(",")[0].trim().replace(/^['"]|['"]$/g,"")}function so(){let e=new Set,t=o=>{let i=Gt[ao(o).toLowerCase()];i&&e.add(i.fam)};t(b.meta.font),t(b.meta.headFont);let n=o=>["d","t","m"].forEach(i=>{let r=(o&&o[i]||{})["font-family"];r&&t(r)});return at().forEach(o=>n(o.css)),Pe().forEach(o=>n(o.css)),zo().forEach(o=>Y(o,i=>n(i.css))),ot.map(([o])=>o).filter(o=>e.has(o))}function rt(){let e=so();return e.length?`https://fonts.googleapis.com/css2?${e.map(n=>`family=${n.replace(/ /g,"+")}:wght@${Gt[n.toLowerCase()].w}`).join("&")}&display=swap`:""}var lo=["latin","latin-ext"];function Yt(e,t=lo){let n=[],o=String(e||"").split(/\/\*\s*([a-z0-9-]+)\s*\*\//i);for(let i=1;i<o.length;i+=2){let r=o[i].toLowerCase();if(t.length&&!t.includes(r))continue;let a=o[i+1]||"";for(let s of a.matchAll(/@font-face\s*\{([^}]*)\}/g)){let l=s[1],p=m=>{let g=l.match(new RegExp(m+"\\s*:\\s*([^;]+)"));return g?g[1].trim():""},d=(l.match(/url\(([^)]+)\)/)||[,""])[1].replace(/['"]/g,""),u=p("font-family").replace(/['"]/g,"");!d||!u||n.push({family:u,weight:p("font-weight")||"400",style:p("font-style")||"normal",subset:r,url:d,range:p("unicode-range")})}}return n}function Kt(e,t){return e.map(n=>`@font-face{font-family:'${n.family}';font-style:${n.style};font-weight:${n.weight};font-display:swap;src:url('${t(n)}') format('woff2')${n.range?`;unicode-range:${n.range}`:""}}`).join(`
`)}function co(){let e=rt();return e?`<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${f(e)}">
`:""}var po=[["","Inherit"],["system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif","System sans"],["Georgia,'Times New Roman',serif","System serif"],["ui-monospace,SFMono-Regular,Menlo,Consolas,monospace","System monospace"]];function _e(){let e=[["Standard",po]];return["s","f","d","m"].forEach(t=>{e.push([ro[t]+" \u2014 Google Fonts",ot.filter(([,n])=>n===t).map(([n,o])=>[io(n,o),n])])}),e}var uo=[["","None"],["0 1px 2px rgba(17,19,17,.07)","Hairline"],["0 8px 20px -8px rgba(17,19,17,.18)","Soft"],["0 20px 44px -14px rgba(17,19,17,.28)","Elevated"],["0 34px 70px -22px rgba(17,19,17,.38)","Deep"]];var fo=[["","None"],["grayscale(1)","Greyscale"],["saturate(1.25)","Richer"],["contrast(1.1)","More contrast"],["blur(6px)","Blurred"],["brightness(.85)","Darker"]],go=[["repeat(2, minmax(0, 1fr))","2 across"],["repeat(3, minmax(0, 1fr))","3 across"],["repeat(4, minmax(0, 1fr))","4 across"],["repeat(6, minmax(0, 1fr))","6 across"],["repeat(auto-fit, minmax(240px, 1fr))","As many as fit"],["2fr 1fr","Wide then narrow"],["1fr 2fr","Narrow then wide"]];var be={section:{label:"Section",icon:"section",level:1,caps:["spacing","decoration","effects","animation"],make:()=>({props:{tag:"section",width:"boxed",inner:""},css:{d:{...vt("72px","24px","72px","24px")},t:{},m:{...vt("48px","20px","48px","20px")}}}),controls:{content:[{t:"pick",k:"width",label:"Content width",opts:[["boxed","Boxed"],["full","Full width"]],text:1},{t:"unit",c:"min-height",label:"Min height",layout:"inline",r:1,units:v.len},{t:"select",k:"tag",label:"HTML tag",layout:"inline",opts:[["section","section"],["div","div"],["header","header"],["footer","footer"],["main","main"],["article","article"],["aside","aside"]]}],style:[]}},row:{label:"Row",icon:"row",level:2,caps:["spacing","decoration","effects","animation"],make:()=>({props:{},css:{d:{gap:"24px","align-items":"stretch","justify-content":"flex-start"},t:{},m:{gap:"20px"}}}),controls:{content:[{t:"unit",c:"gap",label:"Gap",layout:"inline",r:1,units:v.space},{t:"pick",c:"align-items",label:"Vertical align",r:1,opts:[["flex-start","vTop"],["center","vMid"],["flex-end","vBot"],["baseline","Base"],["stretch","Fill"]]},{t:"select",c:"justify-content",label:"Distribution",r:1,opts:[["flex-start","Start"],["center","Center"],["flex-end","End"],["space-between","Space between"],["space-around","Space around"]]},{t:"select",c:"flex-wrap",label:"Wrap",r:1,opts:[["wrap","Wrap"],["nowrap","No wrap"]]},{t:"cols",label:"Columns"}],style:[]}},slider:{label:"Slider",icon:"slider",level:2,caps:["spacing","decoration","effects","animation"],make:()=>({props:{arrows:1,controlsPosition:"sides",aria:"Slides"},css:{d:{"--sl-gap":"24px","--sl-w":"calc((100% - 2 * var(--sl-gap,24px)) / 3)"},t:{"--sl-w":"calc((100% - var(--sl-gap,24px)) / 2)"},m:{"--sl-gap":"16px","--sl-w":"86%"}}}),controls:{content:[{t:"select",c:"--sl-w",label:"Slides in view",r:1,opts:[["100%","One"],["calc((100% - var(--sl-gap,24px)) / 2)","Two"],["calc((100% - 2 * var(--sl-gap,24px)) / 3)","Three"],["calc((100% - 3 * var(--sl-gap,24px)) / 4)","Four"],["86%","One and a peek"],["auto","As wide as their contents"]]},{t:"unit",c:"--sl-gap",label:"Gap",layout:"inline",r:1,units:v.space},{t:"select",k:"controlsPosition",label:"Controls position",opts:[["sides","Beside slides"],["bottom","Centered below"]]},{t:"toggle",k:"arrows",label:"Arrow buttons",note:"Hidden without JavaScript, where swiping and scrolling still work"},{t:"text",k:"aria",label:"Region name",ph:"Slides",note:"What a screen reader calls the scrollable area"}],style:[]}},list:{label:"Collection list",icon:"cms",level:2,caps:["spacing","decoration","effects","animation"],make:()=>({props:{collectionLayout:"grid",sort:"",dir:"asc",where:"",op:"is",limit:""},css:{d:{gap:"24px","align-items":"stretch","flex-wrap":"wrap"},t:{},m:{gap:"20px"}}}),controls:{content:[{t:"source",label:"Collection"},{t:"select",k:"collectionLayout",label:"Layout",opts:[["grid","Grid"],["slider","Slider"]]},{t:"select",k:"sort",label:"Sort by",opts:e=>[["","CMS order"],...(e.src&&K(e.src)?K(e.src).fields:[]).map(t=>[t.id,t.name])]},{t:"pick",k:"dir",label:"Direction",opts:[["asc","A\u2013Z"],["desc","Z\u2013A"]]},{t:"select",k:"where",label:"Filter",opts:e=>[["","Every item"],...(e.src&&K(e.src)?K(e.src).fields:[]).map(t=>[t.id,t.name])]},{t:"select",k:"op",label:"Test",opts:Ut,when:e=>!!e.props.where},{t:"text",k:"val",label:"Value",ph:"e.g. Journal",set:1,when:e=>{let t=e.props;return!!t.where&&t.op!=="set"&&t.op!=="unset"}},{t:"unit",k:"per",label:"Items per page",units:[""],ph:"all on one page",note:"Turns this page into one file per page of results."},{t:"unit",k:"limit",label:"Show at most",units:[""],ph:"all",note:"Items per page wins where both are set.",when:e=>!(parseInt(String(e.props.per||""),10)>0)},{t:"unit",c:"gap",label:"Gap",layout:"inline",r:1,units:v.space},{t:"pick",c:"align-items",label:"Vertical align",r:1,opts:[["flex-start","vTop"],["center","vMid"],["flex-end","vBot"],["baseline","Base"],["stretch","Fill"]]},{t:"select",c:"flex-wrap",label:"Wrap",r:1,opts:[["wrap","Wrap"],["nowrap","No wrap"]],when:e=>e.props.collectionLayout!=="slider"}],style:[]}},column:{label:"Column",icon:"column",level:3,alsoHolds:["row","slider","box"],caps:["spacing","decoration","effects","animation"],make:()=>({props:{},css:{d:{"flex-grow":"100",[G]:"follow","align-items":"stretch",gap:"16px"},t:{},m:{"flex-basis":"100%"}}}),controls:{content:[{t:"slider",c:"flex-grow",label:"Width (share)",r:1,min:5,max:100,step:.01,raw:1,when:St},{t:"unit",c:"flex-basis",label:"Min basis",layout:"inline",r:1,units:["%","px","rem"],note:"Set 100% to force a full-width stack.",when:St},{t:"select",c:G,label:"Vertical align",r:1,opts:oo,note:"Follows the parent row unless this column overrides it."},{t:"pick",c:"align-items",label:"Horizontal align",r:1,opts:[["flex-start","alignL"],["center","alignC"],["flex-end","alignR"],["stretch","Fill"]]},{t:"unit",c:"gap",label:"Gap",layout:"inline",r:1,units:v.space}],style:[]}},box:{label:"Box",icon:"section",level:2,takes:4,alsoHolds:["box","row","slider","column"],caps:["spacing","decoration","effects","animation"],make:()=>({props:{layout:"block",tag:"div",link:"",target:""},css:{d:{},t:{},m:{}}}),controls:{content:[{t:"select",k:"layout",label:"Layout",opts:[["block","Stacked"],["flex","Flex"],["grid","Grid"]]},{t:"pick",c:"flex-direction",label:"Direction",r:1,when:e=>e.props.layout==="flex",opts:[["row","Row"],["column","Column"]]},{t:"unit",c:"gap",label:"Gap",layout:"inline",r:1,units:v.space,when:e=>e.props.layout!=="block"},{t:"select",c:"justify-content",label:"Distribute",r:1,when:e=>e.props.layout!=="block",opts:[["flex-start","Start"],["center","Center"],["flex-end","End"],["space-between","Space between"],["space-around","Space around"]]},{t:"pick",c:"align-items",label:"Align",r:1,when:e=>e.props.layout!=="block",opts:[["flex-start","vTop"],["center","vMid"],["flex-end","vBot"],["stretch","Fill"]]},{t:"select",c:"flex-wrap",label:"Wrap",r:1,when:e=>e.props.layout==="flex",opts:[["wrap","Wrap"],["nowrap","No wrap"]]},{t:"select",c:"grid-template-columns",label:"Columns",r:1,when:e=>e.props.layout==="grid",opts:go},{t:"select",k:"tag",label:"HTML tag",layout:"inline",when:e=>!String(e.props.link||"").trim(),opts:[["div","div"],["article","article"],["aside","aside"],["nav","nav"],["header","header"],["footer","footer"],["main","main"],["section","section"],["ul","ul"],["ol","ol"],["li","li"]]},{t:"link",k:"link",label:"Link",note:"A whole box that is one link."}],style:[]}},heading:{label:"Heading",icon:"heading",level:4,edit:"text",styleLabel:"Typography & fill",caps:["spacing","effects","typography","animation"],make:()=>({props:{text:"A headline that carries weight",level:"h2",link:"",target:"",ts:"title"},css:{d:{"text-align":"left","margin-bottom":"0px"},t:{},m:{}}}),controls:{content:[{t:"area",k:"text",label:"Heading text",rows:2,mono:0},{t:"tstyle",k:"ts",label:"Text style"},{t:"select",k:"level",label:"HTML tag",layout:"inline",opts:[["h1","H1"],["h2","H2"],["h3","H3"],["h4","H4"],["h5","H5"],["h6","H6"],["p","p"],["div","div"]]},{t:"pick",c:"text-align",label:"Alignment",r:1,opts:[["left","alignL"],["center","alignC"],["right","alignR"]]},{t:"link",k:"link",label:"Link"}],style:[{t:"unit",c:"font-size",label:"Size",layout:"inline",r:1,units:v.size},{t:"color",c:"color",label:"Colour",layout:"inline",r:1},{t:"select",c:"font-weight",label:"Weight",layout:"inline",r:1,opts:[["","Default"],["300","Light 300"],["400","Regular 400"],["500","Medium 500"],["600","Semibold 600"],["700","Bold 700"],["800","Extrabold 800"],["900","Black 900"]]},{t:"unit",c:"line-height",label:"Line height",layout:"inline",r:1,units:v.line},{t:"unit",c:"letter-spacing",label:"Letter spacing",r:1,neg:1,units:v.track},{t:"opt",c:"font-family",label:"Font",r:1,og:_e,ph:"'Family',sans-serif"},{t:"select",c:"text-transform",label:"Transform",r:1,opts:[["","None"],["uppercase","UPPERCASE"],["lowercase","lowercase"],["capitalize","Capitalize"]]}]}},text:{label:"Rich text",icon:"text",level:4,edit:"rich",styleLabel:"Typography & fill",caps:["spacing","effects","typography","animation"],make:()=>({props:{html:"<p>Double-click to edit this block. A floating toolbar gives you <strong>bold</strong>, <em>italic</em>, links, lists and headings \u2014 everything exports as clean semantic HTML.</p>",ts:"body"},css:{d:{"text-align":"left"},t:{},m:{}}}),controls:{content:[{t:"rich",k:"html",label:"Rich text"},{t:"tstyle",k:"ts",label:"Text style"},{t:"pick",c:"text-align",label:"Alignment",r:1,opts:[["left","alignL"],["center","alignC"],["right","alignR"],["justify","alignJ"]]}],style:[{t:"unit",c:"font-size",label:"Size",layout:"inline",r:1,units:v.size},{t:"color",c:"color",label:"Colour",r:1,layout:"inline"},{t:"unit",c:"line-height",label:"Line height",layout:"inline",r:1,units:v.line},{t:"opt",c:"font-family",label:"Font",r:1,og:_e,ph:"'Family',sans-serif"},{t:"color",c:"--link",label:"Link colour",r:1}]}},quote:{label:"Quote",icon:"quote",level:4,edit:"text",styleLabel:"Typography & fill",caps:["spacing","decoration","effects","typography","animation"],make:()=>({props:{text:"A sentence in their words that a prospect would recognise as their own problem, solved.",by:"Name, Role at Company",source:"",ts:"lead"},css:{d:{"font-size":"24px","line-height":"1.45",color:M("ink"),"max-width":"34ch","align-self":"flex-start"},t:{},m:{"font-size":"20px"}}}),controls:{content:[{t:"area",k:"text",label:"Quotation",rows:3,mono:0,note:"No quotation marks \u2014 the style draws them."},{t:"text",k:"by",label:"Attribution",ph:"Name, Role at Company",note:"Empty exports a bare blockquote; named adds a caption."},{t:"text",k:"source",label:"Source URL",ph:"https://\u2026",note:"Links the attribution, and records the source."},{t:"tstyle",k:"ts",label:"Text style"},{t:"pick",c:"align-self",label:"Alignment",r:1,opts:[["flex-start","alignL"],["center","alignC"],["flex-end","alignR"]]}],style:[{t:"unit",c:"font-size",label:"Size",layout:"inline",r:1,units:v.size},{t:"color",c:"color",label:"Colour",r:1,layout:"inline"},{t:"unit",c:"line-height",label:"Line height",layout:"inline",r:1,units:v.line},{t:"opt",c:"font-family",label:"Font",r:1,og:_e,ph:"'Family',sans-serif"},{t:"unit",c:"max-width",label:"Measure",layout:"inline",r:1,units:["ch","px","rem","%"],note:"How wide the lines may run. 34ch reads well."},{t:"pick",c:"text-align",label:"Text alignment",r:1,opts:[["left","alignL"],["center","alignC"],["right","alignR"]]},{t:"color",c:"border-left-color",label:"Rule colour",r:1,layout:"inline"},{t:"unit",c:"border-left-width",label:"Rule width",layout:"inline",r:1,units:v.border},{t:"box",c:"padding",label:"Padding",r:1}]}},image:{label:"Image",icon:"image",level:4,caps:["spacing","effects","animation"],make:()=>({props:{src:"",alt:"",link:"",target:"",caption:"",label:"",lazy:1,w:"",h:"",decorative:0},css:{d:{width:"100%","max-width":"100%","border-radius":"10px","object-fit":"cover","align-self":"flex-start"},t:{},m:{}}}),controls:{content:[{t:"img",k:"src",label:"Image source"},{t:"text",k:"alt",label:"Alt text",ph:"Describe the image"},{t:"toggle",k:"decorative",label:"Decorative image",note:"Screen readers skip decorative images."},{t:"text",k:"label",label:"Link label",ph:"What the link opens",note:"Names the link while the decorative image stays hidden from screen readers.",when:e=>(!!e.props.decorative||!!e.bind?.decorative)&&(!!String(e.props.link||"").trim()||!!e.bind?.link)},{t:"dims",label:"Intrinsic size",note:"Stops the page shifting as it loads."},{t:"text",k:"caption",label:"Caption",ph:"Optional"},{t:"link",k:"link",label:"Link"},{t:"pick",c:"align-self",label:"Alignment",r:1,opts:[["flex-start","alignL"],["center","alignC"],["flex-end","alignR"],["stretch","Fill"]]},{t:"toggle",k:"lazy",label:"Lazy load"}],style:[{t:"unit",c:"width",label:"Width",layout:"inline",r:1,units:v.len},{t:"unit",c:"height",label:"Height",layout:"inline",r:1,units:v.len},{t:"select",c:"object-fit",label:"Fit",r:1,opts:[["cover","Cover"],["contain","Contain"],["fill","Fill"],["none","None"]]},{t:"unit",c:"border-radius",label:"Radius",layout:"inline",r:1,units:v.radius},{t:"slider",c:"opacity",label:"Opacity",r:1,min:0,max:1,step:.01,raw:1},{t:"opt",c:"filter",label:"Filter",r:1,opts:fo,ph:"grayscale(1) blur(2px)"}]}},video:{label:"Video",icon:"video",level:4,caps:["spacing","effects","animation"],make:()=>({props:{src:"https://www.youtube.com/watch?v=aqz-KE-bpKQ",ratio:"16 / 9",autoplay:0,loop:0,muted:1,controls:1,poster:"",facade:1},css:{d:{width:"100%","border-radius":"10px",overflow:"hidden"},t:{},m:{}}}),controls:{content:[{t:"text",k:"src",label:"Video URL",ph:"YouTube, Vimeo or .mp4"},{t:"select",k:"ratio",label:"Aspect ratio",opts:[["16 / 9","16:9"],["4 / 3","4:3"],["1 / 1","1:1"],["21 / 9","21:9"],["9 / 16","9:16 vertical"]]},{t:"img",k:"poster",label:"Poster image"},{t:"toggle",k:"facade",label:"Load player on click",when:e=>!e.props.autoplay&&["youtube","vimeo"].includes(Le(e.props).kind)},{t:"toggle",k:"controls",label:"Show controls"},{t:"toggle",k:"autoplay",label:"Autoplay",note:"Autoplay videos play without sound."},{t:"toggle",k:"muted",label:"Muted",when:e=>!e.props.autoplay},{t:"toggle",k:"loop",label:"Loop"}],style:[{t:"unit",c:"width",label:"Width",layout:"inline",r:1,units:v.len},{t:"unit",c:"border-radius",label:"Radius",layout:"inline",r:1,units:v.radius}]}},button:{label:"Button",icon:"button",level:4,edit:"text",caps:["spacing","decoration","effects","typography","animation"],make:()=>({props:{text:"Get started",link:"",target:"",variant:"solid",icon:"none",align:"flex-start",wrap:"inline-flex",ts:"btn"},css:{d:{"--pc-solid-fg":Rt(),"align-self":"flex-start",...Vt},t:{},m:{}}}),controls:{content:[{t:"text",k:"text",label:"Label"},{t:"tstyle",k:"ts",label:"Text style"},{t:"link",k:"link",label:"Link"},{t:"select",k:"variant",label:"Variant",opts:[["solid","Solid"],["outline","Outline"],["ghost","Ghost"],["link","Text link"]]},{t:"select",k:"icon",label:"Trailing icon",opts:[["none","None"],["arrow","Arrow"],["check","Check"],["plus","Plus"]]},{t:"pick",c:"align-self",label:"Alignment",r:1,opts:[["flex-start","alignL"],["center","alignC"],["flex-end","alignR"],["stretch","Fill"]]},{t:"select",c:"margin-top",label:"Position",r:1,opts:[["","In the normal flow"],["auto","Push to column bottom"]],note:"Uses the column\u2019s remaining height above this button.",when:e=>!!q(e.id)?.parent&&q(e.id).parent.type==="column"}],style:[{t:"color",c:"background-color",label:"Background",r:1},{t:"color",c:"color",label:"Text colour",r:1,layout:"inline"},{t:"unit",c:"font-size",label:"Size",layout:"inline",r:1,units:v.space},{t:"select",c:"font-weight",label:"Weight",r:1,layout:"inline",opts:[["400","400"],["500","500"],["600","600"],["700","700"]]},{t:"unit",c:"border-radius",label:"Radius",layout:"inline",r:1,units:v.radius},{t:"unit",c:"letter-spacing",label:"Letter spacing",r:1,neg:1,units:v.track},{t:"select",c:"text-transform",label:"Transform",r:1,opts:[["","None"],["uppercase","UPPERCASE"]]}]}},nav:{label:"Nav menu",icon:"nav",level:4,caps:["spacing","decoration","effects","typography","animation"],make:()=>({props:{items:[{label:"Work",href:Be},{label:"About",href:Be},{label:"Contact",href:Be}],collapse:"mobile",mobileMenu:"dropdown",aria:"Main"},css:{d:{"font-size":"15px","font-weight":"500",color:M("muted"),"align-self":"center","justify-content":"flex-end",width:"100%","--nav-hover":M("ink"),"--nav-gap":"26px","--nav-panel":M("bg")},t:{},m:{}}}),controls:{content:[{t:"items",k:"items",label:"Menu links"},{t:"select",k:"collapse",label:"Collapse at",opts:[["mobile","On mobile (\u2264767px)"],["tablet","On tablet and below (\u22641024px)"],["never","Never \u2014 always inline"]]},{t:"select",k:"mobileMenu",label:"Mobile menu",opts:[["dropdown","Full-width dropdown"],["fullscreen","Fullscreen"]]},{t:"pick",c:"justify-content",label:"Alignment",r:1,opts:[["flex-start","alignL"],["center","alignC"],["flex-end","alignR"]]},{t:"text",k:"aria",label:"Accessible name",ph:"Main",note:"Read by screen readers as \u201C<name> menu\u201D."}],style:[{t:"unit",c:"--nav-gap",label:"Link spacing",r:1,units:v.space},{t:"unit",c:"font-size",label:"Size",layout:"inline",r:1,units:v.space},{t:"select",c:"font-weight",label:"Weight",r:1,layout:"inline",opts:[["400","400"],["500","500"],["600","600"],["700","700"]]},{t:"color",c:"color",label:"Link colour",r:1},{t:"color",c:"--nav-hover",label:"Hover colour",r:1},{t:"color",c:"--nav-panel",label:"Menu background",r:1,when:e=>!e.props.managedMobileLinks},{t:"unit",c:"letter-spacing",label:"Letter spacing",r:1,neg:1,units:v.track},{t:"select",c:"text-transform",label:"Transform",r:1,opts:[["","None"],["uppercase","UPPERCASE"]]}]}},form:{label:"Form",icon:"form",level:4,caps:["spacing","decoration","effects","typography","animation"],make:()=>({props:{mode:"external",action:"",method:"post",submit:"Send",aria:"Contact form",fields:[{type:"text",label:"Name",name:"name",required:1,ph:""},{type:"email",label:"Email",name:"email",required:1,ph:""},{type:"textarea",label:"Message",name:"message",required:0,ph:""}]},css:{d:{width:"100%","--f-gap":"16px","--f-radius":"8px","--f-pad":"11px 13px","--f-bg":M("surface"),"--f-border":M("line"),"--f-text":M("text"),"--f-label":M("muted"),"--f-btn-bg":M("brand"),"--f-btn-fg":Rt(),"font-size":"15px"},t:{},m:{}}}),controls:{content:[{t:"fields",k:"fields",label:"Fields"},{t:"text",k:"submit",label:"Submit button label"},{t:"select",k:"mode",label:"Handling",opts:[["external","External HTTPS endpoint"],["wordpress","WordPress managed"]]},{t:"text",k:"action",label:"Where submissions go",ph:"Paste an HTTPS destination",note:"Paste your service\u2019s complete HTTPS URL. On Cloud, a blank POST form saves to Submissions.",when:e=>wt()||e.props.mode!=="wordpress"},{t:"select",k:"method",label:"Method",layout:"inline",opts:[["post","POST"],["get","GET"]],when:e=>wt()||e.props.mode!=="wordpress"},{t:"text",k:"aria",label:"Accessible name",ph:"Contact form"}],style:[{t:"select",c:"--f-layout",label:"Field layout",r:1,opts:[["flex","Wrapped fields"],["grid","Grid"]]},{t:"select",c:"--f-columns",label:"Grid columns",r:1,when:e=>Ie(e,Jt(),"--f-layout")==="grid",opts:[["1fr","One"],["repeat(2,minmax(0,1fr))","Two"],["repeat(3,minmax(0,1fr))","Three"],["repeat(4,minmax(0,1fr))","Four"]]},{t:"select",c:"--f-button-align",label:"Alignment",r:1,opts:[["flex-start","Top"],["end","Bottom"]]},{t:"unit",c:"--f-gap",label:"Field spacing",r:1,units:v.space},{t:"unit",c:"font-size",label:"Size",layout:"inline",r:1,units:v.size},{t:"color",c:"--f-bg",label:"Field background",r:1},{t:"color",c:"--f-border",label:"Field border",r:1},{t:"color",c:"--f-text",label:"Field text",r:1},{t:"color",c:"--f-label",label:"Label colour",r:1},{t:"unit",c:"--f-radius",label:"Field radius",r:1,units:v.radius},{t:"color",c:"--f-btn-bg",label:"Button background",r:1},{t:"color",c:"--f-btn-fg",label:"Button text",r:1}]}},spacer:{label:"Spacer",icon:"spacer",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{},css:{d:{height:"48px"},t:{},m:{height:"32px"}}}),controls:{content:[{t:"unit",c:"height",label:"Height",layout:"inline",r:1,units:v.len}],style:[]}},divider:{label:"Divider",icon:"divider",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{},css:{d:{"border-top-width":"1px","border-top-style":"solid","border-top-color":M("line"),width:"100%","margin-top":"20px","margin-bottom":"20px"},t:{},m:{}}}),controls:{content:[{t:"unit",c:"border-top-width",label:"Thickness",layout:"inline",r:1,units:v.border},{t:"select",c:"border-top-style",label:"Style",r:1,opts:[["solid","Solid"],["dashed","Dashed"],["dotted","Dotted"]]},{t:"color",c:"border-top-color",label:"Colour",r:1,layout:"inline"},{t:"unit",c:"width",label:"Width",layout:"inline",r:1,units:v.len}],style:[]}},crumbs:{label:"Breadcrumb",icon:"crumbs",level:4,caps:["spacing","effects","typography","animation"],make:()=>({props:{mode:"auto",home:"Home",sep:"chevron"},css:{d:{"--cb-size":"13px","--cb-color":M("muted"),"--cb-current":M("text"),"--cb-gap":"8px","--cb-weight":"500"},t:{},m:{}}}),controls:{content:[{t:"pick",k:"mode",label:"Trail",set:1,r:0,opts:[["auto","From the page"],["manual","Written here"]]},{t:"text",k:"home",label:"Front page is called",ph:"Home",when:e=>e.props.mode!=="manual"},{t:"items",k:"items",label:"Crumbs",when:e=>e.props.mode==="manual"},{t:"select",k:"sep",label:"Separator",set:1,opts:[["chevron","\u203A"],["slash","/"],["dot","\xB7"],["dash","\u2014"]]}],style:[{t:"unit",c:"--cb-size",label:"Text size",layout:"inline",r:1,units:v.size},{t:"color",c:"--cb-color",label:"Link colour",r:1},{t:"color",c:"--cb-current",label:"Current page colour",r:1},{t:"unit",c:"--cb-gap",label:"Spacing",layout:"inline",r:1,units:v.space}]}},code:{label:"Code",icon:"codeblock",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{body:`const site = build({
  pages: 12,
  scripts: 0   // nothing to run
});`,lang:"js",numbers:0,softwrap:0,copy:1},css:{d:{width:"100%","--cd-bg":M("bg"),"--cd-text":M("text"),"--cd-size":"14px","--cd-pad":"16px 18px","--cd-radius":"10px","--cd-line":M("line"),"--cd-com":M("muted"),"--cd-str":"#2f6f5e","--cd-kw":"#8a4b2a","--cd-num":"#3a5a9a","--cd-key":"#5b4a8a"},t:{},m:{"--cd-size":"13px","--cd-pad":"12px 13px"}}}),controls:{content:[{t:"area",k:"body",label:"Code",rows:9,mono:1,ph:"const x = 1;"},{t:"select",k:"lang",label:"Language",set:1,opts:()=>Object.keys(Ae).map(e=>[e,Ae[e].label])},{t:"text",k:"title",label:"File name",ph:"index.js"},{t:"toggle",k:"numbers",label:"Number the lines"},{t:"toggle",k:"softwrap",label:"Wrap long lines"},{t:"toggle",k:"copy",label:"Copy button",note:"Hidden unless the browser can copy, so it is never a button that does nothing"}],style:[{t:"color",c:"--cd-bg",label:"Background",r:1},{t:"color",c:"--cd-text",label:"Text colour",r:1,layout:"inline"},{t:"unit",c:"--cd-size",label:"Text size",layout:"inline",r:1,units:v.size},{t:"unit",c:"--cd-pad",label:"Padding",r:1,units:v.space},{t:"unit",c:"--cd-radius",label:"Radius",layout:"inline",r:1,units:v.radius},{t:"color",c:"--cd-com",label:"Comments",r:1,layout:"inline",when:e=>e.props.lang!=="text"},{t:"color",c:"--cd-str",label:"Strings",r:1,layout:"inline",when:e=>e.props.lang!=="text"},{t:"color",c:"--cd-kw",label:"Keywords",r:1,layout:"inline",when:e=>e.props.lang!=="text"},{t:"color",c:"--cd-num",label:"Numbers",r:1,layout:"inline",when:e=>e.props.lang!=="text"},{t:"color",c:"--cd-key",label:"Names",r:1,layout:"inline",when:e=>e.props.lang!=="text"}]}},table:{label:"Table",icon:"table",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{body:`Plan|Monthly|Seats
Starter|\xA39|1
Studio|\xA329|5
House|\xA379|20`,head:1,rules:"rows",zebra:0},css:{d:{width:"100%","--tbl-size":"15px","--tbl-pad":"10px 12px","--tbl-line":M("line"),"--tbl-text":M("text"),"--tbl-head-bg":"transparent","--tbl-head-text":M("ink"),"--tbl-head-weight":"600","--tbl-zebra":M("bg"),"--tbl-caption-size":"13px","--tbl-caption-color":M("muted")},t:{},m:{"--tbl-size":"14px","--tbl-pad":"8px 10px"}}}),controls:{content:[{t:"area",k:"body",label:"Rows",rows:7,mono:1,ph:`Plan|Monthly|Seats
Starter|\xA39|1`,note:"One row per line. Paste from a spreadsheet, or separate cells with |"},{t:"text",k:"caption",label:"Caption",ph:"What this table shows"},{t:"toggle",k:"head",label:"First row is a heading"},{t:"toggle",k:"rowhead",label:"First column is a heading"},{t:"select",k:"rules",label:"Lines",set:1,opts:[["rows","Between rows"],["all","Full grid"],["none","None"]]},{t:"toggle",k:"zebra",label:"Shade alternate rows"}],style:[{t:"unit",c:"--tbl-size",label:"Text size",layout:"inline",r:1,units:v.size},{t:"color",c:"--tbl-text",label:"Text colour",r:1,layout:"inline"},{t:"unit",c:"--tbl-pad",label:"Cell padding",layout:"inline",r:1,units:v.space},{t:"color",c:"--tbl-line",label:"Line colour",r:1,layout:"inline"},{t:"color",c:"--tbl-head-bg",label:"Header background",r:1,when:e=>!!(e.props.head||e.props.rowhead)},{t:"color",c:"--tbl-head-text",label:"Heading colour",r:1,when:e=>!!(e.props.head||e.props.rowhead)},{t:"color",c:"--tbl-zebra",label:"Shading",r:1,layout:"inline",when:e=>!!e.props.zebra},{t:"color",c:"--tbl-caption-color",label:"Caption colour",r:1,when:e=>!!String(e.props.caption||"").trim()}]}},tabs:{label:"Tabs",icon:"tabs",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{items:[{label:"Overview",panel:"What this is, in a sentence or two."},{label:"Details",panel:"The part someone came looking for."},{label:"Pricing",panel:"The number, plainly."}]},css:{d:{width:"100%","--tb-align":"flex-start","--tb-line":M("line"),"--tb-on":M("ink"),"--tb-off":M("muted"),"--tb-size":"15px","--tb-weight":"500","--tb-pad":"10px 2px","--tb-gap":"22px","--tb-body-size":"16px","--tb-body-color":M("text"),"--tb-body-pad":"20px"},t:{},m:{"--tb-gap":"16px","--tb-size":"14px"}}}),controls:{content:[{t:"qa",k:"items",label:"Tabs",rowKeys:["label","panel"],rowPhs:["Tab label","What this tab says"],rowNew:["New tab",""],addLabel:"Add tab"},{t:"pick",c:"--tb-align",label:"Tabs sit",r:1,opts:[["flex-start","alignL"],["center","alignC"],["flex-end","alignR"]]}],style:[{t:"color",c:"--tb-on",label:"Selected label",r:1},{t:"color",c:"--tb-off",label:"Other labels",r:1},{t:"color",c:"--tb-line",label:"Rule",r:1},{t:"unit",c:"--tb-size",label:"Label size",layout:"inline",r:1,units:v.size},{t:"unit",c:"--tb-gap",label:"Label spacing",r:1,units:v.space},{t:"unit",c:"--tb-body-size",label:"Body size",layout:"inline",r:1,units:v.size},{t:"color",c:"--tb-body-color",label:"Body colour",r:1,layout:"inline"},{t:"unit",c:"--tb-body-pad",label:"Body padding",r:1,units:v.space}]}},accordion:{label:"Accordion",icon:"accordion",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{items:[{q:"What do I get?",a:"One paragraph that answers the question plainly."},{q:"How long does it take?",a:"Say the real number. A range is fine; a dodge is not."},{q:"What does it cost?",a:"The answer people scrolled this far to find."}],open:"first",single:0,marker:"plus"},css:{d:{width:"100%","--ac-line":M("line"),"--ac-pad":"18px","--ac-gap":"0px","--ac-q-size":"17px","--ac-q-weight":"600","--ac-q-color":M("ink"),"--ac-a-size":"16px","--ac-a-color":M("muted"),"--ac-mark":M("slate"),"--ac-radius":"0px"},t:{},m:{"--ac-pad":"15px","--ac-q-size":"16px"}}}),controls:{content:[{t:"qa",k:"items",label:"Questions",rowNew:["A new question",""]},{t:"select",k:"open",label:"Open on load",opts:[["none","All closed"],["first","The first one"],["all","All open"]]},{t:"toggle",k:"single",label:"One open at a time"},{t:"select",k:"marker",label:"Marker",opts:[["plus","Plus / minus"],["caret","Caret"],["none","None"]]}],style:[{t:"color",c:"--ac-line",label:"Divider colour",r:1},{t:"unit",c:"--ac-pad",label:"Row padding",r:1,units:v.space},{t:"unit",c:"--ac-gap",label:"Row gap",layout:"inline",r:1,units:v.space},{t:"unit",c:"--ac-q-size",label:"Question size",r:1,units:v.size},{t:"select",c:"--ac-q-weight",label:"Question weight",r:1,opts:[["400","400"],["500","500"],["600","600"],["700","700"]]},{t:"color",c:"--ac-q-color",label:"Question colour",r:1},{t:"unit",c:"--ac-a-size",label:"Answer size",layout:"inline",r:1,units:v.size},{t:"color",c:"--ac-a-color",label:"Answer colour",r:1},{t:"color",c:"--ac-mark",label:"Marker colour",r:1},{t:"unit",c:"--ac-radius",label:"Row radius",layout:"inline",r:1,units:v.radius}]}},embed:{label:"Embed",icon:"code",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{html:"",ratio:""},css:{d:{width:"100%"},t:{},m:{}}}),controls:{content:[{t:"area",k:"html",label:"HTML",rows:8,mono:1,ph:'<iframe src="\u2026" \u2026></iframe>',note:"Runs on the exported site, not in this canvas."},{t:"select",k:"ratio",label:"Aspect ratio",opts:[["","Auto"],["16 / 9","16:9"],["4 / 3","4:3"],["1 / 1","1:1"],["21 / 9","21:9"],["9 / 16","9:16 vertical"]],note:"Pick one for an iframe with no height of its own."}],style:[]}},icon:{label:"Icon",icon:"icon",level:4,caps:["spacing","effects","animation"],make:()=>({props:{name:"check",label:"",link:"",target:""},css:{d:{"--icon-size":"30px","--icon-stroke":"1.75",color:M("ink"),"align-self":"flex-start"},t:{},m:{}}}),controls:{content:[{t:"icon",k:"name",label:"Icon"},{t:"text",k:"label",label:"Accessible label",ph:"Leave empty if decorative",note:"Empty is hidden from screen readers."},{t:"link",k:"link",label:"Link"},{t:"pick",c:"align-self",label:"Alignment",r:1,opts:[["flex-start","alignL"],["center","alignC"],["flex-end","alignR"]]}],style:[{t:"unit",c:"--icon-size",label:"Glyph size",layout:"inline",r:1,units:v.size},{t:"color",c:"color",label:"Colour",r:1,layout:"inline"},{t:"slider",c:"--icon-stroke",label:"Stroke weight",r:1,min:1,max:3,step:.05,raw:1},{t:"color",c:"background-color",label:"Badge background",r:1},{t:"box",c:"padding",label:"Badge padding",r:1},{t:"unit",c:"border-radius",label:"Badge radius",r:1,units:v.radius}]}},gallery:{label:"Gallery",icon:"gallery",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{items:[],ratio:"4 / 3",fit:"cover",lightbox:1,lazy:1,captions:0},css:{d:{width:"100%","--g-cols":"3","--g-gap":"12px","--g-radius":"10px"},t:{},m:{"--g-cols":"2","--g-gap":"8px"}}}),controls:{content:[{t:"imgs",k:"items",label:"Images"},{t:"unit",c:"--g-cols",label:"Columns",r:1,min:1,integer:1,units:[""],note:"Responsive \u2014 set fewer on Tablet and Mobile."},{t:"select",k:"ratio",label:"Tile shape",opts:[["4 / 3","4:3"],["1 / 1","Square"],["3 / 2","3:2"],["16 / 9","16:9"],["3 / 4","3:4 portrait"],["","Whatever each image is"]]},{t:"select",k:"fit",label:"Fit",opts:[["cover","Cover \u2014 fill and crop"],["contain","Contain \u2014 fit inside"]]},{t:"toggle",k:"lightbox",label:"Open full size on click"},{t:"toggle",k:"captions",label:"Show captions under each tile"},{t:"toggle",k:"lazy",label:"Lazy load"}],style:[{t:"unit",c:"--g-gap",label:"Gap",layout:"inline",r:1,units:v.space},{t:"unit",c:"--g-radius",label:"Tile radius",layout:"inline",r:1,units:v.radius}]}}};function mo(e){for(let t of b.pages){if(t.collection)continue;let n=!1;if(Y(t.tree,o=>{o.type==="list"&&o.src===e&&(n=!0)}),n)return t}return null}function Xt(e,t={},n="Home"){if(!e)return[];let o=b.pages.find(Me)||null,i=[];if(o&&!Me(e)&&i.push({label:n||o.name,href:gn+".html"}),t.col&&t.item){let a=mo(t.col.id);return a&&i.push({label:a.name,href:a.slug+".html"}),i.push({label:Yo(t.col,t.item)||t.item.slug,href:""}),i}let r=t.pageNo||1;return r>1?(i.push({label:e.name,href:e.slug+".html"}),i.push({label:`Page ${r}`,href:""}),i):(Me(e)?i.push({label:n||e.name,href:""}):i.push({label:e.name,href:""}),i)}function ho(e){let t=!1;return e.forEach(n=>Y(n,o=>{o.type==="crumbs"&&o.props.mode!=="manual"&&(t=!0)})),t}var Ae={text:{label:"Plain text"},html:{label:"HTML",markup:1},css:{label:"CSS",block:["/*","*/"],keys:1,calls:1},js:{label:"JavaScript",line:"//",block:["/*","*/"],calls:1,words:"const let var function return if else for while of in new class extends super import export from default await async try catch finally throw typeof instanceof delete void yield switch case break continue do this null undefined true false"},ts:{label:"TypeScript",line:"//",block:["/*","*/"],calls:1,words:"const let var function return if else for while of in new class extends super import export from default await async try catch finally throw typeof instanceof delete void yield switch case break continue do this null undefined true false interface type enum implements readonly public private protected as satisfies keyof namespace declare"},json:{label:"JSON",keys:1,words:"true false null"},sh:{label:"Shell",line:"#",words:"if then elif else fi for in do done while until case esac function return export local readonly cd echo printf set unset source exit sudo"},py:{label:"Python",line:"#",calls:1,words:"def class return if elif else for while in not and or is None True False import from as with try except finally raise lambda yield pass break continue global nonlocal assert del await async match"}};function W(e,t){return t.split(`
`).map(n=>n===""?"":`<span class="pc-c-${e}">${f(n)}</span>`).join(`
`)}function bo(e){let t=/^(<\/?)([A-Za-z][\w:-]*)([\s\S]*?)(\/?>)$/.exec(e);if(!t)return f(e);let n=t[3],o="",i=0,r,a=/([A-Za-z_:][\w:.-]*)(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)?/g;for(;r=a.exec(n);)r.index>i&&(o+=f(n.slice(i,r.index))),o+=W("key",r[1])+f(r[2]||""),r[3]&&(o+=W("str",r[3])),i=r.index+r[0].length;return f(t[1])+W("kw",t[2])+o+f(n.slice(i))+f(t[4])}function yo(e){let t=[],n=/<!\x2D\x2D[\s\S]*?\x2D\x2D>|<![A-Za-z][^>]*>|<\/?[A-Za-z][\w:-]*(?:"[^"]*"|'[^']*'|[^>"'])*\/?>/g,o=0,i;for(;i=n.exec(e);){i.index>o&&t.push(f(e.slice(o,i.index)));let r=i[0];t.push(r.startsWith("<!-")?W("com",r):r.startsWith("<!")?W("kw",r):bo(r)),o=i.index+r.length}return t.push(f(e.slice(o))),t.join("")}function xo(e,t){let n=String(e??"").replace(/\r/g,""),o=Ae[String(t||"text")]||Ae.text;if(o.markup)return yo(n);if(!o.line&&!o.block&&!o.words&&!o.keys)return f(n);let i=new Set((o.words||"").split(/\s+/).filter(Boolean)),r=[],a=0;for(;a<n.length;){let s=n.slice(a);if(o.block&&s.startsWith(o.block[0])){let g=n.indexOf(o.block[1],a+o.block[0].length),$=g<0?n.length:g+o.block[1].length;r.push(W("com",n.slice(a,$))),a=$;continue}if(o.line&&s.startsWith(o.line)){let g=n.indexOf(`
`,a),$=g<0?n.length:g;r.push(W("com",n.slice(a,$))),a=$;continue}let l=s[0];if(l==='"'||l==="'"||l==="`"){let g=a+1;for(;g<n.length;){if(n[g]==="\\"){g+=2;continue}if(n[g]===l){g++;break}g++}let $=Math.min(g,n.length),C=o.keys&&/^\s*:/.test(n.slice($));r.push(W(C?"key":"str",n.slice(a,$))),a=$;continue}let p=/^\d[\w.]*/.exec(s);if(p){r.push(W("num",p[0])),a+=p[0].length;continue}let d=/^[A-Za-z_$@][\w$-]*/.exec(s);if(d){let g=d[0],$=s.slice(g.length);i.has(g)?r.push(W("kw",g)):o.keys&&/^\s*:/.test($)?r.push(W("key",g)):o.calls&&/^\s*\(/.test($)?r.push(W("fn",g)):r.push(f(g)),a+=g.length;continue}let u=/^[^\w$@'"`]+/.exec(s),m=u?u[0]:s[0];if(u&&o.block){let g=m.indexOf(o.block[0]);g>0&&(m=m.slice(0,g))}if(u&&o.line){let g=m.indexOf(o.line);g>0&&(m=m.slice(0,g))}r.push(f(m)),a+=m.length}return r.join("")}var wo=`<script>
(function(){var rm=matchMedia('(prefers-reduced-motion: reduce)');
Array.prototype.forEach.call(document.querySelectorAll('[data-slides]'),function(t){
function seek(left){t.scrollTo({left:left,behavior:rm.matches?'auto':'smooth'});}
t.addEventListener('keydown',function(event){if(event.target!==t||event.key!=='Home'&&event.key!=='End')return;
event.preventDefault();seek(event.key==='Home'?0:Math.max(0,t.scrollWidth-t.clientWidth));});});
Array.prototype.forEach.call(document.querySelectorAll('[data-slider]'),function(box){
var t=box.querySelector('[data-slides]'),p=box.querySelector('[data-slide-p]'),n=box.querySelector('[data-slide-n]'),d=box.querySelector('[data-slide-dots]');
if(!t||!p||!n||!d)return;p.removeAttribute('hidden');n.removeAttribute('hidden');d.removeAttribute('hidden');
function go(d){t.scrollBy({left:d*t.clientWidth*0.9,behavior:rm.matches?'auto':'smooth'});}
p.addEventListener('click',function(){go(-1);});n.addEventListener('click',function(){go(1);});
var slides=[].slice.call(t.children),targets=[],dots=[];
function positions(){var max=Math.max(0,t.scrollWidth-t.clientWidth),next=[];
slides.forEach(function(slide){var target=Math.min(max,Math.max(0,slide.offsetLeft-t.offsetLeft));
if(!next.some(function(value){return Math.abs(value-target)<3;}))next.push(target);});return next;}
function active(){if(!targets.length)return;var current=0,distance=Infinity;
targets.forEach(function(target,index){var delta=Math.abs(t.scrollLeft-target);if(delta<distance){distance=delta;current=index;}});
dots.forEach(function(dot,index){if(index===current)dot.setAttribute('aria-current','true');else dot.removeAttribute('aria-current');});}
function rebuild(){targets=positions();d.replaceChildren();dots=targets.map(function(target,index){
var dot=document.createElement('button');function seek(){t.scrollTo({left:target,behavior:rm.matches?'auto':'smooth'});}
dot.type='button';dot.className='pagecraft-slider-dot';dot.setAttribute('aria-label','Go to carousel position '+(index+1)+' of '+targets.length);
if(t.id)dot.setAttribute('aria-controls',t.id);dot.addEventListener('click',seek);dot.addEventListener('keydown',function(event){
if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();seek();});d.appendChild(dot);return dot;});active();}
function update(){var max=t.scrollWidth-t.clientWidth-2;p.disabled=t.scrollLeft<=2;n.disabled=t.scrollLeft>=max;active();}
var queued=false;t.addEventListener('scroll',function(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;update();});},{passive:true});
addEventListener('resize',function(){rebuild();update();});addEventListener('load',function(){rebuild();update();},{once:true});rebuild();update();});})();
<\/script>
`,vo=`<script>
(function(){var c=navigator.clipboard;if(!c)return;
Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'),function(b){
var box=b.closest('.pagecraft-code');if(!box)return;var pre=box.querySelector('code');if(!pre)return;
b.removeAttribute('hidden');
b.addEventListener('click',function(){var was=b.textContent;
function say(t){b.textContent=t;b.disabled=true;
setTimeout(function(){b.textContent=was;b.disabled=false;},1400);}
c.writeText(pre.textContent||'').then(function(){say('Copied');},function(){
/* refused \u2014 a sandboxed frame, no permission. Select it so the reader can copy it. */
try{var r=document.createRange();r.selectNodeContents(pre);var sel=getSelection();
sel.removeAllRanges();sel.addRange(r);say('Selected');}catch(e){say('Press \u2318C');}});});});})();
<\/script>
`;function ko(e){let t=String(e??"").replace(/\r/g,""),n=t.split(`
`).filter(a=>a.trim()!=="");if(!n.length)return[];let o=t.includes("	")?"	":"|",i=n.map(a=>a.split(o).map(s=>s.trim())),r=i.reduce((a,s)=>Math.max(a,s.length),0);return i.map(a=>a.concat(Array(r-a.length).fill("")))}function $t(e,t){let n=[],o=i=>{if(!i)return;["d","t","m"].forEach(a=>n.push(i.css&&i.css[a]));let r=i.st||{};Object.keys(r).forEach(a=>["d","t","m"].forEach(s=>n.push(r[a]&&r[a][s])))};o(jo(e)),xe(e).forEach(i=>o(i));for(let i of n)if(i&&i[t])return String(i[t]);return""}var He=e=>!!($t(e,"background-image")||$t(e,"background"));function St(e){let t=Ze(e.id),n=t?q(t):null;return!n||n.node.type!=="slider"}var hi=[{g:"Spacing",cap:"spacing",items:[{t:"box",c:"padding",label:"Padding",r:1},{t:"box",c:"margin",label:"Margin",r:1,neg:1}]},{g:"Background",cap:"decoration",items:[{t:"color",c:"background-color",label:"Colour",r:1,paint:1},{t:"img",c:"background-image",label:"Image",r:1,bg:1},{t:"select",c:"background-size",label:"Size",r:1,when:He,opts:[["cover","Cover"],["contain","Contain"],["auto","Auto"]]},{t:"pick",c:"background-position",label:"Position",r:1,when:He,opts:[["left center","alignL"],["center center","alignC"],["right center","alignR"],["top center","vTop"],["bottom center","vBot"]]},{t:"select",c:"background-repeat",label:"Repeat",r:1,when:He,opts:[["no-repeat","No repeat"],["repeat","Repeat"]]}]},{g:"Border & shadow",cap:"decoration",items:[{t:"border",label:"Border"},{t:"unit",c:"border-radius",label:"Radius",layout:"inline",r:1,units:v.radius},{t:"opt",c:"box-shadow",label:"Shadow",r:1,opts:uo,ph:"0 20px 40px -12px rgba(17,19,17,.2)"}]},{g:"Effects",cap:"effects",items:[{t:"slider",c:"opacity",label:"Opacity",r:1,min:0,max:1,step:.01,raw:1},{t:"text",c:"transform",label:"Transform",r:1,ph:"translateY(-4px) rotate(2deg)"}]}];var $o={desktop:"d",tablet:"t",mobile:"m"};function So(){return{mode:"page",dev:"desktop",sel:null,multi:[],tab:"add",atab:"widgets",stab:"content",target:"",lmode:null,open:{},collapsed:{},custom:{},zoom:"fit",pno:1,st:""}}var b={v:1,meta:{name:"Untitled project",maxWidth:"1200px",font:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",headFont:"",size:"16px",css:"",headHtml:"",lang:"en",baseUrl:"",ogImage:"",favicon:"",blocks:[],tokens:null},header:[],footer:[],pages:[],cur:0,ui:So()},Zt=()=>({schemaVersion:V,meta:b.meta,header:b.header,footer:b.footer,pages:b.pages}),Co=()=>b.pages[b.cur]||b.pages[0],Mo=()=>{if(b.ui.mode==="component"){let e=ee(b.ui.cedit);return e?[e.node]:[]}return b.ui.mode==="header"?b.header:b.ui.mode==="footer"?b.footer:Co().tree},Jt=()=>$o[b.ui.dev];function q(e,t=Mo(),n=null){for(let o=0;o<t.length;o++){if(t[o].id===e)return{node:t[o],list:t,parent:n,i:o};let i=q(e,t[o].children||[],t[o]);if(i)return i}return null}function Ao(e){for(let[t,n]of[["header",b.header],["footer",b.footer]]){let o=q(e,n,null);if(o)return{...o,mode:t}}for(let t=0;t<b.pages.length;t++){let n=q(e,b.pages[t].tree,null);if(n)return{...n,mode:"page",page:t}}return null}function Y(e,t,n=null,o=0){e.forEach((i,r)=>{t(i,n,r,o),Y(i.children||[],t,i,o+1)})}function Io(){let e=[];b.ui.sel&&e.push(b.ui.sel);for(let t of b.ui.multi||[])e.includes(t)||e.push(t);return e.filter(t=>q(t))}function Eo(e){let t=e.filter(o=>q(o)),n=b.ui.sel;b.ui.sel=t.length?t[0]:null,b.ui.multi=t.slice(1),b.ui.sel!==n&&(b.ui.st="")}var Ct={change(){},save(){},note(){}};function it(e,t=!1){let n=t?b.ui.mobileMenuOwner:null;b.meta=e.meta,b.header=e.header,b.footer=e.footer,b.pages=e.pages,b.ui.mobileMenuOwnerPending=null,b.ui.mobileMenuOwner=n,n&&xn(n.menuComponentId),b.cur>=b.pages.length&&(b.cur=0),Eo(Io()),Ct.change(),Ct.save()}function Qt(e){return e.id=Xn(),e.adv&&(e.adv.htmlId=""),(e.children||[]).forEach(Qt),e}var Po={d:["d"],t:["t","d"],m:["m","t","d"]};function Ie(e,t,n){for(let o of Po[t]||["d"]){let i=((e.css||{})[o]||{})[n];if(i!==void 0&&i!=="")return i;let r=xe(e);for(let a=r.length-1;a>=0;a--){let s=((r[a].css||{})[o]||{})[n];if(s!==void 0&&s!=="")return s}}return""}function en(e,t){if(!e||e.type!=="row")return"flex-start";let n=Ie(e,t,"align-items");return n==="center"||n==="flex-end"?n:"flex-start"}function To(e){let t=Ao(e.id),n=en(t&&t.parent?t.parent:null,Jt());return n==="center"?"Center":n==="flex-end"?"Bottom":"Top"}var M=e=>`var(--c-${e})`;var Lo=e=>{let t=String(e||"").trim().match(/^var\(--c-([\w-]+)\)$/);return t?t[1]:null},tn=()=>b.meta.tokens&&b.meta.tokens.colors||[],at=()=>b.meta.tokens&&b.meta.tokens.text||[];var Pe=()=>b.meta.tokens&&b.meta.tokens.classes||[],ye=e=>tn().find(t=>t.id===e)||null,Ge=e=>at().find(t=>t.id===e)||null,No=e=>Pe().find(t=>t.id===e)||null,xe=e=>{let t=Array.isArray(e.cls)?e.cls:[];return Pe().filter(n=>t.includes(n.id))},Mt=e=>{let t=Lo(e);if(!t)return String(e||"");let n=ye(t)||(t==="brand"?ye("accent"):null);return n?n.value:""},Ro=()=>!ye("brand")&&!!ye("accent");function At(e={}){return{classes:[],colors:[{id:"text",name:"Body text",value:e.color||"#111311"},{id:"bg",name:"Page background",value:e.bg||"#f8f6ef"},{id:"brand",name:"Craft Green",value:e.accent||"#b7f34a"},{id:"ink",name:"Ink",value:"#111311"},{id:"muted",name:"Slate (on Paper)",value:"#5f6660"},{id:"muted-i",name:"Slate (on Ink)",value:"#b0b7b1"},{id:"slate",name:"Slate (brand)",value:"#6f7771"},{id:"line",name:"Hairline",value:"#e5e1d6"},{id:"surface",name:"White",value:"#ffffff"}],text:[{id:"display",name:"Display",tag:"h1",css:{d:{"font-size":"58px","font-weight":"600","line-height":".96","letter-spacing":"-.04em",color:M("ink")},t:{"font-size":"44px"},m:{"font-size":"33px"}}},{id:"title",name:"Section title",tag:"h2",css:{d:{"font-size":"38px","font-weight":"600","line-height":"1.05","letter-spacing":"-.035em",color:M("ink")},t:{"font-size":"32px"},m:{"font-size":"27px"}}},{id:"subtitle",name:"Card title",tag:"h3",css:{d:{"font-size":"19px","font-weight":"700","line-height":"1.3",color:M("ink")},t:{},m:{"font-size":"18px"}}},{id:"lead",name:"Lead paragraph",tag:"p",css:{d:{"font-size":"18px","line-height":"1.65",color:M("muted")},t:{},m:{"font-size":"16px"}}},{id:"body",name:"Body",tag:"p",css:{d:{"font-size":"16px","line-height":"1.7",color:M("text")},t:{},m:{"font-size":"15px"}}},{id:"small",name:"Small",tag:"p",css:{d:{"font-size":"14px","line-height":"1.65",color:M("muted")},t:{},m:{}}},{id:"eyebrow",name:"Eyebrow",tag:"div",css:{d:{"font-family":"'DM Sans',system-ui,sans-serif","font-size":"12px","font-weight":"500","letter-spacing":".04em","text-transform":"uppercase",color:M("muted")},t:{},m:{}}},{id:"btn",name:"Button label",css:{d:{"font-size":"15px","font-weight":"600","letter-spacing":"0em"},t:{},m:{}}}]}}function Oo(){let e=tn().map(n=>`--c-${n.id}:${n.value}`);Ro()&&e.push(`--c-brand:${M("accent")}`);let t=e.join(";");return t?`:root{${t}}`:""}var Do=e=>e==="background-color"||/^border(?:-|$)/.test(e)||/^padding(?:-|$)/.test(e),It="--pc-authored-button-",nn=e=>`${e}:where(.pagecraft-gallery):has(:where(.pagecraft-gallery-frame):focus-visible)`,on=e=>`${e}:where(.pagecraft-nav-menu):has(:focus-visible)`,rn=(e,t=null,n=new Set)=>{let o={};for(let[i,r]of Object.entries(e))Do(i)&&(t&&Object.prototype.hasOwnProperty.call(t,i)&&t[i]===r&&!n.has(i)||(o[i]=r));return o};function an(){let e={d:"",t:"",m:""};return at().forEach(t=>["d","t","m"].forEach(n=>{let o=H(t.css&&t.css[n]||{});o&&(e[n]+=`.ts-${t.id}{${o}}`)})),Pe().forEach(t=>["d","t","m"].forEach(n=>{let o=t.css&&t.css[n]||{},i=H(o);i&&(e[n]+=`.c-${t.id}{${i}}`);let r=H(rn(o));r&&(e[n]+=`.c-${t.id}.pagecraft-button{${r}}`),sn.forEach(([a,,s])=>{let l=H(t.st&&t.st[a]&&t.st[a][n]||{});l&&(e[n]+=`.c-${t.id}${s}{${l}}`,a==="focus"&&(e[n]+=`${nn(`.c-${t.id}`)}{${l}}`,e[n]+=`${on(`.c-${t.id}`)}{${l}}`))})})),e}function zo(){return[b.header,b.footer,...b.pages.map(e=>e.tree),...bn().map(e=>[e.node])]}function Et(e,t){return String(e&&e.name||"").trim()||Wt(e&&e.label)||"field-"+(t+1)}function Fo(e){return BigInt(Math.round(e)).toString()}var sn=[["hover","Hover",":hover"],["focus","Focus",":focus-visible"]];function jo(e){let t=b.ui.target,n=t?No(t):null;return n&&(e.cls||[]).includes(t)?n:e}var ln="val:";var cn=/asset:([A-Za-z0-9][A-Za-z0-9._:-]*)(?:@(\d+))?/g;var Bo=[480,768,1024,1440,1920];function _o(e){let t=Math.round(parseFloat(String(e||""))||0);if(!(t>0))return[];let n=Bo.filter(o=>o<=t-Ho);return n.length?[...n,t]:[]}var Ho=160;function qo(e){let t=Uo(e),n=t.find(l=>l.type==="section"),o=[...t].reverse().find(l=>l.type==="row"||l.type==="list"),i=[...t].reverse().find(l=>l.type==="column"),a=n&&n.props.width==="full"?0:parseFloat(String(b.meta.maxWidth||"1200"))||1200;if(a&&n&&(a-=(parseFloat(String((n.css.d||{})["padding-left"]||"0"))||0)+(parseFloat(String((n.css.d||{})["padding-right"]||"0"))||0)),!a)return"100vw";if(o&&i){let l=o.children||[],p=m=>parseFloat(String((m.css.d||{})["flex-grow"]||""))||0,d=l.reduce((m,g)=>m+p(g),0),u=p(i);if(d>0&&u>0){let m=parseFloat(String((o.css.d||{}).gap||"0"))||0;a=(a-m*Math.max(0,l.length-1))*(u/d)}}return`(max-width: 767px) 100vw, min(100vw, ${Math.max(1,Math.round(a))}px)`}var Ce=(e,t,n)=>e<t?t:e>n?n:e,Wo=e=>{let t=String(e??"").trim(),n=t.match(/^#([0-9a-f]{3,8})$/i);if(n){let r=n[1],a=r.length===3||r.length===4?r.split("").map(p=>p+p).join(""):r;if(a.length!==6&&a.length!==8)return null;let s=parseInt(a.slice(0,6),16),l=a.length===8?parseInt(a.slice(6),16)/255:1;return{r:s>>16&255,g:s>>8&255,b:s&255,a:l}}let o=t.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)?/i);if(!o)return null;let i=o[4]===void 0?1:o[4].endsWith("%")?parseFloat(o[4])/100:parseFloat(o[4]);return{r:Ce(Math.round(+o[1]),0,255),g:Ce(Math.round(+o[2]),0,255),b:Ce(Math.round(+o[3]),0,255),a:Ce(isNaN(i)?1:i,0,1)}};var Pt=e=>{let t=Wo(e);return t?[t.r,t.g,t.b]:null},Tt=e=>{let t=e.map(n=>(n/=255,n<=.03928?n/12.92:Math.pow((n+.055)/1.055,2.4)));return .2126*t[0]+.7152*t[1]+.0722*t[2]};function qe(e,t){let n=Pt(Mt(e)),o=Pt(Mt(t));if(!n||!o)return null;let i=Tt(n),r=Tt(o);return(Math.max(i,r)+.05)/(Math.min(i,r)+.05)}function Uo(e){let t=[];for(let n=Ze(e);n;n=Ze(n)){let o=q(n);if(!o)break;t.push(o.node)}return t.reverse()}var bi=(()=>{let e=new Uint32Array(256);for(let t=0;t<256;t++){let n=t;for(let o=0;o<8;o++)n=n&1?3988292384^n>>>1:n>>>1;e[t]=n>>>0}return e})();var Vo=()=>b.meta.collections||(b.meta.collections=[]),K=e=>Vo().find(t=>t.id===e)||null,ve=(e,t)=>e&&(e.fields||[]).find(n=>n.id===t)||null,dn=(e,t)=>e&&(e.items||[]).find(n=>n.id===t)||null;var Go=e=>e&&(e.fields||[]).find(t=>t.type==="text")||null,Yo=(e,t)=>{let n=Go(e);return String(n&&t.values[n.id]||"").trim()||"Untitled"};var pn=e=>(e&&e.items||[]).filter(t=>!t.draft);function Ko(e,t,n,o,i){let r=n?ve(e,n):null;if(!r)return!0;let a=String(t.values[r.id]??"").trim(),s=String(i??"").trim();if(o==="set")return a!=="";if(o==="unset")return a==="";if(s==="")return!0;if(o==="has")return a.toLowerCase().includes(s.toLowerCase());let l=d=>{let u=d.toLowerCase();return["1","true","yes"].includes(u)?!0:["0","false","no"].includes(u)?!1:null},p=r.type==="number"?parseFloat(a)===parseFloat(s):r.type==="bool"?(()=>{let d=l(a),u=l(s);return d!==null&&u!==null?d===u:a.toLowerCase()===s.toLowerCase()})():a.toLowerCase()===s.toLowerCase();return o==="not"?!p:p}function un(e,t){let n=e.props,o=pn(t).filter(s=>Ko(t,s,n.where,n.op,n.val)),i=e.props.sort?ve(t,e.props.sort):null;i&&o.sort((s,l)=>{let p=s.values[i.id]??"",d=l.values[i.id]??"";return i.type==="number"?(parseFloat(p)||0)-(parseFloat(d)||0):String(p).localeCompare(String(d))}),e.props.dir==="desc"&&o.reverse();let r=parseInt(String(e.props.per||""),10),a=parseInt(e.props.limit||"",10);return a>0&&!(r>0)?o.slice(0,a):o}function Q(e,t){let n=String(e||"");if(n==="cms:item"){if(!t||!t.col||!t.item)return"";n=t.col.slug+"/"+t.item.slug+".html"}let o=qt(n);return o?eo(o):n.startsWith(_t)?"":(n=Se(n),!n||!t||!t.rel||/^([a-z][\w+.-]*:|\/\/|\/|#)/i.test(n)?n:t.rel+n)}var fn=e=>{let t=e.anim;return t&&t.name&&ut.includes(t.name)?t:null};function Xo(e){let t=fn(e);if(!t)return{cls:"",at:""};let n=(o,i)=>i?` ${o}="${f(i)}"`:"";return{cls:` bp-animate ${"pc-"}${t.name}`,at:n("bp-duration",t.dur)+n("bp-delay",t.delay)+n("bp-easing",t.ease)+(t.once?' bp-animation-once="true"':"")}}var Ye=e=>{let t=!1;return[...e,...lt(e).map(n=>[n.node])].forEach(n=>Y(n,o=>{!t&&fn(o)&&(t=!0)})),t},Ke="@media (prefers-reduced-motion:reduce){.bp-animate,.bp-animate.bp-is-hidden{opacity:1 !important;transform:none !important;animation:none !important}}";var gn="index",Me=e=>e.slug===gn;var Zo="404",Lt=e=>e.slug===Zo;var st=(e,t)=>t<=1?e+".html":`${e}/page-${t}.html`;function Jo(e,t){let n=parseInt(String(e.props.per||""),10);return n>0?Math.max(1,Math.ceil(un(e,t).length/n)):1}function Qo(e){let t=null;return Y(e.tree,n=>{if(n.type!=="list")return;let o=parseInt(String(n.props.per||""),10),i=n.src?K(n.src):null;!(o>0)||!i||(t?t.extra++:t={node:n,col:i,extra:0})}),t}var er=(e,t)=>(e.bind||{})[t]||null;var mn=(e,t)=>{let n=er(e,t);return n&&n.src==="field"?n.path:""};var tr=e=>(b.ui.item||(b.ui.item={}))[e]||0;function nr(e){return!e||!e.items.length?null:e.items[Math.min(tr(e.id),e.items.length-1)]}var or=(e,t,n,o)=>o&&t===e?n:nr(e),hn=4,Te=(e,t,n,o=0)=>{if(!e||!t)return"";let i=String(n||"").split("."),r=ve(e,i[0]);if(!r)return"";let a=t.values[r.id],s=a??"";if(i.length===1)return s;if(r.type!=="ref"||!r.ref||o>=hn)return"";let l=K(r.ref),p=l?dn(l,s):null;return p?Te(l,p,i.slice(1).join("."),o+1):""},Xe=(e,t,n=0)=>{if(!e)return null;let o=String(t||"").split("."),i=ve(e,o[0]);return!i||o.length===1?i||null:i.type!=="ref"||!i.ref||n>=hn?null:Xe(K(i.ref),o.slice(1).join("."),n+1)};var rr=(e,t)=>(((be[e]||{}).controls||{}).content||[]).some(n=>n.t==="rich"&&n.k===t),Nt=(e,t)=>t&&t.type==="rich"?je(e):Ee(e);function ir(e,t,n,o,i){if(!e.bind)return e.props;let r={...e.props};for(let[a,s]of Object.entries(e.bind)){let l=rr(e.type,a);if(s.src==="prop"){if(!o)continue;let d=vn(o,i||null,s.path,t,n),u=t?mn(o,ln+s.path):"";r[a]=l?u?Nt(d,Xe(t,u)):(wn(i||null,s.path)||{t:""}).t==="rich"?d:Ee(d):d;continue}if(s.src!=="field"||!t||!n)continue;let p=Te(t,n,s.path);r[a]=l?Nt(p,Xe(t,s.path)):p}return r}function ar(e,t,n,o,i){if(e.bind.src==="prop")return o?vn(o,i||null,e.bind.path,t,n):"";if(!t||!n)return"";let r=Te(t,n,e.bind.path);return r==null?"":String(r)}function sr(e,t,n,o,i){let r=e.showIf;if(!r||!r.bind||!r.bind.path)return!0;let a=ar(r,t,n,o,i).trim(),s=String(r.value==null?"":r.value).trim();return r.op==="set"?a!=="":r.op==="empty"?a==="":r.op==="eq"?a===s:r.op==="ne"?a!==s:!0}function bn(){return b.meta.components||(b.meta.components=[])}function ee(e){return e&&bn().find(t=>t.id===e)||null}var lr=e=>e.props.mobileMenuMode==="follow"||e.props.mobileMenuMode==="custom"?e.props.mobileMenuMode:e.props.mobileMenuComponent?"custom":"follow",yn=(e,t=lr(e))=>t==="follow"?e.props.mobileMenuFollowComponent:e.props.mobileMenuComponent,cr=e=>ee(yn(e));var dr=(e,t)=>e.type==="nav"&&(e.props.mobileMenuFollowComponent===t||e.props.mobileMenuComponent===t);function xn(e){let t=b.ui.mobileMenuOwner;if(!t||t.menuComponentId!==e||!ee(e))return t?.menuComponentId===e&&(b.ui.mobileMenuOwner=null),null;let n=null;if(t.mode==="header")n=q(t.nodeId,b.header);else if(t.mode==="footer")n=q(t.nodeId,b.footer);else if(t.mode==="page"&&t.page!==void 0)n=q(t.nodeId,b.pages[t.page]?.tree||[]);else if(t.mode==="component"&&t.ownerComponentId){let o=ee(t.ownerComponentId);o&&(n=q(t.nodeId,[o.node]))}return!n||!dr(n.node,e)?(b.ui.mobileMenuOwner=null,null):{node:n.node,mode:t.mode,page:t.page,componentId:t.ownerComponentId}}var wn=(e,t)=>e&&(e.props||[]).find(n=>n.k===t)||null,pr=e=>e&&e.variants||[],ur=(e,t)=>t&&pr(e).find(n=>n.id===t)||null;function vn(e,t,n,o,i){let r=mn(e,ln+n);if(r&&o)return Te(o,i||null,r);let a=e.vals?e.vals[n]:void 0;if(a!==void 0)return a;let s=ur(t,e.variant);if(s&&s.values[n]!==void 0)return s.values[n];let l=wn(t,n);return l?l.def:""}function fr(e){if(!e)return[];let t=[];return Y([e.node],n=>{n.slot&&be[n.type].level<4&&t.push({k:n.slot,node:n})}),t}function gr(e,t,n){let o=fr(t),i=o.length?o[0].k:"";return(e.children||[]).filter(r=>(r.slot||i)===n)}var Ze=e=>{let t=q(e);return t&&t.parent?t.parent.id:null};var V=13;function kn(e){if(!e||!e.pages||!e.pages.length)return null;let t=e.schemaVersion,n=e.v;if(t!==void 0&&(!Number.isInteger(t)||t<1))throw new Error("invalid document schemaVersion");if(n!==void 0&&(!Number.isInteger(n)||n<1))throw new Error("invalid legacy document version");if(t!==void 0&&n!==void 0&&t!==n)throw new Error("conflicting document schema versions");let o=t??n??1;if(o>V)return null;let i=r=>{let a=s=>{r(s),(s.children||[]).forEach(a)};(e.header||[]).forEach(a),(e.footer||[]).forEach(a),(e.pages||[]).forEach(s=>(s.tree||[]).forEach(a)),((e.meta||{}).blocks||[]).forEach(s=>{s.node&&a(s.node)}),((e.meta||{}).components||[]).forEach(s=>{s.node&&a(s.node)})};if(o<3&&(e.meta=e.meta||{},e.meta.tokens||(e.meta.tokens=At(e.meta)),delete e.meta.color,delete e.meta.bg,delete e.meta.accent),o<4&&(e.meta=e.meta||{},e.meta.tokens=e.meta.tokens||At(e.meta),Array.isArray(e.meta.tokens.classes)||(e.meta.tokens.classes=[])),o<5){let r={display:"h1",title:"h2",subtitle:"h3",lead:"p",body:"p",small:"p",eyebrow:"div"};((e.meta.tokens||{}).text||[]).forEach(a=>{let s=r;!a.tag&&s[a.id]&&(a.tag=s[a.id])})}if(o<6&&(e.meta=e.meta||{},Array.isArray(e.meta.blocks)||(e.meta.blocks=[])),o<7&&(e.meta=e.meta||{},Array.isArray(e.meta.collections)||(e.meta.collections=[])),o<8&&i(r=>["d","t","m"].forEach(a=>{let s=r.css&&r.css[a];if(!s)return;let l=s["--hover-bg"],p=s["--hover-fg"];if(delete s["--hover-bg"],delete s["--hover-fg"],!l&&!p)return;r.st=r.st||{};let d=r.st.hover=r.st.hover||{d:{},t:{},m:{}};d[a]=d[a]||{},l&&(d[a]["background-color"]=l),p&&(d[a].color=p,d[a]["border-color"]=p)})),o<9&&i(r=>{if(r.bind)for(let[a,s]of Object.entries(r.bind))typeof s=="string"&&(r.bind[a]={src:"field",path:s})}),o<10&&(e.meta=e.meta||{},Array.isArray(e.meta.components)||(e.meta.components=[])),o<11){let r=(e.meta||{}).blocks||[],a=r.filter(s=>s&&s.sync&&s.node);if(a.length){e.meta.components=Array.isArray(e.meta.components)?e.meta.components:[];let s=l=>JSON.stringify(l,(p,d)=>{if(p!=="id"){if(p==="adv"&&d){let{block:u,...m}=d;return m}return d}});for(let l of a){let p={id:l.id,name:l.name,node:Qt(ae(l.node)),props:[]},d=s(l.node);i(u=>{!u.adv||u.adv.block!==l.id||(delete u.adv.block,s(u)===d&&(u.use=l.id,u.children=[],u.css={d:{},t:{},m:{}},u.cls=[],u.hide={},u.adv={htmlId:"",cls:"",css:""},delete u.st,delete u.anim,delete u.bind,delete u.src))}),Y([p.node],u=>{let m=u.adv;m&&m.block===l.id&&delete m.block}),e.meta.components.push(p)}e.meta.blocks=r.filter(l=>!(l&&l.sync))}((e.meta||{}).blocks||[]).forEach(s=>{s&&delete s.sync})}if(o<12){let r=((e.meta||{}).tokens||{}).classes||[],a=(s,l,p)=>{let d=Array.isArray(s.cls)?s.cls:[],u="";for(let m of r){if(!m||!d.includes(m.id))continue;let g=m.css&&m.css[l]&&m.css[l][p];g!==void 0&&g!==""&&(u=g)}return u};i(s=>{if(!(!s||s.type!=="column")){s.css=s.css||{d:{},t:{},m:{}};for(let l of["d","t","m"]){let p=s.css[l]=s.css[l]||{},d=p["justify-content"];if(d!==void 0&&d!=="")p[G]=l==="d"&&d==="flex-start"?"follow":d,delete p["justify-content"];else if(!p[G]){let u=a(s,l,"justify-content");u&&(p[G]=u)}}s.css.d[G]||(s.css.d[G]="follow")}})}return o<13&&i(r=>{!r||r.type!=="form"||(r.props=r.props||{},r.props.mode!=="wordpress"&&(r.props.mode="external"))}),n!==void 0||t===void 0?e.v=V:delete e.v,e.schemaVersion=V,e}var Rt=()=>{let e=M("brand");for(let r of["ink","paper","bg","surface"])if(ye(r)&&(qe(M(r),e)||0)>=4.5)return M(r);let t="#000000",n="#ffffff",o=qe(t,e),i=qe(n,e);return o==null||i==null?M("ink"):o>=i?t:n};var Ot="data:image/svg+xml;charset=utf-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#f1eee3"/><g fill="none" stroke="#c2beb0" stroke-width="10"><circle cx="300" cy="180" r="42"/><path d="M120 380l150-130 120 104 100-86 190 162z" stroke-linejoin="round"/></g></svg>'),ie={t:"@media (max-width:1024px)",m:"@media (max-width:767px)"},Dt={d:"@media (min-width:1025px)",t:"@media (min-width:768px) and (max-width:1024px)"},$n=()=>({d:"",t:"",m:"",vd:"",vt:"",vm:""});function H(e){let t="",n=i=>i==="border"?0:/^border-(width|style|color)$/.test(i)?1:/^border-(top|right|bottom|left)$/.test(i)?2:/^border-(top|right|bottom|left)-(width|style|color)$/.test(i)?3:4,o=Object.keys(e).map((i,r)=>({k:i,i:r,rank:n(i)})).sort((i,r)=>i.rank-r.rank||i.i-r.i);for(let{k:i}of o){let r=e[i];if(!(r===""||r==null)){if(i==="--g-cols"||i==="z-index"){let s=String(r).trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:px)?$/i),l=s?Number(s[1]):NaN;Number.isFinite(l)&&(r=Fo(i==="--g-cols"?Math.max(1,Math.round(l)):l))}t+=`${i}:${r};`}}return t}var Sn="pagecraft-",mr=e=>e==="text"?"wysiwyg":Wt(be[e]&&be[e].label||e),Je=e=>Sn+String(e.id).replace(/^n/,""),hr=e=>`${Sn}${mr(e.type)}-${String(e.id).replace(/^n/,"")}`,Cn=e=>e.adv&&e.adv.htmlId?e.adv.htmlId:hr(e),O=e=>"."+Je(e),Qe=new Set(["height","object-fit","border-radius","opacity","filter"]);function We(e,t,n,o=null,i=!1){let r={...e.css[t]||{}},a=new Set;if(Object.keys(r).forEach(m=>{m.startsWith(It)&&(r[m]==="1"&&a.add(m.slice(It.length)),delete r[m])}),e.type==="column"){let m=Ie(e,t,G),g=e.use?ee(e.use):null,$=g&&g.node.type==="column"?Ie(g.node,t,G):"",C=m||$||"follow";delete r[G];let D=!!e.use&&!m&&!!$&&$!=="follow";!(i&&C==="follow")&&!D&&(r["justify-content"]=C==="follow"?en(o,t):C)}let s=e.type==="image",l=s&&!!(e.props.caption||e.props.link),p={};if(s){for(let m of Qe)r[m]!==void 0&&(p[m]=r[m],l&&delete r[m]);r.width&&(p.width="100%")}let d=H(r),u=[];if(d&&u.push(`${O(e)}{${d}}`),e.type==="button"){let g=H(rn(r,t==="d"?Vt:null,a));g&&u.push(`${O(e)}.pagecraft-button{${g}}`)}if(s&&H(p)){let m={};p.height!==void 0&&(m.height="auto"),p["object-fit"]!==void 0&&(m["object-fit"]="initial"),p["border-radius"]!==void 0&&(m["border-radius"]="0"),p.opacity!==void 0&&(m.opacity="1"),p.filter!==void 0&&(m.filter="none");let g=H(m);g&&u.push(`${O(e)}.pagecraft-figure{${g}}`),u.push(`${O(e)} .pagecraft-image{${H(p)}}`)}return(e.type==="box"||e.type==="list")&&r["flex-wrap"]&&u.push(`${O(e)}.${e.type==="box"?"pagecraft-box":"pagecraft-list"}{flex-wrap:${r["flex-wrap"]}}`),sn.forEach(([m,,g])=>{let $={...e.st&&e.st[m]&&e.st[m][t]||{}},C={};if(s)for(let x of Qe)$[x]!==void 0&&(C[x]=$[x],l&&delete $[x]);let D=H($),P=m==="focus"&&e.type==="gallery"?nn(O(e)):m==="focus"&&e.type==="nav"?on(O(e)):`${O(e)}${g}`;D&&u.push(`${P}{${D}}`);let B=H(C);if(B){let x={};C.height!==void 0&&(x.height="auto"),C["object-fit"]!==void 0&&(x["object-fit"]="initial"),C["border-radius"]!==void 0&&(x["border-radius"]="0"),C.opacity!==void 0&&(x.opacity="1"),C.filter!==void 0&&(x.filter="none");let X=H(x);X&&u.push(`${O(e)}.pagecraft-figure${g}{${X}}`),u.push(`${O(e)}${g} .pagecraft-image{${B}}`)}}),e.type==="text"&&r["--link"]&&u.push(`${O(e)} a{color:${r["--link"]}}`),u.join("")}function zt(e,t){let n=e.css&&e.css[t]||{},o=t==="t"?{...e.css&&e.css.d||{}}:{...e.css&&e.css.d||{},...e.css&&e.css.t||{}},i=[Ge(e.props.ts),...xe(e)].filter(Boolean),r=new Set;i.forEach(u=>Object.keys(u.css&&u.css[t]||{}).forEach(m=>r.add(m)));let a={};r.forEach(u=>{(n[u]===void 0||n[u]==="")&&o[u]!==void 0&&o[u]!==""&&(a[u]=o[u])});let s=e.type==="image"&&!!(e.props.caption||e.props.link),l={};if(s)for(let u of Qe)a[u]!==void 0&&(l[u]=a[u],delete a[u]);let p=H(a),d=H(l);return(p?`${O(e)}{${p}}`:"")+(d?`${O(e)} .pagecraft-image{${d}}`:"")}var Ft=e=>`${O(e)} .pagecraft-nav-toggle{display:flex}${O(e)} .pagecraft-nav-list{display:none}`;function we(e,t,n,o=null,i=!1){if(n.d+=We(e,"d",t,o,i),e.type==="spacer"&&(n.m+=`:where(${O(e)}){height:32px}`),e.type==="form"&&e.props.fields?.some(a=>[100,50,33,25,20].includes(Number(a.width)))){let a=O(e);n.d+=`${a}.pagecraft-form-percent{display:var(--f-layout,flex)}${a}>.pagecraft-field{flex:0 0 100%;min-width:0}`;for(let[s,l]of[[50,2],[33,3],[25,4],[20,5]])n.d+=`${a}>.field-width-${s}{flex-basis:calc((100% - var(--f-gap,16px) * ${l-1}) / ${l})}`}if(e.type==="list"&&e.props.collectionLayout==="slider"){let a=O(e);n.d+=`${a}{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto;scroll-snap-type:x mandatory}${a}>*{flex:0 0 calc(50% - 12px);scroll-snap-align:start}`,n.m+=`${a}>*{flex-basis:80%}`}if(e.type==="nav"&&e.props.managedMobileLinks){let a=O(e);n.d+=`${a}.pagecraft-mobile-nav-links{display:block}${a}>.pagecraft-nav-list{display:flex;position:static;flex-direction:column;align-items:stretch;gap:var(--nav-gap,4px);min-width:0;width:100%;padding:0;margin:0;box-shadow:none;background:transparent}${a}>.pagecraft-nav-list a{padding:12px 0;min-height:44px;box-sizing:border-box}${a} .sub-menu{display:flex;position:static;flex-direction:column;min-width:0;padding:0 0 0 20px;box-shadow:none;background:transparent;font-size:.85em}`}else if(e.type==="nav"){let a=e.props.collapse;a==="tablet"?n.t+=Ft(e):a!=="never"&&(n.m+=Ft(e))}n.t+=We(e,"t",t,o,i),n.t+=zt(e,"t"),n.m+=We(e,"m",t,o,i),n.m+=zt(e,"m"),e.adv&&e.adv.css&&(n.d+=e.adv.css.replace(/&/g,O(e)));let r=t?"opacity:.32;outline:1px dashed #f0a132;outline-offset:2px;":"display:none !important;";return e.hide?.d&&(n.vd=(n.vd||"")+`${O(e)}{${r}}`),e.hide?.t&&(n.vt=(n.vt||"")+`${O(e)}{${r}}`),e.hide?.m&&(n.vm=(n.vm||"")+`${O(e)}{${r}}`),(e.children||[]).forEach(a=>we(a,t,n,e)),n}function Mn(e){return(e.vd?`${Dt.d}{${e.vd}}`:"")+(e.vt?`${Dt.t}{${e.vt}}`:"")}function lt(e){let t=new Set,n=[],o=i=>Y(i,r=>{for(let a of[r.use,r.type==="nav"&&r.props.mobileMenu!=="fullscreen"?yn(r):null]){if(!a||t.has(a))continue;let s=ee(a);s&&(t.add(a),n.push(s),o([s.node]))}});return e.forEach(o),n}function jt(e,t){let n=$n();return lt(e).forEach(o=>we(o.node,t,n,null,!0)),e.forEach(o=>o.forEach(i=>we(i,t,n))),n.d+(n.t?`${ie.t}{${n.t}}`:"")+(n.m||n.vm?`${ie.m}{${n.m}${n.vm}}`:"")+Mn(n)}function br(e){let t=an();return In(e)+t.d+(t.t?`${ie.t}{${t.t}}`:"")+(t.m?`${ie.m}{${t.m}}`:"")}function yr(e,t){let n=$n();lt(e).forEach(i=>we(i.node,t,n,null,!0)),e.forEach(i=>i.forEach(r=>we(r,t,n)));let o=an();return In(t)+o.d+n.d+(o.t||n.t?`${ie.t}{${o.t}${n.t}}`:"")+(o.m||n.m||n.vm?`${ie.m}{${o.m}${n.m}${n.vm}}`:"")+Mn(n)}function An(e){let t=[b.header,b.footer],n=Ye(t),o=Ye([e.tree]);return{global:tt(br(!1)+jt(t,!1)+(n?`
${$e}
${Ke}`:"")),page:tt(jt([e.tree],!1)+(o&&!n?`
${$e}
${Ke}`:""))}}function In(e){let t=b.meta;return`
${Oo()}
:root{--maxw:${t.maxWidth};--accent:var(--c-brand)}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:${t.font};font-size:${t.size};line-height:1.6;color:var(--c-text);background:var(--c-bg);-webkit-font-smoothing:antialiased}
img,video,svg{max-width:100%}
.pagecraft-skip{
  position:fixed;left:12px;top:12px;z-index:2147483647;padding:10px 14px;
  color:var(--c-bg);background:var(--c-ink);border-radius:6px;text-decoration:none;
  transform:translateY(calc(-100% - 24px));transition:transform .15s ease;
}
.pagecraft-skip:focus{transform:translateY(0)}
.pagecraft-section{position:relative;width:100%}
.pagecraft-container{width:100%;max-width:var(--maxw);margin-left:auto;margin-right:auto;position:relative}
.pagecraft-container.full{max-width:none}
.pagecraft-row,.pagecraft-list{display:flex;flex-wrap:wrap;width:100%}
.pagecraft-column{display:flex;flex-direction:column;min-width:0;flex-shrink:1;flex-basis:0%}
.pagecraft-box{display:block;width:100%;min-width:0;position:relative}
.pagecraft-box.l-flex{display:flex;flex-wrap:wrap}
.pagecraft-box.l-grid{display:grid}
.pagecraft-box>*{min-width:0}
a.pagecraft-box{color:inherit;text-decoration:none}
.pagecraft-heading{margin:0;font-family:${t.headFont||"inherit"};overflow-wrap:break-word}
.pagecraft-heading a{color:inherit;text-decoration:none}
.pagecraft-wysiwyg>:first-child{margin-top:0}
.pagecraft-wysiwyg>:last-child{margin-bottom:0}
.pagecraft-wysiwyg,.pagecraft-quote{overflow-wrap:break-word}
.pagecraft-wysiwyg a{text-decoration:underline;text-underline-offset:2px}
.pagecraft-wysiwyg ul,.pagecraft-wysiwyg ol{padding-left:1.3em;margin:.7em 0}
.pagecraft-wysiwyg h1,.pagecraft-wysiwyg h2,.pagecraft-wysiwyg h3,.pagecraft-wysiwyg h4{margin:.3em 0 .5em;line-height:1.25;font-family:${t.headFont||"inherit"}}
.pagecraft-wysiwyg blockquote{margin:1em 0;padding-left:1em;border-left:3px solid currentColor;opacity:.85}
.pagecraft-button{display:inline-flex;align-items:center;justify-content:center;gap:.5em;text-decoration:none;border:0 solid transparent;cursor:pointer;line-height:1.2;transition:background-color .18s ease,color .18s ease,border-color .18s ease,transform .18s ease}
:where(.pagecraft-button){max-width:100%;color:inherit}
:where(.pagecraft-button[data-variant=solid]){color:var(--pc-solid-fg,inherit)}
.pagecraft-button[data-variant=outline]{background-color:transparent;border-width:1px;border-style:solid;border-color:currentColor}
.pagecraft-button[data-variant=ghost]{background-color:transparent;border-color:transparent}
.pagecraft-button[data-variant=link]{background-color:transparent;border-width:0;border-color:transparent;border-radius:0;padding:0}
.pagecraft-button svg{width:1em;height:1em;flex:0 0 auto}
.pagecraft-figure{margin:0;display:flex;flex-direction:column}
.pagecraft-figure>a{display:block;width:100%;max-width:100%}
.pagecraft-image{display:block;width:100%;height:auto}
.pagecraft-caption{font-size:.82em;opacity:.7;margin-top:.55em}
.pagecraft-slider-box{position:relative;width:100%}
.pagecraft-slider{
  display:flex;gap:var(--sl-gap,24px);width:100%;
  overflow-x:auto;overscroll-behavior-x:contain;
  scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;
  scrollbar-width:none;padding-bottom:0;
}
.pagecraft-slider::-webkit-scrollbar{display:none;width:0;height:0}
.pagecraft-slider>[class]{flex:0 0 var(--sl-w,100%);scroll-snap-align:start;min-width:0}
.pagecraft-slider>*{scroll-snap-align:start;min-width:0}
.pagecraft-slider:focus-visible{outline:3px solid currentColor;outline-offset:3px}
.pagecraft-slide-btn{
  position:absolute;top:50%;translate:0 -50%;z-index:2;
  width:36px;height:36px;display:grid;place-items:center;cursor:pointer;
  border:1px solid var(--c-line,#e5e1d6);border-radius:99px;
  background:var(--c-bg,#fff);color:inherit;
}
.pagecraft-slide-btn.p{left:-8px;rotate:90deg}
.pagecraft-slide-btn.n{right:-8px;rotate:-90deg}
.pagecraft-slide-btn[hidden]{display:none}
.pagecraft-slide-btn:disabled{opacity:.35;cursor:default}
.pagecraft-slider-dots{display:flex;align-items:center;justify-content:center;gap:0;margin-top:16px}
.pagecraft-slider-dots[hidden]{display:none}
.pagecraft-slider-box.controls-bottom{display:grid;grid-template-columns:1fr auto 1fr;column-gap:16px;row-gap:20px;align-items:center}
.controls-bottom>[data-slides]{grid-column:1 / -1}
.controls-bottom>.pagecraft-slide-btn{position:static;translate:none;width:44px;height:44px;grid-row:2}
.controls-bottom>.pagecraft-slide-btn.p{grid-column:1;justify-self:end}
.controls-bottom>.pagecraft-slide-btn.n{grid-column:3;justify-self:start}
.controls-bottom>.pagecraft-slider-dots{grid-column:2;grid-row:2;margin-top:0}
.pagecraft-slider-dot{appearance:none;width:36px;height:36px;padding:0;display:grid;place-items:center;border:0;border-radius:99px;background:transparent;color:var(--c-text,#111311);cursor:pointer}
.pagecraft-slider-dot::before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.3;transition:transform .2s ease,opacity .2s ease,background-color .2s ease}
.pagecraft-slider-dot:hover::before{opacity:.68}
.pagecraft-slider-dot[aria-current=true]::before{background:var(--c-brand,#111311);opacity:1;transform:scale(1.25)}
.pagecraft-slider-dot:focus-visible{outline:2px solid var(--c-brand,#111311);outline-offset:0}
@media(max-width:767px){.pagecraft-slider-dots{margin-top:10px}.pagecraft-slider-dot{width:44px;height:44px}}
.pagecraft-crumbs ol{
  display:flex;flex-wrap:wrap;align-items:center;gap:var(--cb-gap,8px);
  list-style:none;margin:0;padding:0;
  font-size:var(--cb-size,13px);font-weight:var(--cb-weight,500);
}
.pagecraft-crumbs li{display:flex;align-items:center;gap:var(--cb-gap,8px)}
.pagecraft-crumbs a{color:var(--cb-color,#5f6660);text-decoration:none}
.pagecraft-crumbs a:hover{text-decoration:underline}
.pagecraft-crumbs [aria-current]{color:var(--cb-current,#111311)}
.pagecraft-crumbs li+li::before{content:"\u203A";color:var(--cb-color,#5f6660);opacity:.6}
.pagecraft-crumbs[data-sep=slash] li+li::before{content:"/"}
.pagecraft-crumbs[data-sep=dot] li+li::before{content:"\xB7"}
.pagecraft-crumbs[data-sep=dash] li+li::before{content:"\u2014"}
.pagecraft-code{
  width:100%;margin:0;background:var(--cd-bg,#f4f2ea);color:var(--cd-text,#111311);
  border-radius:var(--cd-radius,10px);overflow:hidden;
}
.pagecraft-code-head{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:.55em var(--cd-pad-x,18px);border-bottom:1px solid var(--cd-line,#e5e1d6);
  font-family:var(--cd-ui,system-ui,sans-serif);font-size:.8em;opacity:.75;
}
.pagecraft-code-copy{
  font:inherit;cursor:pointer;background:none;border:1px solid var(--cd-line,#e5e1d6);
  border-radius:5px;padding:.2em .6em;color:inherit;
}
.pagecraft-code-copy:hover{background:#1113110d}
.pagecraft-code-copy[hidden]{display:none}
.pagecraft-code pre{
  margin:0;padding:var(--cd-pad,16px 18px);overflow-x:auto;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:var(--cd-size,14px);line-height:1.55;tab-size:2;
}
.pagecraft-code[data-wrap] pre{white-space:pre-wrap;overflow-wrap:anywhere;overflow-x:visible}
.pagecraft-code[data-numbers] pre{counter-reset:pcline}
.pagecraft-code-line{display:block;counter-increment:pcline}
.pagecraft-code-line::before{
  content:counter(pcline);display:inline-block;width:2.2em;margin-right:1.1em;
  text-align:right;opacity:.4;user-select:none;
}
.pc-c-com{color:var(--cd-com,#5f6660);font-style:italic}
.pc-c-str{color:var(--cd-str,#2f6f5e)}
.pc-c-kw{color:var(--cd-kw,#8a4b2a)}
.pc-c-num{color:var(--cd-num,#3a5a9a)}
.pc-c-key,.pc-c-fn{color:var(--cd-key,#5b4a8a)}
.pagecraft-table-wrap{width:100%;overflow-x:auto}
.pagecraft-table{
  width:100%;border-collapse:collapse;font-size:var(--tbl-size,15px);
  color:var(--tbl-text,#111311);text-align:left;
}
.pagecraft-table caption{
  caption-side:bottom;padding-top:.7em;text-align:left;
  font-size:var(--tbl-caption-size,13px);color:var(--tbl-caption-color,#5f6660);
}
.pagecraft-table th,.pagecraft-table td{padding:var(--tbl-pad,10px 12px);vertical-align:top}
.pagecraft-table thead th{
  background:var(--tbl-head-bg,transparent);color:var(--tbl-head-text,#111311);
  font-weight:var(--tbl-head-weight,600);border-bottom:2px solid var(--tbl-line,#e5e1d6);
}
.pagecraft-table tbody th{background:var(--tbl-head-bg,transparent);font-weight:var(--tbl-head-weight,600);color:var(--tbl-head-text,#111311)}
.pagecraft-table[data-rules=rows] tbody tr+tr>*{border-top:1px solid var(--tbl-line,#e5e1d6)}
.pagecraft-table[data-rules=all] th,.pagecraft-table[data-rules=all] td{border:1px solid var(--tbl-line,#e5e1d6)}
.pagecraft-table[data-zebra] tbody tr:nth-child(even)>td{background:var(--tbl-zebra,#f8f6ef)}
.pagecraft-tabs{width:100%}
.pagecraft-tablist{display:flex;flex-wrap:wrap;gap:var(--tb-gap,22px);justify-content:var(--tb-align,flex-start);border-bottom:1px solid var(--tb-line,#e5e1d6)}
.pagecraft-tab{
  background:none;border:0;cursor:pointer;padding:var(--tb-pad,10px 2px);margin-bottom:-1px;
  font:inherit;font-size:var(--tb-size,15px);font-weight:var(--tb-weight,500);
  color:var(--tb-off,#5f6660);border-bottom:2px solid transparent;transition:color .16s,border-color .16s;
}
.pagecraft-tab.on{color:var(--tb-on,#111311);border-bottom-color:var(--tb-on,#111311)}
.pagecraft-tab:focus-visible{outline:3px solid currentColor;outline-offset:2px}
.pagecraft-tabpanel{padding-top:var(--tb-body-pad,20px);font-size:var(--tb-body-size,16px);color:var(--tb-body-color,#111311)}
.pagecraft-tabpanel>:first-child{margin-top:0}
.pagecraft-tabpanel>:last-child{margin-bottom:0}
.pagecraft-tabs[data-tabs-ready] [data-tab-idle]{display:none}
.pagecraft-pager{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;width:100%;margin-top:2.2em}
.pagecraft-page{
  display:inline-flex;align-items:center;justify-content:center;min-width:2.4em;padding:.5em .7em;
  border:1px solid var(--c-line);border-radius:6px;text-decoration:none;color:inherit;font-size:.9em;line-height:1;
}
.pagecraft-page.on{background:var(--c-ink);color:var(--c-bg);border-color:var(--c-ink)}
.pagecraft-page.off{opacity:.35}
.pagecraft-page:focus-visible{outline:3px solid var(--c-brand);outline-offset:2px}
.pagecraft-quote{margin:0;display:flex;flex-direction:column;border-left:0 solid transparent}
.pagecraft-quote blockquote{margin:0}
.pagecraft-quote p{margin:0}
.pagecraft-quote p+p{margin-top:.6em}
.pagecraft-quote p:first-of-type::before{content:"\\201C"}
.pagecraft-quote p:last-of-type::after{content:"\\201D"}
.pagecraft-attrib{font-size:.875rem;line-height:1.5;opacity:.72;margin-top:1em}
.pagecraft-attrib a{color:inherit}
.pagecraft-video{position:relative;width:100%;overflow:hidden}
.pagecraft-video-play{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;cursor:pointer;background:var(--c-ink);display:block}
.pagecraft-video-play img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.pagecraft-video-icon{
  position:absolute;left:50%;top:50%;width:66px;height:66px;margin:-33px 0 0 -33px;border-radius:50%;
  background:var(--c-brand);display:block;transition:transform .18s ease;
}
.pagecraft-video-play:focus-visible{outline:3px solid var(--c-brand);outline-offset:2px}
.pagecraft-video-icon::after{
  content:"";position:absolute;left:26px;top:21px;border-style:solid;
  border-width:12px 0 12px 19px;border-color:transparent transparent transparent var(--c-ink);
}
.pagecraft-video-play:hover .pagecraft-video-icon{transform:scale(1.08)}
.pagecraft-video>iframe,.pagecraft-video>video{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;object-fit:cover}
.pagecraft-nav-menu{display:flex;align-items:center;position:relative}
.pagecraft-nav-list{display:flex;align-items:center;gap:var(--nav-gap,26px);list-style:none;margin:0;padding:0}
.pagecraft-nav-list li{position:relative}
.pagecraft-nav-list .sub-menu{display:none;position:absolute;z-index:65;top:100%;left:0;min-width:190px;margin:0;padding:8px;list-style:none;background:var(--nav-panel,#fff);box-shadow:0 18px 38px -18px rgba(15,23,42,.36)}
.pagecraft-nav-list li:hover>.sub-menu,.pagecraft-nav-list li:focus-within>.sub-menu{display:block}
.pagecraft-nav-list .sub-menu .sub-menu{top:0;left:100%}
.pagecraft-nav-list a{display:block;text-decoration:none;color:inherit;transition:color .15s ease,background-color .15s ease}
.pagecraft-nav-list a:hover{color:var(--nav-hover,inherit)}
.pagecraft-nav-toggle{display:none;align-items:center;justify-content:center;width:40px;height:40px;margin:-8px -8px -8px 0;padding:0;border:0;background:none;color:inherit;cursor:pointer}
.pagecraft-mobile-menu{position:fixed;inset:var(--nav-top,0px) 0 auto;width:100%;max-width:none;max-height:calc(100dvh - var(--nav-top,0px));margin:0;padding:20px clamp(20px,5vw,48px);border:0;border-radius:0;background:var(--nav-panel,#fff);color:inherit;font:inherit;overflow:auto;box-sizing:border-box;overscroll-behavior:contain}
.pagecraft-mobile-menu::backdrop{background:rgba(0,0,0,.18)}
.pagecraft-mobile-menu[data-layout=dropdown]::backdrop{background:transparent;pointer-events:none}
.pagecraft-mobile-menu[data-layout=fullscreen]{inset:0;height:100dvh;max-height:none;display:flex;flex-direction:column;gap:24px}
.pagecraft-mobile-menu-head{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:16px}
.pagecraft-mobile-menu-close{display:flex;align-items:center;justify-content:center;flex:0 0 44px;width:44px;height:44px;padding:0;border:1px solid currentColor;border-radius:50%;color:inherit;background:transparent;cursor:pointer}
.pagecraft-nav-menu .pagecraft-mobile-menu .pagecraft-nav-list{display:flex;position:static;flex-direction:column;align-items:stretch;gap:4px;min-width:0;width:100%;padding:0;margin:0;box-shadow:none;background:transparent}
.pagecraft-mobile-menu .pagecraft-nav-list a{padding:12px 0;min-height:44px;box-sizing:border-box}
.pagecraft-mobile-menu[data-layout=fullscreen]>.pagecraft-nav-list{margin-block:auto;font-size:clamp(24px,6vw,44px);gap:12px}
.pagecraft-nav-menu .pagecraft-mobile-menu .sub-menu{display:flex;position:static;flex-direction:column;min-width:0;padding:0 0 0 20px;box-shadow:none;background:transparent;font-size:.85em}
.pagecraft-nav-icon{position:relative;display:block;width:20px;height:2px;background:currentColor;border-radius:2px;transition:background-color .2s ease}
.pagecraft-nav-icon::before,.pagecraft-nav-icon::after{content:"";position:absolute;left:0;width:20px;height:2px;background:currentColor;border-radius:2px;transition:transform .2s ease}
.pagecraft-nav-icon::before{transform:translateY(-6px)}
.pagecraft-nav-icon::after{transform:translateY(6px)}
[data-nav].is-open .pagecraft-nav-icon{background-color:transparent}
[data-nav].is-open .pagecraft-nav-icon::before{transform:rotate(45deg)}
[data-nav].is-open .pagecraft-nav-icon::after{transform:rotate(-45deg)}
.pagecraft-form{display:var(--f-layout,flex);grid-template-columns:var(--f-columns,1fr);flex-wrap:wrap;gap:var(--f-gap,16px);width:100%}
.pagecraft-field{display:flex;flex-direction:column;gap:5px;flex:1 1 100%;min-width:0}
.pagecraft-field.half{flex:1 1 calc(50% - var(--f-gap,16px) / 2);min-width:12rem}
.pagecraft-field label{font-size:.82em;font-weight:500;color:var(--f-label,inherit)}
.pagecraft-field input,.pagecraft-field textarea,.pagecraft-field select{
  font:inherit;color:var(--f-text,inherit);background:var(--f-bg,#fff);
  border:1px solid var(--f-border,#ddd);border-radius:var(--f-radius,8px);
  padding:var(--f-pad,11px 13px);width:100%;
}
.pagecraft-field textarea{resize:vertical}
.pagecraft-field input:focus,.pagecraft-field textarea:focus,.pagecraft-field select:focus{outline:2px solid var(--f-btn-bg,#333);outline-offset:1px}
.pagecraft-field-check{flex-direction:row;align-items:center;gap:9px}
.pagecraft-field-check input{width:auto;padding:0}
.pagecraft-field-check label{font-size:1em}
.pagecraft-form-button{
  font:inherit;font-weight:600;cursor:pointer;border:0;align-self:var(--f-button-align,flex-start);flex:0 0 auto;
  background:var(--f-btn-bg,#111);color:var(--f-btn-fg,#fff);
  border-radius:var(--f-radius,8px);padding:var(--f-pad,11px 13px);padding-left:26px;padding-right:26px;
}
.pagecraft-form-button:disabled{cursor:not-allowed;opacity:.55}
.pagecraft-form-status{grid-column:1 / -1;flex:1 1 100%;margin:0;font-size:.82em;color:var(--f-label,inherit)}
:where(.pagecraft-divider){width:100%;border:0 solid transparent;border-top:1px solid var(--c-line);margin:20px 0;align-self:stretch}
.pagecraft-spacer{width:100%;flex:0 0 auto}
:where(.pagecraft-spacer){height:48px}

.pagecraft-accordion{display:flex;flex-direction:column;gap:var(--ac-gap,0px);width:100%}
.pagecraft-accordion-item{border-top:1px solid var(--ac-line,currentColor);border-radius:var(--ac-radius,0px)}
.pagecraft-accordion-item:last-child{border-bottom:1px solid var(--ac-line,currentColor)}
.pagecraft-accordion-q{
  display:flex;align-items:center;justify-content:space-between;gap:16px;cursor:pointer;
  padding:var(--ac-pad,18px) 0;list-style:none;
  font-size:var(--ac-q-size,17px);font-weight:var(--ac-q-weight,600);
  color:var(--ac-q-color,inherit);line-height:1.35;
}
.pagecraft-accordion-q::-webkit-details-marker{display:none}
.pagecraft-accordion-q::marker{content:""}
.pagecraft-accordion-a{
  font-size:var(--ac-a-size,16px);color:var(--ac-a-color,inherit);
  line-height:1.65;padding:0 0 var(--ac-pad,18px);max-width:72ch;
}
.pagecraft-accordion-a>:first-child{margin-top:0}
.pagecraft-accordion-a>:last-child{margin-bottom:0}
.pagecraft-accordion-a p{margin:0 0 .85em}
.pagecraft-accordion-mark{
  position:relative;flex:0 0 auto;width:16px;height:16px;
  color:var(--ac-mark,currentColor);transition:transform .2s ease;
}
.pagecraft-accordion-mark::before,.pagecraft-accordion-mark::after{
  content:"";position:absolute;left:50%;top:50%;background:currentColor;border-radius:1px;
}
.pagecraft-accordion-mark::before{width:15px;height:1.8px;margin:-.9px 0 0 -7.5px;transform:none}
.pagecraft-accordion-mark::after{width:1.8px;height:15px;margin:-7.5px 0 0 -.9px;transform:none;transition:transform .2s ease}
[data-marker=plus] [open]>.pagecraft-accordion-q .pagecraft-accordion-mark::after{transform:scaleY(0)}
[data-marker=caret] .pagecraft-accordion-mark::before{
  width:10.5px;height:1.8px;margin:-.9px 0 0 -8.9px;transform:rotate(45deg);transform-origin:right center;
}
[data-marker=caret] .pagecraft-accordion-mark::after{
  width:10.5px;height:1.8px;margin:-.9px 0 0 -1.6px;transform:rotate(-45deg);transform-origin:left center;
}
[data-marker=caret] [open]>.pagecraft-accordion-q .pagecraft-accordion-mark{transform:rotate(180deg)}

.pagecraft-embed{width:100%}
.pagecraft-embed>*{max-width:100%}
.pagecraft-embed-ratio{position:relative}
.pagecraft-embed-ratio>iframe,.pagecraft-embed-ratio>video,.pagecraft-embed-ratio>embed,.pagecraft-embed-ratio>object{
  position:absolute;inset:0;width:100%;height:100%;border:0;
}

.pagecraft-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;color:inherit;text-decoration:none}
.pagecraft-icon-glyph{
  display:block;flex:0 0 auto;box-sizing:content-box;
  width:var(--icon-size,30px);height:var(--icon-size,30px);stroke-width:var(--icon-stroke,1.75);
}

.pagecraft-gallery{display:grid;grid-template-columns:repeat(var(--g-cols,3),minmax(0,1fr));gap:var(--g-gap,12px);width:100%}
.pagecraft-gallery-item{margin:0;display:flex;flex-direction:column;min-width:0}
.pagecraft-gallery-frame{
  display:block;position:relative;overflow:hidden;
  border-radius:var(--g-radius,10px);background:rgba(17,19,17,.05);
}
.pagecraft-gallery-img{display:block;width:100%;height:auto}
.pagecraft-gallery-fixed .pagecraft-gallery-frame{aspect-ratio:var(--g-ratio,4 / 3)}
.pagecraft-gallery-fixed .pagecraft-gallery-img{height:100%;object-fit:var(--g-fit,cover)}
.pagecraft-gallery-caption{font-size:.82em;opacity:.7;margin-top:.5em}
.pagecraft-lightbox{
  padding:0;border:0;background:transparent;width:100%;height:100%;
  max-width:100vw;max-height:100vh;overflow:hidden;
}
.pagecraft-lightbox::backdrop{background:rgba(10,12,10,.93)}
.pagecraft-lightbox-fig{
  margin:0;width:100%;height:100%;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:16px;padding:clamp(16px,4vw,48px);
}
.pagecraft-lightbox-img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px}
.pagecraft-lightbox-cap{margin:0;color:#f2f2ee;font-size:14px;line-height:1.5;text-align:center;max-width:64ch}
.pagecraft-lightbox-btn{
  position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;
  display:grid;place-items:center;border:0;border-radius:50%;cursor:pointer;
  background:rgba(255,255,255,.14);color:#fff;font:400 22px/1 system-ui,sans-serif;
}
.pagecraft-lightbox-btn:hover{background:rgba(255,255,255,.26);color:#fff}
.pagecraft-lightbox-prev{left:14px}
.pagecraft-lightbox-next{right:14px}
.pagecraft-lightbox-close{position:absolute;top:14px;right:14px;transform:none}
.pagecraft-lightbox-btn[hidden]{display:none}

.pagecraft-button:focus-visible,.pagecraft-form-button:focus-visible,
.pagecraft-nav-list a:focus-visible,.pagecraft-nav-toggle:focus-visible,
.pagecraft-heading a:focus-visible,.pagecraft-wysiwyg a:focus-visible,
.pagecraft-figure:focus-visible,.pagecraft-icon:focus-visible,
.pagecraft-gallery-frame:focus-visible,.pagecraft-accordion-q:focus-visible,
.pagecraft-lightbox-btn:focus-visible{outline:3px solid currentColor;outline-offset:3px}
${t.css||""}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{
    animation-duration:.01ms !important;animation-iteration-count:1 !important;
    transition-duration:.01ms !important;scroll-behavior:auto !important;
  }
}
`+(e?`
:where([data-id]){position:relative}
[data-id]:hover{outline:1px solid #b7f34a;outline-offset:0}
.s-cond-off{opacity:.42;outline:1px dashed #7aa2f7;outline-offset:2px}
[data-t=section]:hover,[data-t=row]:hover,[data-t=column]:hover{outline:1px dashed #6f7771;outline-offset:-1px}
[data-t=column]{min-height:40px}
[data-t=tabs] [data-tab-idle]{display:none}
.pagecraft-video>iframe,.pagecraft-video>video{pointer-events:none}
.pagecraft-button,.pagecraft-heading a,.pagecraft-wysiwyg a{cursor:default}
.s-empty{
  display:flex;align-items:center;justify-content:center;gap:7px;min-height:76px;width:100%;
  border:1px dashed #cbd2d8;border-radius:8px;color:#6f7771;
  font:500 ${oe.label} "DM Sans",system-ui,sans-serif;background:#f5f7f880;
}
.s-held{
  display:block;margin-top:8px;padding:7px 10px;border-radius:6px;
  background:#f5f7f8;border:1px dashed #cbd2d8;color:#6f7771;
  font:500 11.5px "DM Sans",system-ui,sans-serif;
}
[data-editing]{outline:1.5px solid #111311 !important;outline-offset:2px;cursor:text !important}
[data-editing] *{cursor:text !important}

/* global regions render as locked context and link to their own editor */
.s-region{position:relative}
.s-region[data-state=locked],.s-region[data-state=dim]{outline:1px dashed #cbd2d8;outline-offset:-1px}
/* locked and dimmed regions swallow interaction so global structure is never
   edited by accident; the chip stays clickable above them */
.s-region[data-state=locked]::after,.s-region[data-state=dim]::after{
  content:"";position:absolute;inset:0;z-index:9000;cursor:default;
}
.s-region[data-state=dim]>.s-rbody{opacity:.3}
.s-region[data-state=edit]{outline:1.5px solid #b7f34a;outline-offset:-1px}
.s-region[data-kind=main][data-state=edit]{outline:none}
.s-lockbar{
  position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:9001;
  display:flex;gap:6px;opacity:0;pointer-events:none;transition:opacity .14s ease;
}
/* wayfinding, not furniture \u2014 revealed on hover so it stays out of the way */
.s-region:hover>.s-lockbar{opacity:1;pointer-events:auto}
/* nothing stays pinned over the canvas \u2014 the way out lives in the chrome */
.s-lockchip,.s-lockopen{
  display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:6px;
  font:500 12px "DM Sans",system-ui,sans-serif;white-space:nowrap;
  background:#fff;border:1px solid #dfe4e7;color:#4b504b;box-shadow:0 8px 20px -10px #11131140;
}
.s-lockchip svg{color:#6f7771}
.s-lockopen{cursor:pointer;background:#111311;border-color:#111311;color:#f5f7f8}
.s-lockopen svg{color:#b7f34a}
.s-lockchip.on{background:#111311;border-color:#111311;color:#f5f7f8}
.s-lockchip.on svg{color:#b7f34a}

#s-root{min-height:100%}
.s-canvas-empty{
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  min-height:60vh;color:#6f7771;font:500 ${oe.body} "DM Sans",system-ui,sans-serif;
  text-align:center;padding:40px;
}
.s-canvas-empty b{font-size:16px;color:#111311;font-weight:600;font-family:"Manrope",system-ui,sans-serif}
.s-openadd{
  margin-top:4px;padding:7px 14px;border-radius:8px;cursor:pointer;border:0;
  background:#111311;color:#f5f7f8;font:600 ${oe.label} "Manrope",system-ui,sans-serif;
}
.s-openadd:hover{background:#2a2e2a}

/* selection: green outline plus the eight handles from the product screens */
#s-hud{position:absolute;top:0;left:0;z-index:9998;pointer-events:none}
/* Everything below divides by --z so it stays the same size on screen whatever the
   canvas is scaled to. The frame's *position* still comes from the element, which is
   what keeps it locked on; only its thickness is corrected. */
#s-hud .frame{position:absolute;outline:calc(1.5px / var(--z,1)) solid #b7f34a;pointer-events:none}
#s-hud .frame i{
  position:absolute;background:#b7f34a;border-radius:1px;
  width:calc(7px / var(--z,1));height:calc(7px / var(--z,1));
}
#s-hud .frame i.nw{left:calc(-4px / var(--z,1));top:calc(-4px / var(--z,1))}
#s-hud .frame i.ne{right:calc(-4px / var(--z,1));top:calc(-4px / var(--z,1))}
#s-hud .frame i.sw{left:calc(-4px / var(--z,1));bottom:calc(-4px / var(--z,1))}
#s-hud .frame i.se{right:calc(-4px / var(--z,1));bottom:calc(-4px / var(--z,1))}
#s-hud .frame i.n{left:50%;margin-left:calc(-3.5px / var(--z,1));top:calc(-4px / var(--z,1))}
#s-hud .frame i.s{left:50%;margin-left:calc(-3.5px / var(--z,1));bottom:calc(-4px / var(--z,1))}
#s-hud .frame i.w{top:50%;margin-top:calc(-3.5px / var(--z,1));left:calc(-4px / var(--z,1))}
#s-hud .frame i.e{top:50%;margin-top:calc(-3.5px / var(--z,1));right:calc(-4px / var(--z,1))}
#s-hud .frame.alt{outline:calc(1.5px / var(--z,1)) dashed #b7f34a;opacity:.8}
/* Column gutter grips. They live in the HUD overlay rather than the canvas DOM,
   so nothing about resizing can leak into the export. */
#s-hud .grip{
  position:absolute;width:calc(11px / var(--z,1));margin-left:calc(-5.5px / var(--z,1));
  pointer-events:auto;cursor:col-resize;display:flex;align-items:center;justify-content:center;
}
#s-hud .grip::before{content:'';width:3px;height:100%;border-radius:2px;background:#b7f34a;opacity:.35;transition:opacity .12s}
#s-hud .grip:hover::before,#s-hud .grip.on::before{opacity:1}
#s-hud .gtip{
  position:absolute;transform:scale(calc(1 / var(--z,1))) translate(-50%,-100%);
  transform-origin:50% 100%;background:#111311;color:#f5f7f8;
  border-radius:5px;padding:3px 7px;pointer-events:none;white-space:nowrap;
  font:500 11px "DM Sans",system-ui,sans-serif;
}
#s-hud .bar{
  position:absolute;display:flex;flex-wrap:wrap;align-items:center;gap:1px;background:#111311;color:#f5f7f8;
  box-sizing:border-box;width:max-content;max-width:calc(100vw * var(--z,1) - 8px);
  border-radius:6px 6px 0 0;padding:3px 3px 3px 8px;pointer-events:auto;white-space:nowrap;
  transform:scale(calc(1 / var(--z,1)));transform-origin:0 0;
  font:500 12px "DM Sans",system-ui,sans-serif;
}
#s-hud .bar .nm{padding-right:6px}
#s-hud .bar button{
  width:20px;height:20px;border:0;background:none;color:#f5f7f8;display:grid;place-items:center;
  border-radius:4px;cursor:pointer;padding:0;opacity:.75;
}
#s-hud .bar button:hover{background:#ffffff26;opacity:1;color:#b7f34a}
#s-hud .bar button.g{cursor:grab}
#s-drop{position:absolute;z-index:9999;pointer-events:none;background:#b7f34a;border-radius:2px;box-shadow:0 0 0 calc(1px / var(--z,1)) #11131126}
#s-drop-label{position:absolute;z-index:10000;pointer-events:none;box-sizing:border-box;width:max-content;max-width:calc(100vw * var(--z,1) - 8px);padding:5px 8px;border-radius:4px;background:#111311;color:#f5f7f8;font:500 12px "DM Sans",system-ui,sans-serif;transform:scale(calc(1 / var(--z,1)));transform-origin:0 0;white-space:normal}
#s-drop.box{background:#b7f34a24;border:1.5px solid #b7f34a;border-radius:8px;box-shadow:none}
`:"")}function Le(e){let t=String(e.src||"").trim(),n=o=>o&&/^[\w-]{6,}$/.test(o)?o:"";try{let o=new URL(t);if((o.protocol==="http:"||o.protocol==="https:")&&!o.username&&!o.password){let i=o.hostname.toLowerCase(),r=o.pathname.split("/").filter(Boolean),a=new Set(["youtube.com","www.youtube.com","m.youtube.com","music.youtube.com"]),s="";if(a.has(i)?o.pathname==="/watch"?s=n(o.searchParams.get("v")):["embed","shorts","live"].includes(r[0])&&(s=n(r[1]||"")):(i==="youtu.be"||i==="www.youtu.be")&&(s=n(r[0]||"")),s)return{kind:"youtube",id:s};if(new Set(["vimeo.com","www.vimeo.com"]).has(i)||i==="player.vimeo.com"){let p=r[0]==="video"?r[1]:i==="player.vimeo.com"?"":r[0];if(p&&/^\d+$/.test(p))return{kind:"vimeo",id:p}}}}catch{}return/\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i.test(t)||t.startsWith("data:video")?{kind:"file",id:t}:{kind:t?"other":"none",id:t}}function xr(e){return e.poster||""}var et=e=>{let t=Le(e),n=[];return e.autoplay&&n.push("autoplay=1"),(e.muted||e.autoplay)&&n.push("mute=1","muted=1"),e.loop&&n.push("loop=1"),e.controls||n.push("controls=0"),t.kind==="youtube"?`https://www.youtube.com/embed/${t.id}?${n.concat(e.loop?["playlist="+t.id]:[]).join("&")}`:t.kind==="vimeo"?`https://player.vimeo.com/video/${t.id}?${n.join("&")}`:t.id},wr=e=>e.facade&&!e.autoplay&&["youtube","vimeo"].includes(Le(e).kind);function vr(e){let t=Le(e);return t.kind==="youtube"?`<iframe src="${f(et(e))}" title="Video" allow="accelerometer;autoplay;clipboard-write;encrypted-media;picture-in-picture" allowfullscreen loading="lazy"></iframe>`:t.kind==="vimeo"?`<iframe src="${f(et(e))}" title="Video" allow="autoplay;fullscreen;picture-in-picture" allowfullscreen loading="lazy"></iframe>`:t.kind==="file"?`<video src="${f(t.id)}"${e.controls?" controls":""}${e.autoplay?" autoplay":""}${e.muted||e.autoplay?" muted playsinline":""}${e.loop?" loop":""}${e.poster?` poster="${f(e.poster)}"`:""}></video>`:t.kind==="none"?'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#94a3b8;font:500 13px sans-serif">Add a video URL</div>':`<iframe src="${f(t.id)}" title="Video" allowfullscreen loading="lazy"></iframe>`}function Ee(e){let t=String(e??"").replace(/\r\n?/g,`
`).trim();return t?t.split(/\n{2,}/).map(n=>`<p>${f(n).replace(/\n/g,"<br>")}</p>`).join(""):""}function fe(e){let t=String(e??""),n=t.toLowerCase(),o=new Set(["script","style","textarea","title","xmp","iframe","noembed","noframes","plaintext"]),i=p=>{let d="";for(let u=p;u<t.length;u++){let m=t[u];if(d)m===d&&(d="");else if(m==='"'||m==="'")d=m;else if(m===">")return u}return-1},r=(p,d)=>{let u=d;for(;(u=n.indexOf(`</${p}`,u))>=0;){let m=n[u+p.length+2]||"";if(!m||/[\s/>]/.test(m))return u;u+=p.length+2}return-1},a=p=>p.replace(/^(<\s*\/?\s*)main\b/i,"$1div"),s="",l=0;for(;l<t.length;){let p=t.indexOf("<",l);if(p<0){s+=t.slice(l);break}if(s+=t.slice(l,p),t[p+1]==="!"&&t[p+2]==="-"&&t[p+3]==="-"){let P=t.indexOf("-->",p+4),B=P<0?t.length:P+3;s+=t.slice(p,B),l=B;continue}let d=i(p+1);if(d<0){s+=t.slice(p);break}let u=t.slice(p,d+1),m=u.match(/^<\s*(\/?)\s*([a-z][\w:-]*)\b/i),g=!!(m&&m[1]),$=m?m[2].toLowerCase():"";if(!$||g||!o.has($)||/\/\s*>$/.test(u)){s+=$==="main"?a(u):u,l=d+1;continue}let C=r($,d+1);if(C<0){s+=u+t.slice(d+1);break}let D=i(C+2+$.length);if(D<0){s+=u+t.slice(d+1);break}s+=u+t.slice(d+1,D+1),l=D+1}return s}var kr={arrow:ue.arrow,check:ue.check,plus:ue.plus};function $r(e,t,n,o){let i=l=>f((o.rel||"")+st(e.slug,l)),r=l=>l===t?`<span class="pagecraft-page on" aria-current="page">${l}</span>`:`<a class="pagecraft-page" href="${i(l)}">${l}</a>`,a=(l,p,d)=>l>=1&&l<=n?`<a class="pagecraft-page ${d}" href="${i(l)}" rel="${d}">${p}</a>`:`<span class="pagecraft-page ${d} off" aria-hidden="true">${p}</span>`,s=Array.from({length:n},(l,p)=>r(p+1)).join("");return'<nav class="pagecraft-pager" aria-label="Pages">'+a(t-1,"Previous","prev")+s+a(t+1,"Next","next")+"</nav>"}var Sr=["section","div","header","footer","main","article","aside","nav"],Cr=["div","article","aside","nav","header","footer","main","section","ul","ol","li"];function he(e,t){if(!be[e.type])return"";if(e.use&&!(t.inst&&t.inst===e)){let h=ee(e.use);return h&&(t.stack||[]).includes(e.use)?t.edit?`<div id="${f(e.id)}" data-id="${f(e.id)}" data-t="${f(e.type)}" class="s-missing">${f(h.name)} contains itself</div>`:"":h?he(h.node,{...t,inst:e,cdef:h,stack:[...t.stack||[],e.use]}):t.edit?`<div id="${f(e.id)}" data-id="${f(e.id)}" data-t="${f(e.type)}" class="s-missing">Missing component: ${f(e.use)}</div>`:""}let o=t.inst&&t.cdef&&e===t.cdef.node?t.inst:null,i=!!t.inst&&!o,r=o||e,a=r.props.ts&&Ge(r.props.ts)?" ts-"+r.props.ts:e.props.ts&&Ge(e.props.ts)?" ts-"+e.props.ts:"",s=xe(r).map(h=>" c-"+h.id).join("")+(o?xe(e).map(h=>" c-"+h.id).join(""):""),l=t.edit?{cls:"",at:""}:Xo(r),p="",d=h=>`class="${h} ${f(Je(e))}${o?" "+f(Je(o)):""}${a}${s}${l.cls}${p}${r.adv&&r.adv.cls?" "+f(r.adv.cls):""}"`,u=t.repeat&&t.item?"-"+t.item.slug:"",m=i&&t.inst?"-"+String(t.inst.id).replace(/^n/,""):"",g=r.src||e.src,$=g?K(g):null,C=$?{...t,col:$,item:or($,t.col||null,t.item||null,!!t.repeat)}:t,D=t.edit?f(t.repIndex?r.id+u+m:r.id+m):f(Cn(r)+u+m),P=t.edit&&!i&&t.repeat&&C.col&&C.item&&dn(C.col,C.item.id)?` data-cms-col="${f(C.col.id)}" data-cms-item="${f(C.item.id)}"`:"",B=i?"":` data-id="${f(r.id)}" data-t="${f(r.type)}"${P}${b.ui.sel===r.id?" data-sel":""}`,x=`id="${D}"${t.edit?B:""}${l.at}`,X=e.slot&&t.inst?gr(t.inst,t.cdef||null,e.slot):null,Bn=X&&X.length?X:e.children||[],_n=X&&X.length?{...C,inst:null,cdef:null}:C,se=e.type==="list"?"":Bn.map(h=>he(h,_n)).join(""),c=ir(e,C.col||null,C.item||null,t.inst||null,t.cdef||null),le=c.target==="_blank"?' target="_blank" rel="noopener"':"";if(e.showIf&&!sr(e,C.col||null,C.item||null,t.inst||null,t.cdef||null)){if(!t.edit)return"";p=" s-cond-off"}switch(e.type){case"section":{let h=c.tag&&Sr.includes(c.tag)?c.tag:"section",w=se||(t.edit?`<div class="s-empty">${j("plus",12)} Drop a Row or component here</div>`:"");return`<${h} ${x} ${d("pagecraft-section")}><div class="pagecraft-container${c.width==="full"?" full":""}">${w}</div></${h}>`}case"row":return`<div ${x} ${d("pagecraft-row")}>${se||(t.edit?`<div class="s-empty">${j("plus",12)} Drop a Column</div>`:"")}</div>`;case"box":{let h=c.layout==="flex"||c.layout==="grid"?" l-"+c.layout:"",w=Q(c.link,t),k=e.css.d?.position==="absolute"&&!!(e.css.d?.["background-image"]||e.css.d?.["background-color"]||e.css.d?.background),y=se||(t.edit&&!k?`<div class="s-empty">${j("plus",12)} Drop anything here</div>`:"");if(w)return`<a ${x} ${d("pagecraft-box"+h)} href="${f(w)}"${le}>${y}</a>`;let A=c.tag&&Cr.includes(c.tag)?c.tag:"div";return`<${A} ${x} ${d("pagecraft-box"+h)}>${y}</${A}>`}case"slider":{let h=`<div ${x} ${d("pagecraft-slider")} data-slides role="group" aria-label="${f(String(c.aria||"Slides"))}" tabindex="0">`+(se||(t.edit?`<div class="s-empty">${j("plus",12)} Drop a Column \u2014 it becomes a slide</div>`:""))+"</div>";if(!c.arrows)return h;let w=(k,y)=>`<button type="button" class="pagecraft-slide-btn ${k}" data-slide-${k} aria-label="${y}" hidden>${j("caret",15)}</button>`;return`<div class="pagecraft-slider-box${c.controlsPosition==="bottom"?" controls-bottom":""}" data-slider>${h}`+w("p","Previous slides")+w("n","Next slides")+'<div class="pagecraft-slider-dots" data-slide-dots role="group" aria-label="Choose a slide" hidden></div></div>'}case"list":{let h=e.src?K(e.src):null,w=e.children||[];if(!h)return t.edit?`<div ${x} ${d("pagecraft-list")}><div class="s-empty">${j("plus",12)} Pick a collection for this list</div></div>`:"";if(!w.length)return t.edit?`<div ${x} ${d("pagecraft-list")}><div class="s-empty">${j("plus",12)} Drop a Column \u2014 it becomes the card</div></div>`:"";let k=un(e,h);if(!k.length){let E=!!ve(h,c.where)&&Ut.some(([z])=>z===c.op)&&(c.op==="set"||c.op==="unset"||String(c.val??"").trim()!==""),N=h.items.length?E&&pn(h).length?"No items match these filters.":"No items to display.":`${f(h.name)} has no items yet`;return t.edit?`<div ${x} ${d("pagecraft-list")}><div class="s-empty">${N}</div></div>`:""}let y=parseInt(String(c.per||""),10),A=y>0&&t.pg?Qo(t.pg):null,I=!!A&&A.node.id===e.id,T=I?Jo(e,h):1,S=I?Math.min(Math.max(1,t.pageNo||1),T):1,U=(I?k.slice((S-1)*y,S*y):k).map((E,N)=>w.map(z=>he(z,{...t,col:h,item:E,repeat:!0,repIndex:N})).join("")).join(""),F=c.collectionLayout==="slider"?`<div class="pagecraft-slider-box controls-bottom" data-slider><div ${x} ${d("pagecraft-list pagecraft-slider")} data-slides role="group" aria-label="${f(h.name)}" tabindex="0">${U}</div><button type="button" class="pagecraft-slide-btn p" data-slide-p aria-label="Previous slides" hidden>${j("caret",15)}</button><button type="button" class="pagecraft-slide-btn n" data-slide-n aria-label="Next slides" hidden>${j("caret",15)}</button><div class="pagecraft-slider-dots" data-slide-dots role="group" aria-label="Choose a slide" hidden></div></div>`:`<div ${x} ${d("pagecraft-list")}>${U}</div>`;return I&&T>1?F+$r(t.pg,S,T,t):F}case"column":return`<div ${x} ${d("pagecraft-column")}>${se||(t.edit?`<div class="s-empty">${j("plus",12)} Drop a component</div>`:"")}</div>`;case"heading":{let h=c.level&&/^(h[1-6]|p|div)$/.test(c.level)?c.level:"h2",w=f(c.text).replace(/\n/g,"<br>"),k=Q(c.link,t),y=k?`<a href="${f(k)}"${le}>${w}</a>`:w;return`<${h} ${x} ${d("pagecraft-heading")}>${y}</${h}>`}case"text":return`<div ${x} ${d("pagecraft-wysiwyg")}>${c.html||(t.edit?"<p></p>":"")}</div>`;case"quote":{let h=`<p>${f(c.text).replace(/\n/g,"<br>")}</p>`,w=Se(c.source),k=w?` cite="${f(w)}"`:"",y=String(c.by||"").trim();if(!y)return`<blockquote ${x}${k} ${d("pagecraft-quote")}>${h}</blockquote>`;let A=w?`<a href="${f(w)}">${f(y)}</a>`:f(y);return`<figure ${x} ${d("pagecraft-quote")}><blockquote${k}>${h}</blockquote><figcaption class="pagecraft-attrib">${A}</figcaption></figure>`}case"image":{let h=f(c.src||Ot),w=!t.edit&&c.lazy?' loading="lazy" decoding="async"':"",k=c.w&&c.h?` width="${parseInt(c.w,10)}" height="${parseInt(c.h,10)}"`:c.src?"":' width="800" height="500"',y=` alt="${c.decorative?"":f(c.alt)}"`,A=Q(c.link,t),I=c.decorative&&String(c.label||"").trim()?` aria-label="${f(String(c.label).trim())}"`:"",T=t.variants&&!t.edit&&/^asset:[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(String(c.src||""))?_o(c.w).map(R=>`${c.src}@${R} ${R}w`):[],S=T.length?` srcset="${f(T.join(", "))}" sizes="${f(qo(e.id))}"`:"";if(c.caption){let R=`<img src="${h}"${S}${y}${k}${w} class="pagecraft-image">`;return`<figure ${x} ${d("pagecraft-figure")}>${A?`<a href="${f(A)}"${le}${I}>${R}</a>`:R}<figcaption class="pagecraft-caption">${f(c.caption)}</figcaption></figure>`}return A?`<a ${x} ${d("pagecraft-figure")} href="${f(A)}"${le}${I}><img src="${h}"${S}${y}${k}${w} class="pagecraft-image"></a>`:`<img ${x} src="${h}"${S}${y}${k}${w} ${d("pagecraft-image")}>`}case"video":{let h=`${x} ${d("pagecraft-video")} style="aspect-ratio:${f(c.ratio||"16 / 9")}"`;if(!wr(c))return`<div ${h}>${vr(c)}</div>`;let w=xr(c);return`<div ${h} data-facade><button class="pagecraft-video-play" type="button" data-embed="${f(et(c))}" aria-label="Play video">`+(w?`<img src="${f(w)}" alt="" loading="lazy" decoding="async">`:"")+'<span class="pagecraft-video-icon" aria-hidden="true"></span></button></div>'}case"button":{let h=c.icon&&c.icon!=="none"?`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${kr[c.icon]||""}</svg>`:"",w=Q(c.link,t),k=w?"a":"button",y=String(c.rel||"").trim().split(/\s+/).filter(Boolean);c.target==="_blank"&&!y.includes("noopener")&&y.push("noopener");let A=w?`href="${f(w)}"${c.target==="_blank"?' target="_blank"':""}${y.length?` rel="${f(y.join(" "))}"`:""}`:'type="button"',I=["outline","ghost","link"].includes(String(c.variant))?String(c.variant):"solid";return`<${k} ${x} ${d("pagecraft-button")} data-variant="${I}" ${A}><span>${f(c.text)}</span>${h}</${k}>`}case"nav":{let h=c.managedMobileLinks&&t.edit&&b.ui.mode==="component"&&b.ui.cedit?xn(b.ui.cedit):null,w=c.managedMobileLinks?t.mobileMenuItems||(Array.isArray(h?.node.props.items)?h.node.props.items:[]):Array.isArray(c.items)?c.items:[],k=f(c.aria||"Main"),y=D+"-menu",A=/^[a-z0-9_-]+$/.test(String(c.menuLocation||""))?` data-pagecraft-menu-location="${f(String(c.menuLocation))}"`:"",I=new Map(w.filter(F=>F.id).map(F=>[String(F.id),F])),T=(F,E)=>w.filter(N=>{let z=String(N.parentId||"");return F?z===F:!z||!I.has(z)}).map(N=>{let z=String(N.id||"");if(z&&E.has(z))return"";let Z=String(N.cls||"").trim().split(/\s+/).filter(Boolean),ce=new Set(E);z&&ce.add(z);let de=z?T(z,ce):"";de&&Z.push("menu-item-has-children");let te=Z.length?` class="${f(Array.from(new Set(Z)).join(" "))}"`:"",J=String(N.rel||"").trim().split(/\s+/).filter(Boolean);N.target==="_blank"&&!J.includes("noopener")&&J.push("noopener");let ne=N.target==="_blank"?' target="_blank"':"",Hn=J.length?` rel="${f(J.join(" "))}"`:"";return`<li${te}><a href="${f(Q(N.href,t)||"#")}"${ne}${Hn}>${f(N.label||"")}</a>`+(de?`<ul class="sub-menu">${de}</ul>`:"")+"</li>"}).join("");if(c.managedMobileLinks)return`<div ${x} ${d("pagecraft-nav-menu pagecraft-mobile-nav-links")}><ul class="pagecraft-nav-list pagecraft-managed-mobile-links">${T("",new Set)}</ul></div>`;let S=c.mobileMenu!=="fullscreen"?cr({...e,props:c}):null,R=S?{...S.node,id:r.id+"-mobile",use:S.id,children:[],css:{d:{},t:{},m:{}},cls:[],adv:{htmlId:"",cls:"",css:""}}:null,U=R?`<div id="${y}-content" data-nav-content hidden>${he(R,{...t,inst:void 0,cdef:void 0,mobileMenuItems:w})}</div>`:"";return`<nav ${x} ${d("pagecraft-nav-menu")} data-nav data-mobile-menu="${c.mobileMenu==="fullscreen"?"fullscreen":"dropdown"}"${A} aria-label="${k}"><button class="pagecraft-nav-toggle" data-nav-t type="button" aria-expanded="false" aria-controls="${R?y+"-content":y}" aria-label="${k} menu"><span class="pagecraft-nav-icon"></span></button><ul class="pagecraft-nav-list" id="${y}" data-nav-l>`+T("",new Set)+`</ul>${U}</nav>`}case"form":{let h=Array.isArray(c.fields)?c.fields:[],w=E=>D+"-f"+E,k=String(r.id||e.id).replace(/[^A-Za-z0-9_-]/g,""),y=no(c,k),A=y.action,I=A?"":" disabled",T=new Set(h.map(Et)),S=y.kind==="external"&&y.method==="get"?Array.from(new URL(y.action).searchParams.entries()).filter(([E])=>!T.has(E)).map(([E,N])=>`<input type="hidden" name="${f(E)}" value="${f(N)}">`).join(""):"",R=h.some(E=>[100,50,33,25,20].includes(Number(E.width))),U=h.map((E,N)=>{let z=f(Et(E,N)),Z=E.required?" required":"",ce=E.ph?` placeholder="${f(E.ph)}"`:"",de=[100,50,33,25,20].includes(Number(E.width))?Number(E.width):E.half?50:100,te=R?" field-width-"+de:E.half?" half":"",J=`<label for="${w(N)}">${f(E.label||z)}${E.required?' <span aria-hidden="true">*</span>':""}</label>`;return E.type==="checkbox"?`<div class="pagecraft-field pagecraft-field-check${te}"><input id="${w(N)}" name="${z}" type="checkbox"${Z}${I}><label for="${w(N)}">${f(E.label||z)}</label></div>`:E.type==="textarea"?`<div class="pagecraft-field${te}">${J}<textarea id="${w(N)}" name="${z}" rows="4"${Z}${ce}${I}></textarea></div>`:E.type==="select"?`<div class="pagecraft-field${te}">${J}<select id="${w(N)}" name="${z}"${Z}${I}>`+String(E.opts||"").split(",").map(ne=>ne.trim()).filter(Boolean).map(ne=>`<option value="${f(ne)}">${f(ne)}</option>`).join("")+"</select></div>":`<div class="pagecraft-field${te}">${J}<input id="${w(N)}" name="${z}" type="${f(E.type||"text")}"${Z}${ce}${I}></div>`}).join("");if(!A){let E=D+"-status";return`<div ${x} ${d("pagecraft-form"+(R?" pagecraft-form-percent":""))} role="group" aria-label="${f(c.aria||"Form")}" aria-describedby="${E}" data-disabled>`+U+`<button type="button" class="pagecraft-form-button" disabled>${f(c.submit||"Send")}</button><p class="pagecraft-form-status" id="${E}">This form is not configured to receive submissions.</p></div>`}let F=y.kind==="wordpress"?` data-pagecraft-form-mode="wordpress" data-pagecraft-form-id="${f(k)}"`:"";return`<form ${x} ${d("pagecraft-form"+(R?" pagecraft-form-percent":""))} aria-label="${f(c.aria||"Form")}" action="${f(A)}" method="${y.method}"${F}>`+S+U+(y.kind==="cloud"?'<div hidden aria-hidden="true"><label>Leave empty<input name="_pc_trap" tabindex="-1" autocomplete="off"></label></div>':"")+`<button type="submit" class="pagecraft-form-button">${f(c.submit||"Send")}</button></form>`+(y.kind==="cloud"&&!t.edit?"<script>(function(f){var ns='__pagecraftFormRequests',a=f.getAttribute('action')||'',n=0,forms=document.forms,x;for(x=0;x<forms.length;x++){if(forms[x]===f)break;if((forms[x].getAttribute('action')||'')===a)n++}var k=a+'#'+n,valid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;function uuid(){var c=window.crypto,b=new Uint8Array(16),j;if(c&&typeof c.randomUUID==='function')try{return c.randomUUID()}catch(e){}if(c&&typeof c.getRandomValues==='function')try{c.getRandomValues(b)}catch(e){for(j=0;j<16;j++)b[j]=Math.random()*256}else for(j=0;j<16;j++)b[j]=Math.random()*256;b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;var h=Array.from(b,function(v){return v.toString(16).padStart(2,'0')}).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)}function objectState(){var s=history.state;return s&&typeof s==='object'&&!Array.isArray(s)?s:null}function remember(v){var current=history.state;if(current!==null&&(!current||typeof current!=='object'||Array.isArray(current)))return;var next=Object.assign({},current||{}),prior=next[ns],requests=prior&&typeof prior==='object'&&!Array.isArray(prior)?Object.assign({},prior):{};requests[k]=v;next[ns]=requests;try{history.replaceState(next,'')}catch(e){}}var state=objectState(),requests=state&&state[ns]&&typeof state[ns]==='object'&&!Array.isArray(state[ns])?state[ns]:null,stored=requests&&requests[k],token=typeof stored==='string'&&valid.test(stored)?stored:uuid(),i=document.createElement('input');i.type='hidden';i.name='_pc_request';i.value=token;f.appendChild(i);if(stored!==token)remember(token);f.addEventListener('input',function(){i.value=uuid();remember(i.value)});window.addEventListener('pageshow',function(){var b=f.querySelector('button[type=submit]');if(b)b.disabled=false});f.addEventListener('submit',function(){setTimeout(function(){var b=f.querySelector('button[type=submit]');if(b)b.disabled=true},0)})})(document.currentScript.previousElementSibling)<\/script>":"")}case"crumbs":{let h=c.mode==="manual",w=h?(Array.isArray(c.items)?c.items:[]).map((y,A,I)=>({...y,label:String(y.label||""),href:A===I.length-1?"":String(y.href||"")})):Xt(t.pg,t,String(c.home==null?"Home":c.home));if(!w.length||!h&&t.pg&&Me(t.pg)&&w.length<2)return t.edit?`<nav ${x} ${d("pagecraft-crumbs")}><div class="s-empty">${j("crumbs",12)}`+(h?" Add a crumb in the panel":" The front page shows no trail")+"</div></nav>":"";let k=w.map((y,A)=>{let I=A===w.length-1,T=f(y.label),S=I?"":Q(y.href,t),R=h?String(y.cls||"").trim():"",U=R?` class="${f(R)}"`:"",F=h?String(y.rel||"").trim().split(/\s+/).filter(Boolean):[],E=h&&y.target==="_blank"?' target="_blank"':"";E&&!F.includes("noopener")&&F.push("noopener");let N=F.length?` rel="${f(F.join(" "))}"`:"";return`<li${U}>`+(I||!S?`<span aria-current="page">${T}</span>`:`<a href="${f(S)}"${E}${N}>${T}</a>`)+"</li>"}).join("");return`<nav ${x} ${d("pagecraft-crumbs")} aria-label="Breadcrumb" data-sep="${f(String(c.sep||"chevron"))}"><ol>${k}</ol></nav>`}case"code":{let h=String(c.body==null?"":c.body);if(!h.trim())return t.edit?`<div ${x} ${d("pagecraft-code")}><div class="s-empty">${j("codeblock",12)} Paste the code in the panel</div></div>`:"";let w=String(c.lang||"text"),k=xo(h,w);c.numbers&&(k=k.split(`
`).map(I=>`<span class="pagecraft-code-line">${I}</span>`).join(`
`));let y=String(c.title==null?"":c.title).trim(),A=y||c.copy?`<figcaption class="pagecraft-code-head">${y?`<span>${f(y)}</span>`:"<span></span>"}`+(c.copy?'<button type="button" class="pagecraft-code-copy" data-copy hidden>Copy</button>':"")+"</figcaption>":"";return`<figure ${x} ${d("pagecraft-code")}${c.softwrap?" data-wrap":""}${c.numbers?" data-numbers":""}>`+A+`<pre><code class="language-${f(w)}">${k}</code></pre></figure>`}case"table":{let h=ko(c.body);if(!h.length)return t.edit?`<div ${x} ${d("pagecraft-table-wrap")}><div class="s-empty">${j("plus",12)} Paste or type the rows in the panel</div></div>`:"";let w=String(c.caption==null?"":c.caption).trim(),k=c.head&&h.length>1?h[0]:null,y=k?h.slice(1):h,A=(S,R)=>c.rowhead&&R===0?`<th scope="row">${f(S)}</th>`:`<td>${f(S)}</td>`,I=k?`<thead><tr>${k.map(S=>`<th scope="col">${f(S)}</th>`).join("")}</tr></thead>`:"",T=`<tbody>${y.map(S=>`<tr>${S.map(A).join("")}</tr>`).join("")}</tbody>`;return`<div ${x} ${d("pagecraft-table-wrap")}><table class="pagecraft-table" data-rules="${f(String(c.rules||"rows"))}"${c.zebra?" data-zebra":""}>`+(w?`<caption>${f(w)}</caption>`:"")+I+T+"</table></div>"}case"tabs":{let h=Array.isArray(c.items)?c.items:[];if(!h.length)return t.edit?`<div ${x} ${d("pagecraft-tabs")}><div class="s-empty">${j("plus",12)} Add a tab in the panel</div></div>`:"";let w=t.edit&&b.ui.sel===e.id,k=T=>`${D}-t${T}`,y=T=>`${D}-p${T}`,A=h.map((T,S)=>`<button type="button" role="tab" id="${k(S)}" aria-controls="${y(S)}" aria-selected="${S===0?"true":"false"}" tabindex="${S===0?"0":"-1"}" class="pagecraft-tab${S===0?" on":""}">${f(T.label||"Tab "+(S+1))}</button>`).join(""),I=h.map((T,S)=>`<div role="tabpanel" id="${y(S)}" aria-labelledby="${k(S)}"${S===0||w?"":" data-tab-idle"} class="pagecraft-tabpanel">${Ee(T.panel)}</div>`).join("");return`<div ${x} ${d("pagecraft-tabs")} data-tabs><div class="pagecraft-tablist" role="tablist">${A}</div>${I}</div>`}case"accordion":{let h=Array.isArray(c.items)?c.items:[];if(!h.length)return t.edit?`<div ${x} ${d("pagecraft-accordion")}><div class="s-empty">${j("plus",12)} Add a question in the panel</div></div>`:"";let w=c.single?` name="${D}-ac"`:"",k=c.marker==="none"?"":'<span class="pagecraft-accordion-mark" aria-hidden="true"></span>',y=t.edit&&b.ui.sel===e.id,A=h.map((I,T)=>{let S=c.open==="all"||c.open==="first"&&T===0,R=y||(c.single?S&&T===0:S);return`<details class="pagecraft-accordion-item"${w}${R?" open":""}><summary class="pagecraft-accordion-q"><span>${f(String(I.q==null?"":I.q)).replace(/\n/g," ")}</span>${k}</summary><div class="pagecraft-accordion-a">${Ee(I.a)}</div></details>`}).join("");return`<div ${x} ${d("pagecraft-accordion")} data-marker="${f(c.marker||"plus")}">${A}</div>`}case"embed":{let h=String(c.html==null?"":c.html),w=e.bind&&e.bind.html?f(h):h,k=c.ratio?` style="aspect-ratio:${f(c.ratio)}"`:"",y="pagecraft-embed"+(c.ratio?" pagecraft-embed-ratio":"");if(!w.trim())return t.edit?`<div ${x} ${d("pagecraft-embed")}><div class="s-empty">${j("code",12)} Paste embed HTML in the panel</div></div>`:"";if(!t.edit&&!t.canvas)return`<div ${x} ${d(y)}${k}>${w}</div>`;if(!t.edit){let S='<!doctype html><meta charset="utf-8"><style>html,body{margin:0}body{display:flow-root}</style>'+w+(c.ratio?"":`<script>${Pr}<\/script>`);return`<div ${x} ${d(y)}${k}><iframe sandbox="allow-scripts" srcdoc="${f(S)}" title="Embed preview" data-embed-frame${c.ratio?"":' style="display:block;width:100%;height:150px;border:0"'}></iframe></div>`}let{html:A,stripped:I}=yt(w),T=I?`<div class="s-held">${I} script${I===1?"":"s"} held back here \u2014 ${I===1?"it runs":"they run"} on the exported page</div>`:"";return`<div ${x} ${d(y)}${k}>${A}${T}${A.trim()?"":'<div class="s-empty">Nothing to draw without its script</div>'}</div>`}case"icon":{let h=c.name&&pe[c.name]?c.name:"check",w=String(c.label==null?"":c.label).trim(),k=Q(c.link,t);return k?`<a ${x} ${d("pagecraft-icon")} href="${f(k)}"${le}${w?` aria-label="${f(w)}"`:""}>${ze(h,'class="pagecraft-icon-glyph" aria-hidden="true"')}</a>`:ze(h,`${x} ${d("pagecraft-icon pagecraft-icon-glyph")} ${w?`role="img" aria-label="${f(w)}"`:'aria-hidden="true"'}`)}case"gallery":{let h=(Array.isArray(c.items)?c.items:[]).filter(Boolean);if(!h.length)return t.edit?`<div ${x} ${d("pagecraft-gallery")}><div class="s-empty">${j("image",12)} Add images in the panel</div></div>`:"";let w=!t.edit&&c.lazy?' loading="lazy" decoding="async"':"",k=h.map((y,A)=>{let I=y.w&&y.h?` width="${parseInt(y.w,10)}" height="${parseInt(y.h,10)}"`:"",T=f(y.src||Ot),S=String(y.alt==null?"":y.alt),R=`<img src="${T}" alt="${f(S)}"${I}${w} class="pagecraft-gallery-img">`,U=S.trim()?S:String(y.caption==null?"":y.caption).trim()||`Open image ${A+1}`;return`<figure class="pagecraft-gallery-item">${c.lightbox?`<a class="pagecraft-gallery-frame" href="${T}" data-lb="${A}" aria-label="${f(U)}">${R}</a>`:`<span class="pagecraft-gallery-frame">${R}</span>`}${c.captions&&y.caption?`<figcaption class="pagecraft-gallery-caption">${f(y.caption)}</figcaption>`:""}</figure>`}).join("");return`<div ${x} ${d("pagecraft-gallery"+(c.ratio?" pagecraft-gallery-fixed":""))}${c.lightbox?" data-lightbox":""}${c.ratio?` style="--g-ratio:${f(c.ratio)};--g-fit:${c.fit==="contain"?"contain":"cover"}"`:` style="--g-fit:${c.fit==="contain"?"contain":"cover"}"`}>${k}</div>`}case"spacer":return`<div ${x} ${d("pagecraft-spacer")} aria-hidden="true"></div>`;case"divider":return`<hr ${x} ${d("pagecraft-divider")}>`}return""}var Ue=(e,t)=>e.map(n=>he(n,t)).join(""),ge=33.3333,Bt=66.6666,Mr={1:[[100]],2:[[50,50],[Bt,ge],[ge,Bt],[75,25],[25,75]],3:[[ge,ge,ge],[50,25,25],[25,50,25],[25,25,50]],4:[[25,25,25,25],[40,20,20,20],[20,20,20,40]],5:[[20,20,20,20,20]],6:[[16.6666,16.6666,16.6666,16.6666,16.6666,16.6666]]},yi=Object.keys(Mr).map(Number);var Ar={columns:{type:"row",label:"Columns",icon:"columns"},box:{type:"box",label:"Box",icon:"section",props:{layout:"block"}},flex:{type:"box",label:"Flex",icon:"row",props:{layout:"flex"}},grid:{type:"box",label:"Grid",icon:"columns",props:{layout:"grid"}},linkbox:{type:"box",label:"Link block",icon:"link",props:{layout:"block",link:"#"}}},xi=Object.fromEntries(Object.entries(Ar).map(([e,t])=>[e,t.type]));var Ir=`<script>
(function(){Array.prototype.forEach.call(document.querySelectorAll('[data-tabs]'),function(w){
var t=[].slice.call(w.querySelectorAll('[role=tab]')),p=[].slice.call(w.querySelectorAll('[role=tabpanel]'));
if(!t.length)return;w.setAttribute('data-tabs-ready','');
function show(i){t.forEach(function(b,k){var on=k===i;b.classList.toggle('on',on);
b.setAttribute('aria-selected',on?'true':'false');b.tabIndex=on?0:-1;
if(p[k]){if(on)p[k].removeAttribute('data-tab-idle');else p[k].setAttribute('data-tab-idle','');}});}
show(0);
t.forEach(function(b,k){b.addEventListener('click',function(){show(k);});
b.addEventListener('keydown',function(e){
var d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:e.key==='Home'?-999:e.key==='End'?999:0;
if(!d)return;e.preventDefault();
var i=d===-999?0:d===999?t.length-1:(k+d+t.length)%t.length;show(i);t[i].focus();});});
});})();
<\/script>
`,Er=`<script>
(function(){Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'),function(w){
var b=w.querySelector('[data-nav-t]'),list=w.querySelector('[data-nav-l]');if(!b||!list)return;
var content=w.querySelector('[data-nav-content]')||list;
var dialog=null,overflow='',anchor=document.createComment('mobile menu');content.before(anchor);
function position(){
 if(!dialog)return;
 var host=w.closest('header,[data-kind="header"]')||w;
 if(host===w)while(host.parentElement&&host.parentElement!==document.body&&host.parentElement.id!=='s-root'&&!host.parentElement.matches('.s-rbody,main'))host=host.parentElement;
 dialog.style.setProperty('--nav-top',Math.max(0,Math.min(window.innerHeight-80,host.getBoundingClientRect().bottom))+'px');
}
function set(o,restore){
 if(o===!!dialog)return;
 if(o){
  if(getComputedStyle(b).display==='none')return;
  var fullscreen=w.dataset.mobileMenu==='fullscreen';
  dialog=document.createElement(fullscreen?'dialog':'div');dialog.className='pagecraft-mobile-menu';
  dialog.dataset.layout=fullscreen?'fullscreen':'dropdown';
  if(fullscreen){dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');}
  else{dialog.setAttribute('popover','manual');dialog.setAttribute('role','navigation');}
  dialog.setAttribute('aria-label',(w.getAttribute('aria-label')||'Navigation')+' menu');
  var head=document.createElement('div');head.className='pagecraft-mobile-menu-head';
  var label=document.createElement('span');label.textContent=(w.getAttribute('aria-label')||'Navigation')+' menu';
  var close=document.createElement('button');close.type='button';close.className='pagecraft-mobile-menu-close';close.setAttribute('aria-label','Close menu');
  close.innerHTML='<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16"/></svg>';
  head.append(label,close);content.hidden=false;if(fullscreen)dialog.append(head);dialog.append(content);w.append(dialog);position();
  overflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';
  w.classList.add('is-open');b.setAttribute('aria-expanded','true');
  close.addEventListener('click',function(){set(false,true);});
  dialog.addEventListener('cancel',function(e){e.preventDefault();set(false,true);});
  dialog.addEventListener('click',function(e){if(!dialog||e.target!==dialog)return;var r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)set(false,true);});
  var opened=dialog;
  dialog.addEventListener('close',function(){if(dialog===opened)set(false,true);});
  if(fullscreen){dialog.showModal();close.focus();}
  else if(dialog.showPopover)dialog.showPopover();
  else{dialog.removeAttribute('popover');dialog.style.zIndex='2147483647';}
 }else{
  var old=dialog;dialog=null;anchor.after(content);if(content!==list)content.hidden=true;if(old.dataset.layout==='fullscreen')old.close();else if(old.hidePopover)old.hidePopover();old.remove();
  document.documentElement.style.overflow=overflow;w.classList.remove('is-open');b.setAttribute('aria-expanded','false');
  if(restore)b.focus();
 }
}
b.addEventListener('click',function(e){e.stopPropagation();set(!dialog,true);});
document.addEventListener('keydown',function(e){
 if(!dialog)return;
 if(e.key==='Escape'){e.preventDefault();set(false,true);return;}
 if(dialog.dataset.layout!=='fullscreen'||e.key!=='Tab')return;
 var focusable=[].slice.call(dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
 if(!focusable.length){e.preventDefault();dialog.focus();return;}
 var first=focusable[0],last=focusable[focusable.length-1];
 if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){e.preventDefault();last.focus();}
 else if(!e.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){e.preventDefault();first.focus();}
});
document.addEventListener('click',function(e){if(dialog&&dialog.dataset.layout==='dropdown'&&!w.contains(e.target))set(false,false);});
document.addEventListener('focusin',function(e){if(dialog&&dialog.dataset.layout==='dropdown'&&!w.contains(e.target))set(false,false);});
Array.prototype.forEach.call(content.querySelectorAll('a'),function(a){a.addEventListener('click',function(){set(false,false);});});
window.addEventListener('resize',function(){if(dialog){if(getComputedStyle(b).display==='none')set(false,false);else position();}});
});})();
<\/script>
`,Pr="(function(){var b=document.body,h=-1;function s(){var n=Math.ceil(b.getBoundingClientRect().height);if(n!==h){h=n;parent.postMessage({pagecraftEmbedHeight:n},'*');}}if(window.ResizeObserver)new ResizeObserver(s).observe(b);addEventListener('load',s);s();})();";var Tr=`<script>
(function(){Array.prototype.forEach.call(document.querySelectorAll('[data-facade] .pagecraft-video-play'),function(b){
b.addEventListener('click',function(){
var f=document.createElement('iframe');
f.src=b.getAttribute('data-embed')+(b.getAttribute('data-embed').indexOf('?')<0?'?':'&')+'autoplay=1';
f.title='Video';f.allow='accelerometer;autoplay;clipboard-write;encrypted-media;picture-in-picture';
f.setAttribute('allowfullscreen','');b.parentNode.replaceChild(f,b);
});});})();
<\/script>
`,Lr=`<script>
(function(){
var gs=document.querySelectorAll('[data-lightbox]');if(!gs.length)return;
if(typeof HTMLDialogElement!=='function')return;
var dlg=null,imgEl,capEl,prevB,nextB,list=[],at=0;
function build(){
dlg=document.createElement('dialog');dlg.className='pagecraft-lightbox';
dlg.innerHTML='<figure class="pagecraft-lightbox-fig"><img class="pagecraft-lightbox-img" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" alt="" hidden><p class="pagecraft-lightbox-cap"></p></figure>'
+'<button class="pagecraft-lightbox-btn pagecraft-lightbox-prev" type="button" aria-label="Previous image">\u2039</button>'
+'<button class="pagecraft-lightbox-btn pagecraft-lightbox-next" type="button" aria-label="Next image">\u203A</button>'
+'<button class="pagecraft-lightbox-btn pagecraft-lightbox-close" type="button" aria-label="Close">\xD7</button>';
document.body.appendChild(dlg);
imgEl=dlg.querySelector('.pagecraft-lightbox-img');capEl=dlg.querySelector('.pagecraft-lightbox-cap');
prevB=dlg.querySelector('.pagecraft-lightbox-prev');nextB=dlg.querySelector('.pagecraft-lightbox-next');
prevB.addEventListener('click',function(){go(-1);});
nextB.addEventListener('click',function(){go(1);});
dlg.querySelector('.pagecraft-lightbox-close').addEventListener('click',function(){dlg.close();});
dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close();});
dlg.addEventListener('keydown',function(e){
if(e.key==='ArrowLeft'){e.preventDefault();go(-1);}
if(e.key==='ArrowRight'){e.preventDefault();go(1);}
if(e.key==='Tab'){
var bs=dlg.querySelectorAll('.pagecraft-lightbox-btn:not([hidden]):not(:disabled)'),first=bs[0],last=bs[bs.length-1];
if(first&&((e.shiftKey&&document.activeElement===first)||(!e.shiftKey&&document.activeElement===last))){e.preventDefault();(e.shiftKey?last:first).focus();}
}
});
}
function show(){var it=list[at];imgEl.src=it.href;imgEl.alt=it.alt;imgEl.hidden=false;
capEl.textContent=it.cap;capEl.hidden=!it.cap;
prevB.hidden=nextB.hidden=list.length<2;}
function go(d){at=(at+d+list.length)%list.length;show();}
Array.prototype.forEach.call(gs,function(g){
var links=g.querySelectorAll('.pagecraft-gallery-frame[href]');
Array.prototype.forEach.call(links,function(a,i){
a.addEventListener('click',function(e){
if(e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;
e.preventDefault();
if(!dlg)build();
list=Array.prototype.map.call(links,function(x){
var fg=x.parentNode,c=fg&&fg.querySelector('.pagecraft-gallery-caption'),im=x.querySelector('img');
return {href:x.getAttribute('href'),alt:im?im.getAttribute('alt')||'':'',cap:c?c.textContent:''};
});
at=i;show();dlg.showModal();
});
});
});
})();
<\/script>
`,tt=e=>e.replace(/\}/g,`}
`).replace(/\n{2,}/g,`
`).replace(/^\s+|\s+$/g,"");function Nr(e,t={}){let n=b.meta,o=String(n.baseUrl||"").replace(/\/+$/,"");if(!o)return null;let i=m=>m?/^https?:/i.test(m)?m:o+"/"+String(m).replace(/^\/+/,""):"",r=`${o}/${st(e.slug,t.pageNo||1)}`,a=`${o}/#org`,s=`${o}/#site`,l=i(e.ogImage||n.ogImage||""),p=[{"@type":"Organization","@id":a,name:n.name,url:o+"/"},{"@type":"WebSite","@id":s,name:n.name,url:o+"/",publisher:{"@id":a}}];if(ho([b.header,e.tree,b.footer])){let m=Xt(e,t);m.length>1&&p.push({"@type":"BreadcrumbList","@id":r+"#crumbs",itemListElement:m.map((g,$)=>{let C={"@type":"ListItem",position:$+1,name:g.label};return g.href&&(C.item=o+"/"+String(g.href).replace(/^\/+/,"")),C})})}let d=!!(t.item&&t.col),u=d?{"@type":"Article","@id":r+"#article",headline:e.title||e.name,url:r}:{"@type":"WebPage","@id":r,name:e.title||e.name,url:r};return e.desc&&(u.description=e.desc),l&&(u.image=l),u.isPartOf={"@id":s},d&&(u.publisher={"@id":a}),p.push(u),{"@context":"https://schema.org","@graph":p}}function Rr(e,t={}){let n=Nr(e,t);return n?`<script type="application/ld+json">
${JSON.stringify(n,null,2).replace(/</g,"\\u003c")}
<\/script>
`:""}var Ne="<!--",Re="-->",Or=Ne+"PAGECRAFT_SHARED_HEADER_START"+Re,Dr=Ne+"PAGECRAFT_SHARED_HEADER_END"+Re,zr=Ne+"PAGECRAFT_SHARED_FOOTER_START"+Re,Fr=Ne+"PAGECRAFT_SHARED_FOOTER_END"+Re;function En(e,t={}){let n=b.meta,o={edit:!1,col:t.col||null,item:t.item||null,rel:t.rel||"",variants:!!t.variants,pageNo:t.pageNo||1,pages:t.pages||1,pg:e},i=yr([b.header,e.tree,b.footer],!1),r=Ye([b.header,e.tree,b.footer]),a=[...b.header,...e.tree,...b.footer],s=new Set;Y(a,x=>s.add(Cn(x)));let l="pagecraft-main";for(;s.has(l);)l+="-content";let p=fe(Ue(b.header,o)),d=fe(Ue(e.tree,o)),u=fe(Ue(b.footer,o)),m=`<main id="${l}" class="pagecraft-main">${d}</main>`,g=Or+p+Dr+m+zr+u+Fr,$=e.title||`${e.name} \u2014 ${n.name}`,C=String(n.baseUrl||"").replace(/\/+$/,""),D=x=>x?/^https?:/i.test(x)?x:C?C+"/"+String(x).replace(/^\/+/,""):x:"",P=C&&!Lt(e)?`${C}/${st(e.slug,o.pageNo)}`:"",B=D(e.ogImage||n.ogImage||"");return`<!doctype html>
<html lang="${f(n.lang||"en")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${f($)}</title>
${e.desc?`<meta name="description" content="${f(e.desc)}">
`:""}${P?`<link rel="canonical" href="${f(P)}">
`:""}${n.favicon?`<link rel="icon" href="${f(Q(n.favicon,o))}">
`:""}${t.fontCss?`<style>
${t.fontCss}
</style>
`:co()}<meta property="og:type" content="${t.item&&t.col?"article":"website"}">
<meta property="og:title" content="${f($)}">
${e.desc?`<meta property="og:description" content="${f(e.desc)}">
`:""}${P?`<meta property="og:url" content="${f(P)}">
`:""}${B?`<meta property="og:image" content="${f(B)}">
<meta name="twitter:card" content="summary_large_image">
`:""}${Rr(e,{col:o.col,item:o.item,pageNo:o.pageNo})}<style>
${tt(i)}${r?`
${$e}
${Ke}`:""}
</style>
${Lt(e)?`<meta name="robots" content="noindex">
`:""}${fe(n.headHtml||"")}${fe(e.headHtml||"")}
</head>
<body>
<a class="pagecraft-skip" href="#${l}">Skip to content</a>
${g}
${/data-slider/.test(g)?wo:""}${/data-copy/.test(g)?vo:""}${/data-tabs/.test(g)?Ir:""}${/data-nav/.test(g)?Er:""}${/data-facade/.test(g)?Tr:""}${/data-lightbox/.test(g)?Lr:""}${r?`<script>
${ft}
<\/script>
`:""}</body>
</html>
`}var ke=class extends Error{suppliedVersion;supportedVersion;constructor(t,n,o=V){super(t),this.name="DocumentSchemaError",this.suppliedVersion=n,this.supportedVersion=o}},Br=e=>{if(!e||typeof e!="object")return null;let t=e,n=t.schemaVersion??t.v;return Number.isInteger(n)?n:null};function Pn(e){let t=Br(e);if(t!==null&&t>V)throw new ke(`This project uses Pagecraft schema ${t}, but this host supports schema ${V}. Upgrade Pagecraft on this host before opening or saving the project.`,t);let n;try{n=kn(ae(e))}catch(o){throw new ke(`This Pagecraft document is invalid and could not be migrated: ${o instanceof Error?o.message:String(o)}`,t)}if(!n)throw new ke("This Pagecraft document is incomplete or unsupported. Restore a valid project backup or upgrade Pagecraft.",t);return n}var _r=Uint32Array.from([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]);function Tn(e){let t=new TextEncoder().encode(e),n=t.length*8,o=new Uint8Array(t.length+9+63>>6<<6);o.set(t),o[t.length]=128;let i=new DataView(o.buffer);i.setUint32(o.length-8,Math.floor(n/4294967296)),i.setUint32(o.length-4,n>>>0);let r=Uint32Array.from([1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225]),a=new Uint32Array(64),s=(l,p)=>l>>>p|l<<32-p;for(let l=0;l<o.length;l+=64){for(let P=0;P<16;P++)a[P]=i.getUint32(l+P*4);for(let P=16;P<64;P++){let B=s(a[P-15],7)^s(a[P-15],18)^a[P-15]>>>3,x=s(a[P-2],17)^s(a[P-2],19)^a[P-2]>>>10;a[P]=a[P-16]+B+a[P-7]+x>>>0}let[p,d,u,m,g,$,C,D]=r;for(let P=0;P<64;P++){let B=D+(s(g,6)^s(g,11)^s(g,25))+(g&$^~g&C)+_r[P]+a[P]>>>0,x=(s(p,2)^s(p,13)^s(p,22))+(p&d^p&u^d&u)>>>0;D=C,C=$,$=g,g=m+B>>>0,m=u,u=d,d=p,p=B+x>>>0}r[0]+=p,r[1]+=d,r[2]+=u,r[3]+=m,r[4]+=g,r[5]+=$,r[6]+=C,r[7]+=D}return Array.from(r,l=>(l>>>0).toString(16).padStart(8,"0")).join("")}var Ln="pagecraft-renderer-2";var Nn=e=>`pagecraft-core-${e}`;var Hr="0.2.17",Rn=Object.freeze({format:"pagecraft.editor-contract.v1",editorVersion:Hr,schemaVersion:V,rendererVersion:Nn(V),rendererRevision:Ln}),On="pagecraft.wordpress-compile.v1";var _=class extends Error{constructor(n,o){super(o);this.code=n;this.name="PagecraftCompilerError"}code},qr=/%%PAGECRAFT_WP_CONTENT:(page|post):([A-Za-z0-9_-]+)%%/g,zn=(e,t)=>{let n=String(e??"").trim();if(!n||/[\u0000-\u001f\u007f"'<>\\]/.test(n))throw new _("invalid_url",`${t} has an invalid URL.`);let o;try{o=new URL(n)}catch{throw new _("invalid_url",`${t} has an invalid URL.`)}if(!["http:","https:"].includes(o.protocol)||o.username||o.password)throw new _("invalid_url",`${t} must use a durable HTTP or HTTPS URL.`);return o.href};function Wr(e,t){if(t)for(let n of["maxWidth","font","headFont","size","css","tokens"])Object.prototype.hasOwnProperty.call(t,n)&&(e.meta[n]=ae(t[n]))}var Oe=new Set(["primary","footer","utility"]);function De(e,t,n,o){Array.isArray(t)&&t.forEach(i=>{if(!i||typeof i!="object"||Array.isArray(i))return;let r=i,a=String(r.use||""),s=a?e.meta.components?.find(l=>l.id===a):void 0;s?n.has(a)||(n.add(a),De(e,[s.node],n,o)):o(r),De(e,r.children,n,o)})}function Ur(e){let t=0,n=new Set;De(e,e.header,n,i=>{if(i.type!=="nav"||!i.props||typeof i.props!="object")return;let r=String(i.props.menuLocation||"");Oe.has(r)||(i.props.menuLocation=t===0?"primary":"utility"),t++});let o=0;De(e,e.footer,n,i=>{if(i.type!=="nav"||!i.props||typeof i.props!="object")return;let r=String(i.props.menuLocation||"");!Oe.has(r)&&o===0&&(i.props.menuLocation="footer"),o++})}function Vr(e){return e.map(t=>{let n=String(t.href??t.url??""),o=String(t.anchor||"");return t.href===void 0&&o&&!n.includes("#")&&(n+=`#${o}`),{id:String(t.id||""),label:String(t.label||""),href:n,parentId:String(t.parentId||""),cls:t.cls!==void 0?String(t.cls):(t.classes||[]).map(String).join(" "),target:t.target==="_blank"?"_blank":"",rel:String(t.rel||""),objectType:String(t.objectType||"custom"),objectId:String(t.objectId||""),anchor:o}})}function Gr(e){let t={};return Array.isArray(e)?e.forEach(n=>{let o=String(n?.location||"");Oe.has(o)&&(t[o]=n)}):e&&Object.entries(e).forEach(([n,o])=>{Oe.has(n)&&o&&(t[n]=o)}),t}function ct(e,t){if(e==null||typeof e!="object")return;if(Array.isArray(e)){e.forEach(o=>ct(o,t));return}let n=e;if(n.type==="nav"&&n.props&&typeof n.props=="object"){let o=String(n.props.menuLocation||""),i=t[o];i&&(n.props.items=Vr(i.items),i.id&&(n.props.nativeMenuId=String(i.id)))}Object.values(n).forEach(o=>ct(o,t))}function Yr(e,t){let n=new Set,o=new Map,i=String(e).replace(cn,(r,a)=>{let s=t[a];if(!s)return n.add(a),r;let l=o.get(a);return l||(l=zn(s.url,`Image \u201C${s.name||a}\u201D`),o.set(a,l)),l});if(n.size)throw new _("missing_assets",`WordPress could not resolve ${[...n].map(r=>`\u201C${r}\u201D`).join(", ")}. Reload media and try again.`);return i}function Kr(e,t){let n=new Set,o=String(e).replace(qr,(i,r,a)=>{let s=`pagecraft:wordpress-content:${r}:${a}`,l=t?.[i]||t?.[s];return l?zn(l,`WordPress ${r} link`).replace(/&/g,"&amp;"):(n.add(s),i)});if(n.size)throw new _("missing_wordpress_content",`WordPress could not resolve ${[...n].join(", ")}. Refresh the content index and try again.`);return o}async function Xr(e){let t=rt();if(!t)return"";let n;try{n=await e(t)}catch{throw new _("font_fetch_failed","The selected fonts could not be loaded. Check the connection and retry.")}if(!n.ok)throw new _("font_fetch_failed","The selected fonts could not be loaded. Check the connection and retry.");let o=Yt(await n.text());if(!o.length)throw new _("font_parse_failed","The selected fonts returned no usable font files. Retry or choose another font.");return Kt(o,i=>i.url)+`
`}async function Zr(e,t){try{if(t?.subtle&&typeof t.subtle.digest=="function"){let n=new TextEncoder().encode(e),o=await t.subtle.digest("SHA-256",n);return[...new Uint8Array(o)].map(i=>i.toString(16).padStart(2,"0")).join("")}}catch{}try{return Tn(e)}catch{throw new _("hash_failed","Pagecraft could not verify the generated output in this browser. Reload the editor and retry.")}}async function Jr(e,t,n){if(!t||!String(t.pageId||"").trim())throw new _("missing_page","Choose the exact Pagecraft page to compile.");let o=ae(Zt());try{let i=Pn(e);Wr(i,t.design),Ur(i),ct(i,Gr(t.wordpressMenus)),it(i);let r=b.pages.find(g=>g.id===t.pageId);if(!r)throw new _("missing_page",`Page \u201C${t.pageId}\u201D is not present in this document.`);let a=await Xr(n.fetch),s=An(r),l=g=>Kr(Yr(g,t.assets||{}),t.wordpressContent),p=l(En(r)),d=a+l(s.global),u=l(s.page),m=await Zr(JSON.stringify({html:p,globalCss:d,pageCss:u}),n.crypto);return{format:On,compiler:Rn,pageId:r.id,html:p,globalCss:d,pageCss:u,fontCss:a,contentHash:m}}finally{it(o)}}var Dn=Promise.resolve();function Fn(e,t,n={fetch:globalThis.fetch.bind(globalThis),crypto:globalThis.crypto}){let o=Dn.then(()=>Jr(e,t,n));return Dn=o.then(()=>{},()=>{}),o}var dt=self,jn=Promise.resolve();dt.addEventListener("message",e=>{let t=e.data,n=async()=>{try{let o=await Fn(t.document,t.options);dt.postMessage({id:t.id,ok:!0,result:o})}catch(o){dt.postMessage({id:t.id,ok:!1,error:{name:o instanceof Error?o.name:"Error",code:o instanceof _?o.code:"compile_failed",message:o instanceof Error?o.message:String(o)}})}};jn=jn.then(n,n)});})();
