/*! entities 4.5.0 (BSD-2-Clause)
Copyright (c) Felix Böhm
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

"use strict";(()=>{var ce=Object.freeze({label:"13px",body:"14px"}),ec=`:root{
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
  --pc-control-editor:36px;
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
  --pc-text-caption:var(--pc-text-label);
  --pc-text-label:${ce.label};
  --pc-text-body:${ce.body};
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
  /* One corner scale. Controls and buttons share one radius so a field and the button
     beside it match; smaller parts inside a control (chips, menu items, segment options,
     swatches) use the inner radius; cards and panels the card radius; dialogs their own. */
  --pc-control-radius:8px;
  --pc-radius-inner:4px;
  --pc-radius-card:12px;
  --pc-radius-pill:999px;
  --pc-space-1:4px;
  --pc-space-2:8px;
  --pc-space-3:12px;
  --pc-space-4:16px;
  --pc-space-5:24px;
  --pc-space-6:32px;
}`;var zr={sliders:'<path d="M3 8h8M17 8h4M3 16h4M13 16h8"/><circle cx="14" cy="8" r="3"/><circle cx="10" cy="16" r="3"/>',cms:'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/>',section:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 9h10M7 12h10M7 15h10"/>',row:'<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M12 6v12"/>',flex:'<rect x="3" y="6" width="5.5" height="12" rx="1.8"/><rect x="12" y="6" width="9" height="12" rx="1.8"/>',grid:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M12 4v16M3 12h18"/>',box:'<rect x="4" y="4" width="16" height="16" rx="3"/>',search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="M15.8 15.8L20.2 20.2"/>',table:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 10h18M3 15h18M12 10v10"/>',codeblock:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9.5 9l-3 3 3 3M14.5 9l3 3-3 3"/>',crumbs:'<path d="M4.5 8l4 4-4 4M10 8l4 4-4 4M15.5 8l4 4-4 4"/>',slider:'<rect x="6" y="5" width="12" height="14" rx="2.5"/><path d="M3 8v8M21 8v8"/>',column:'<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M12 3v18"/>',columns:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16M15 4v16"/>',heading:'<path d="M6 4v16M18 4v16M6 12h12"/>',text:'<path d="M4 6h16M4 10h16M4 14h16M4 18h9"/>',quote:'<path d="M10 7H5.5A1.5 1.5 0 0 0 4 8.5V12a1.5 1.5 0 0 0 1.5 1.5H10V7zM10 13.5c0 2-1.2 3.3-3.5 3.5"/><path d="M20 7h-4.5A1.5 1.5 0 0 0 14 8.5V12a1.5 1.5 0 0 0 1.5 1.5H20V7zM20 13.5c0 2-1.2 3.3-3.5 3.5"/>',image:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M3.5 17.5l4.8-4.3a1.6 1.6 0 0 1 2.1 0l3.1 2.8 1.6-1.4a1.6 1.6 0 0 1 2.1 0l3.3 2.9"/>',video:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9.7 8.8l5 3.2-5 3.2z" fill="currentColor"/>',button:'<rect x="3" y="7" width="18" height="10" rx="5"/><path d="M9 12h6"/>',spacer:'<path d="M4 3.5h16M4 20.5h16M12 7.5v9M9.5 10L12 7.5l2.5 2.5M9.5 14l2.5 2.5 2.5-2.5"/>',divider:'<path d="M3 12h18"/><g opacity=".45"><path d="M7 6.5h10M7 17.5h10"/></g>',nav:'<path d="M4 7h16M4 12h16M4 17h16"/>',form:'<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M6.5 7h4M6.5 17h7"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.5 3.6 5.6 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.6-3.6-9S9.6 5.5 12 3z"/>',lock:'<rect x="5" y="10.5" width="14" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',external:'<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v3.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 4 17.5v-9A2.5 2.5 0 0 1 6.5 6H10"/>',link:'<path d="M10 13.5a4 4 0 0 0 5.8.4l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3M14 10.5a4 4 0 0 0-5.8-.4l-3 3a4 4 0 0 0 5.7 5.7l1.3-1.3"/>',unlink:'<path d="M17.7 12l1.1-1.1a4 4 0 0 0-5.7-5.7L12 6.3M6.3 12l-1.1 1.1a4 4 0 0 0 5.7 5.7L12 17.7M4 4l16 16"/>',reset:'<path d="M4 4v5h5M4.6 9A8 8 0 1 1 4 12.5"/>',icon:'<path d="M12 3.6l2.7 5.5 6 .9-4.35 4.25 1 6L12 17.4l-5.35 2.85 1-6L3.3 10l6-.9z"/>',caret:'<path d="M6 9l6 6 6-6"/>',caretUp:'<path d="M6 15l6-6 6 6"/>',close:'<path d="M6 6l12 12M18 6L6 18"/>',trash:'<path d="M4 6.5h16M9 6.5V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M6 6.5l.8 12.1A2.5 2.5 0 0 0 9.3 21h5.4a2.5 2.5 0 0 0 2.5-2.4L18 6.5M10 11v5.5M14 11v5.5"/>',copy:'<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M5.5 15.5A2 2 0 0 1 3.5 13.5v-7.5A2.5 2.5 0 0 1 6 3.5h7.5a2 2 0 0 1 2 2"/>',component:'<rect x="4" y="4" width="16" height="16" rx="3"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" stroke="none"/>',library:'<rect x="3" y="4" width="4.5" height="16" rx="1.2"/><rect x="9.75" y="4" width="4.5" height="16" rx="1.2"/><path d="M16.9 4.8l2.6-.7 2 15.1-2.6.7z"/>',more:'<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',drag:'<circle cx="9" cy="6" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.6" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.6" fill="currentColor" stroke="none"/>',eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',eyeoff:'<path d="M4 4l16 16M10.2 10.2a2.6 2.6 0 0 0 3.6 3.6M9.6 5.8A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.2 7.7A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-.9"/>',desktop:'<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M12 16v4M8.5 20h7"/>',tablet:'<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M11 17.5h2"/>',mobile:'<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11.2 17.5h1.6"/>',alignL:'<path d="M4 6h16M4 12h9M4 18h13"/>',alignC:'<path d="M4 6h16M7.5 12h9M5.5 18h13"/>',alignR:'<path d="M4 6h16M11 12h9M7 18h13"/>',alignJ:'<path d="M4 6h16M4 12h16M4 18h16"/>',vTop:'<path d="M4 3.5h16"/><rect x="8" y="7.5" width="8" height="13" rx="1.8"/>',vMid:'<path d="M3 12h2.5M18.5 12H21"/><rect x="8" y="5" width="8" height="14" rx="1.8"/>',vBot:'<path d="M4 20.5h16"/><rect x="8" y="3.5" width="8" height="13" rx="1.8"/>',toTop:'<path d="M5 4h14M12 20V9M7.5 13L12 8.5l4.5 4.5"/>',toBottom:'<path d="M5 20h14M12 4v11M7.5 11l4.5 4.5 4.5-4.5"/>',plus:'<path d="M12 5v14M5 12h14"/>',edit:'<path d="M15.8 4.2a2.5 2.5 0 0 1 3.6 0l.4.4a2.5 2.5 0 0 1 0 3.6L8.5 19.5 3.7 20.3l.8-4.8zM13.5 6.5l4 4"/>',arrow:'<path d="M9 6l6 6-6 6"/>',check:'<path d="M5 12.2l4.6 4.6L19 7.2"/>',page:'<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h6"/>',code:'<path d="M7.5 7.5L3 12l4.5 4.5M16.5 7.5L21 12l-4.5 4.5M13.8 5l-3.6 14"/>',tabs:'<path d="M3 9.5V6.5A2.5 2.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v3.5"/><path d="M3 9.5h15.5A2.5 2.5 0 0 1 21 12v5.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',accordion:'<rect x="3" y="3.5" width="18" height="5" rx="1.8"/><rect x="3" y="11.5" width="18" height="9" rx="1.8"/><path d="M7 16h10"/>',gallery:'<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',pipette:'<path d="M13 7l4 4M17.3 3.7a2.1 2.1 0 0 1 3 3L17 10l-3-3zM13.8 7.8L5 16.6 3.7 20.3 7.4 19l8.8-8.8"/>',audio:'<path d="M4 10.5v3M8 7.5v9M12 4v16M16 7.5v9M20 10.5v3"/>',countdown:'<circle cx="12" cy="13" r="8"/><path d="M12 13V9M9.5 2.5h5"/>',marquee:'<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7 12h10M14 9l3 3-3 3"/>',filter:'<path d="M4.5 4h15a1 1 0 0 1 .8 1.6L14.5 13v5.2L9.5 20v-7L3.7 5.6A1 1 0 0 1 4.5 4z"/>',compare:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M12 2.5v19M9 9.5L6.5 12 9 14.5M15 9.5l2.5 2.5-2.5 2.5"/>',timeline:'<path d="M6.5 7.5v2M6.5 14.5v2"/><circle cx="6.5" cy="5" r="2.3"/><circle cx="6.5" cy="12" r="2.3"/><circle cx="6.5" cy="19" r="2.3"/><path d="M12.5 5H20M12.5 12H20M12.5 19H20"/>',progress:'<rect x="3" y="5" width="18" height="5" rx="2.5"/><rect x="3" y="14" width="18" height="5" rx="2.5"/><rect x="4.3" y="6.3" width="11" height="2.4" rx="1.2" fill="currentColor" stroke="none"/><rect x="4.3" y="15.3" width="7" height="2.4" rx="1.2" fill="currentColor" stroke="none"/>',hotspot:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>',strips:'<rect x="3" y="4" width="10" height="16" rx="2.2"/><path d="M17 5v14M21 5v14"/>',switcher:'<path d="M3 6h4.5M3 12h4.5M3 18h4.5"/><rect x="11" y="4" width="10" height="16" rx="2.5"/>',exhibit:'<path d="M3 6h8M3 12h8M3 18h8"/><rect x="14" y="8" width="7" height="8" rx="2"/>',scrolly:'<rect x="11" y="4" width="10" height="16" rx="2.5"/><path d="M5.5 5v13M3 15.5L5.5 18 8 15.5"/>',clocks:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',roster:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.6-4 3.6-6.5 7.5-6.5s6.9 2.5 7.5 6.5"/>',tiers:'<rect x="3" y="7.5" width="5" height="9" rx="1.5"/><rect x="9.5" y="4" width="5" height="16" rx="1.5"/><rect x="16" y="7.5" width="5" height="9" rx="1.5"/>',qapills:'<rect x="3" y="4" width="8" height="5" rx="2.5"/><rect x="13" y="4" width="8" height="5" rx="2.5"/><rect x="3" y="12.5" width="18" height="7.5" rx="2"/>',dockbar:'<rect x="3" y="7" width="18" height="10" rx="2.5"/><path d="M9 7v10M15 7v10"/>',arches:'<path d="M8.5 19V8.5a3.5 3.5 0 0 1 7 0V19z"/><path d="M8.5 19H4.5a1 1 0 0 1-1-1v-6.5a2.5 2.5 0 0 1 5-.5M15.5 19h4a1 1 0 0 0 1-1v-6.5a2.5 2.5 0 0 0-5-.5"/>',reel:'<rect x="8.5" y="4.5" width="7" height="15" rx="1.6"/><path d="M6.2 6.8l-2.4.9v8.6l2.4.9M17.8 6.8l2.4.9v8.6l-2.4.9" opacity=".65"/>',grow:'<rect x="8.5" y="4" width="7" height="16" rx="1.3"/><rect x="3" y="6.8" width="3.8" height="10.4" rx=".9" opacity=".55"/><rect x="17.2" y="6.8" width="3.8" height="10.4" rx=".9" opacity=".55"/>',deck:'<rect x="6.5" y="4.5" width="11" height="14" rx="1.8"/><path d="M5 7.5l-1.5 1v10.5a1.5 1.5 0 0 0 1.5 1.5h9.5" opacity=".55"/>',metrics:'<rect x="3.5" y="6" width="4.5" height="12" rx="1.2"/><rect x="9.8" y="6" width="4.5" height="12" rx="1.2"/><rect x="16" y="6" width="4.5" height="12" rx="1.2" opacity=".6"/>',spotlight:'<rect x="3.5" y="4.5" width="7.5" height="6.8" rx="1.2"/><rect x="13" y="4.5" width="7.5" height="6.8" rx="1.2" opacity=".6"/><rect x="3.5" y="13" width="7.5" height="6.8" rx="1.2" opacity=".6"/><rect x="13" y="13" width="7.5" height="6.8" rx="1.2"/>',terminal:'<rect x="3" y="4.5" width="18" height="15" rx="2.2"/><path d="M7.2 10l2.8 2.4-2.8 2.4M12 14.8h4.8"/>',tilt:'<path d="M5.5 6.5l13-2.2v13.2l-13 2.2z"/><path d="M9 12.2l6-1" opacity=".65"/>',flip:'<rect x="4" y="5" width="12" height="14" rx="2"/><path d="M16 8.5h2a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2h-8" opacity=".6"/>',chapters:'<rect x="3" y="4" width="18" height="11.5" rx="2.5"/><path d="M3 20h4M10 20h4M17 20h4"/>',slotpicker:'<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 2.8V7M16 2.8V7M9 15.5l2 2 4-4"/>'},_r="1 1 22 22",jr=e=>e<16?2:1.75,J=(e,t=14,r="")=>`<svg class="${r}" width="${t}" height="${t}" viewBox="${_r}" fill="none" stroke="currentColor" stroke-width="${jr(t)}" stroke-linecap="round" stroke-linejoin="round">${zr[e]||""}</svg>`,je={arrow:'<path d="M6 3.5L10.5 8 6 12.5" stroke-linecap="round" stroke-linejoin="round"/>',check:'<path d="M3 8.5l3.2 3.2L13 5" stroke-linecap="round" stroke-linejoin="round"/>',plus:'<path d="M8 3v10M3 8h10" stroke-linecap="round"/>',caret:'<path d="M3.5 5.5L8 10l4.5-4.5" stroke-linecap="round" stroke-linejoin="round"/>'},Hr=[["Interface",[["check",'<path d="M20 6.5L9.2 17.3 4 12.1"/>'],["check-circle",'<circle cx="12" cy="12" r="9"/><path d="M8.2 12.4l2.6 2.6 5-5.6"/>'],["plus",'<path d="M12 5v14M5 12h14"/>'],["minus",'<path d="M5 12h14"/>'],["close",'<path d="M6 6l12 12M18 6L6 18"/>'],["arrow-right",'<path d="M4 12h15M13.2 6l6 6-6 6"/>'],["arrow-up-right",'<path d="M7 17L17.2 6.8M8.4 6.8h8.8v8.8"/>'],["chevron-down",'<path d="M6 9.5l6 6 6-6"/>'],["chevron-right",'<path d="M9.5 6l6 6-6 6"/>'],["menu",'<path d="M4 7h16M4 12h16M4 17h16"/>'],["search",'<circle cx="11" cy="11" r="6.4"/><path d="M15.8 15.8l4.7 4.7"/>'],["settings",'<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v3.1M12 18.3v3.1M4.4 7.2l2.7 1.6M16.9 15.2l2.7 1.6M4.4 16.8l2.7-1.6M16.9 8.8l2.7-1.6"/>'],["external",'<path d="M14 4h6v6M20 4l-8.6 8.6M17 14.4v5.1H4.5V7h5.1"/>'],["download",'<path d="M12 4v11.4M7.4 11l4.6 4.6L16.6 11M4.4 19.6h15.2"/>']]],["Signals",[["star",'<path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.4 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.4 6.1-.9z"/>'],["heart",'<path d="M12 20.2C9.5 18.4 4.6 14.9 4.6 11a3.9 3.9 0 017.4-1.8A3.9 3.9 0 0119.4 11c0 3.9-4.9 7.4-7.4 9.2z"/>'],["zap",'<path d="M13.4 2.4L4.6 14.2H10l-1.4 7.4 8.8-11.8h-5.4z"/>'],["sparkle",'<path d="M10 3.2l1.7 4.6 4.6 1.7-4.6 1.7L10 15.8 8.3 11.2 3.7 9.5l4.6-1.7z"/><path d="M17.6 14.4l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>'],["info",'<circle cx="12" cy="12" r="9"/><path d="M12 11.1v5.6M12 7.5v.9"/>'],["alert",'<path d="M12 3.6l8.8 15.8H3.2z"/><path d="M12 9.4v4.4M12 16.6v.9"/>'],["shield",'<path d="M12 3l8 3v5.9c0 5-3.4 8.1-8 9.1-4.6-1-8-4.1-8-9.1V6z"/>'],["lock",'<rect x="4.8" y="10.9" width="14.4" height="9.4" rx="2"/><path d="M8.2 10.9V8a3.8 3.8 0 017.6 0v2.9"/>']]],["Contact",[["mail",'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.6 6.6L12 12.5l8.4-5.9"/>'],["phone",'<path d="M6.1 3.2h2.8l1.9 4.7-2.1 1.4a12.3 12.3 0 005.9 5.9l1.4-2.1 4.7 1.9v2.8a2 2 0 01-2.2 2A16.6 16.6 0 014.1 5.4a2 2 0 012-2.2z"/>'],["chat",'<path d="M20 14.8a2 2 0 01-2 2H8.6L4 20.6V6a2 2 0 012-2h12a2 2 0 012 2z"/>'],["map-pin",'<path d="M12 21.2C12 21.2 5 15.1 5 10.4a7 7 0 1114 0c0 4.7-7 10.8-7 10.8z"/><circle cx="12" cy="10.2" r="2.6"/>'],["clock",'<circle cx="12" cy="12" r="9"/><path d="M12 6.9v5.5l3.6 2.2"/>'],["calendar",'<rect x="3.6" y="5.1" width="16.8" height="15.3" rx="2"/><path d="M3.6 10.1h16.8M8.2 3v4.1M15.8 3v4.1"/>'],["users",'<circle cx="9.2" cy="8" r="3.4"/><path d="M2.6 20a6.6 6.6 0 0113.2 0"/><path d="M16.2 5.2a3.4 3.4 0 010 5.6M17.6 14.5A6.6 6.6 0 0121.4 20"/>']]],["Craft",[["code",'<path d="M8.4 7.4L3.8 12l4.6 4.6M15.6 7.4L20.2 12l-4.6 4.6M13.7 4.4l-3.4 15.2"/>'],["layers",'<path d="M12 3l9 4.8-9 4.8-9-4.8z"/><path d="M3 12.6l9 4.8 9-4.8"/>'],["box",'<path d="M12 3.2l8.4 4.4v8.8L12 20.8l-8.4-4.4V7.6z"/><path d="M3.6 7.6L12 12l8.4-4.4M12 12v8.8"/>'],["chart",'<path d="M3 20.2h18"/><path d="M6.6 20.2v-6.4M12 20.2V7.4M17.4 20.2v-9.2"/>'],["globe",'<circle cx="12" cy="12" r="9"/><path d="M3.2 9.4h17.6M3.2 14.6h17.6"/><path d="M12 3c-2.4 2.6-3.7 5.7-3.7 9s1.3 6.4 3.7 9c2.4-2.6 3.7-5.7 3.7-9S14.4 5.6 12 3z"/>'],["play",'<circle cx="12" cy="12" r="9"/><path d="M10.2 8.4l6 3.6-6 3.6z"/>']]]],_e=Hr.reduce((e,[,t])=>(t.forEach(([r,a])=>{e[r]=a}),e),{}),ro=Object.keys(_e),Ot=(e,t="")=>`<svg ${t} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${_e[e]||_e.check}</svg>`;var Vr=["bounce","bounce-down","bounce-in","bounce-up","elastic","fade-down","fade-in","fade-out","fade-up","flip-x","flip-y","rotate-in","rotate-in-left","rotate-in-right","scale-down","scale-up","slide-down","slide-fade-down","slide-fade-left","slide-fade-right","slide-fade-up","slide-left","slide-right","slide-up","spin","zoom-in","zoom-out"],pt=`@keyframes bpFadeIn{from{opacity:0}to{opacity:1}}@keyframes bpSlideLeft{from{opacity:0;transform:translateX(-50px)}to{opacity:1;transform:translateX(0)}}@keyframes bpSlideRight{from{opacity:0;transform:translateX(50px)}to{opacity:1;transform:translateX(0)}}@keyframes bpScaleUp{from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}}@keyframes bpFadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}@keyframes bpFadeDown{from{opacity:0;transform:translateY(-30px)}to{opacity:1;transform:translateY(0)}}@keyframes bpCard{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}@keyframes bpDoneDemo{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes bpFadeOut{from{opacity:1}to{opacity:0}}@keyframes bpSlideUp{from{opacity:0;transform:translateY(50px)}to{opacity:1;transform:translateY(0)}}@keyframes bpSlideDown{from{opacity:0;transform:translateY(-50px)}to{opacity:1;transform:translateY(0)}}@keyframes bpScaleDown{from{opacity:0;transform:scale(1.2)}to{opacity:1;transform:scale(1)}}@keyframes bpZoomIn{from{opacity:0;transform:scale(0.5)}to{opacity:1;transform:scale(1)}}@keyframes bpZoomOut{from{opacity:0;transform:scale(1.5)}to{opacity:1;transform:scale(1)}}@keyframes bpRotateIn{from{opacity:0;transform:rotate(-180deg)}to{opacity:1;transform:rotate(0deg)}}@keyframes bpRotateInLeft{from{opacity:0;transform:rotate(-90deg) translateX(-50px)}to{opacity:1;transform:rotate(0deg) translateX(0)}}@keyframes bpRotateInRight{from{opacity:0;transform:rotate(90deg) translateX(50px)}to{opacity:1;transform:rotate(0deg) translateX(0)}}@keyframes bpBounce{0%,20%,50%,80%,100%{opacity:1;transform:translateY(0)}40%{opacity:1;transform:translateY(-30px)}60%{opacity:1;transform:translateY(-15px)}}@keyframes bpBounceIn{0%{opacity:0;transform:scale(0.3)}50%{opacity:1;transform:scale(1.05)}70%{transform:scale(0.9)}100%{opacity:1;transform:scale(1)}}@keyframes bpBounceUp{0%{opacity:0;transform:translateY(50px)}60%{opacity:1;transform:translateY(-10px)}80%{transform:translateY(5px)}100%{opacity:1;transform:translateY(0)}}@keyframes bpBounceDown{0%{opacity:0;transform:translateY(-50px)}60%{opacity:1;transform:translateY(10px)}80%{transform:translateY(-5px)}100%{opacity:1;transform:translateY(0)}}@keyframes bpFlipX{from{opacity:0;transform:perspective(400px) rotateX(90deg)}to{opacity:1;transform:perspective(400px) rotateX(0deg)}}@keyframes bpFlipY{from{opacity:0;transform:perspective(400px) rotateY(90deg)}to{opacity:1;transform:perspective(400px) rotateY(0deg)}}@keyframes bpSpin{from{opacity:0;transform:rotate(0deg) scale(0.8)}to{opacity:1;transform:rotate(360deg) scale(1)}}@keyframes bpElastic{0%{opacity:0;transform:scale(0)}50%{opacity:1;transform:scale(1.1)}70%{transform:scale(0.95)}100%{opacity:1;transform:scale(1)}}@keyframes bpSlideFadeUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}@keyframes bpSlideFadeDown{from{opacity:0;transform:translateY(-40px)}to{opacity:1;transform:translateY(0)}}@keyframes bpSlideFadeLeft{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:translateX(0)}}@keyframes bpSlideFadeRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}.pc-fade-in{opacity:0}.pc-fade-in.bp-is-animating{animation:bpFadeIn .6s ease-in-out forwards}.pc-slide-left{opacity:0;transform:translateX(-50px)}.pc-slide-left.bp-is-animating{animation:bpSlideLeft .6s ease-in-out forwards}.pc-slide-right{opacity:0;transform:translateX(50px)}.pc-slide-right.bp-is-animating{animation:bpSlideRight .6s ease-in-out forwards}.pc-scale-up{opacity:0;transform:scale(0.8)}.pc-scale-up.bp-is-animating{animation:bpScaleUp .6s ease-in-out forwards}.pc-fade-up{opacity:0;transform:translateY(30px)}.pc-fade-up.bp-is-animating{animation:bpFadeUp .6s ease-in-out forwards}.pc-fade-down{opacity:0;transform:translateY(-30px)}.pc-fade-down.bp-is-animating{animation:bpFadeDown .6s ease-in-out forwards}.pc-fade-out{opacity:1}.pc-fade-out.bp-is-animating{animation:bpFadeOut .6s ease-in-out forwards}.pc-slide-up{opacity:0;transform:translateY(50px)}.pc-slide-up.bp-is-animating{animation:bpSlideUp .6s ease-in-out forwards}.pc-slide-down{opacity:0;transform:translateY(-50px)}.pc-slide-down.bp-is-animating{animation:bpSlideDown .6s ease-in-out forwards}.pc-scale-down{opacity:0;transform:scale(1.2)}.pc-scale-down.bp-is-animating{animation:bpScaleDown .6s ease-in-out forwards}.pc-zoom-in{opacity:0;transform:scale(0.5)}.pc-zoom-in.bp-is-animating{animation:bpZoomIn .6s ease-in-out forwards}.pc-zoom-out{opacity:0;transform:scale(1.5)}.pc-zoom-out.bp-is-animating{animation:bpZoomOut .6s ease-in-out forwards}.pc-rotate-in{opacity:0;transform:rotate(-180deg)}.pc-rotate-in.bp-is-animating{animation:bpRotateIn .8s ease-in-out forwards}.pc-rotate-in-left{opacity:0;transform:rotate(-90deg) translateX(-50px)}.pc-rotate-in-left.bp-is-animating{animation:bpRotateInLeft .8s ease-in-out forwards}.pc-rotate-in-right{opacity:0;transform:rotate(90deg) translateX(50px)}.pc-rotate-in-right.bp-is-animating{animation:bpRotateInRight .8s ease-in-out forwards}.pc-bounce{opacity:0}.pc-bounce.bp-is-animating{animation:bpBounce 1s ease-in-out forwards}.pc-bounce-in{opacity:0;transform:scale(0.3)}.pc-bounce-in.bp-is-animating{animation:bpBounceIn .8s ease-in-out forwards}.pc-bounce-up{opacity:0;transform:translateY(50px)}.pc-bounce-up.bp-is-animating{animation:bpBounceUp .8s ease-in-out forwards}.pc-bounce-down{opacity:0;transform:translateY(-50px)}.pc-bounce-down.bp-is-animating{animation:bpBounceDown .8s ease-in-out forwards}.pc-flip-x{opacity:0;transform:perspective(400px) rotateX(90deg)}.pc-flip-x.bp-is-animating{animation:bpFlipX .8s ease-in-out forwards}.pc-flip-y{opacity:0;transform:perspective(400px) rotateY(90deg)}.pc-flip-y.bp-is-animating{animation:bpFlipY .8s ease-in-out forwards}.pc-spin{opacity:0;transform:rotate(0deg) scale(0.8)}.pc-spin.bp-is-animating{animation:bpSpin .8s ease-in-out forwards}.pc-elastic{opacity:0;transform:scale(0)}.pc-elastic.bp-is-animating{animation:bpElastic .8s ease-in-out forwards}.pc-slide-fade-up{opacity:0;transform:translateY(40px)}.pc-slide-fade-up.bp-is-animating{animation:bpSlideFadeUp .6s ease-in-out forwards}.pc-slide-fade-down{opacity:0;transform:translateY(-40px)}.pc-slide-fade-down.bp-is-animating{animation:bpSlideFadeDown .6s ease-in-out forwards}.pc-slide-fade-left{opacity:0;transform:translateX(-40px)}.pc-slide-fade-left.bp-is-animating{animation:bpSlideFadeLeft .6s ease-in-out forwards}.pc-slide-fade-right{opacity:0;transform:translateX(40px)}.pc-slide-fade-right.bp-is-animating{animation:bpSlideFadeRight .6s ease-in-out forwards}
`.replace(/(\.pc-(?!fade-out\{)[a-z-]+)(\{[^}]*\})(?=\1\.bp-is-animating)/g,"$1:where(:not(.bp-is-done-animating))$2"),Wr=`/**
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

    const reducedMotion = typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const animationEndHandlers = new WeakMap();

    function removeAnimationEnd(element) {
        const handler = animationEndHandlers.get(element);
        if (!handler) return;
        element.removeEventListener('animationend', handler);
        animationEndHandlers.delete(element);
    }

    function settleReducedMotion(element) {
        removeAnimationEnd(element);
        element.classList.remove('bp-is-hidden', 'bp-is-animating');
        element.classList.add('bp-is-visible', 'bp-is-done-animating');
        element.style.animation = '';
        element.style.animationDuration = '';
        element.style.animationDelay = '';
        element.style.animationTimingFunction = '';
    }

    function startAnimation(element) {
        if (reducedMotion && reducedMotion.matches) {
            settleReducedMotion(element);
            return;
        }
        const attributes = getAnimationAttributes(element);
        if (attributes !== null) applyAnimationStyles(element, attributes);
        element.classList.remove('bp-is-done-animating');
        element.classList.add('bp-is-animating');
        handleAnimationComplete(element);
    }

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
     * This function listens for the element's own preset animationend event.
     * When complete, it adds the "bp-is-done-animating" class.
     * 
     * @param {HTMLElement} element - The element that is animating
     * @since 1.0.0
     */
    function handleAnimationComplete(element) {
        const keyframeName = getKeyframeName(element);
        removeAnimationEnd(element);

        function onAnimationEnd(event) {
            // Ignore child animations and unrelated animations on the same element.
            if (event.target !== element || event.animationName !== keyframeName) {
                return;
            }
            removeAnimationEnd(element);
            element.classList.add('bp-is-done-animating');
            // Entrance keyframes must release transform and opacity so authored
            // Hover and Focus styles can own those properties after completion.
            // Legacy Fade out intentionally retains its forwards-filled state.
            if (keyframeName !== 'bpFadeOut') {
                element.classList.remove('bp-is-animating');
            }
        }

        animationEndHandlers.set(element, onAnimationEnd);
        element.addEventListener('animationend', onAnimationEnd);
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
                            startAnimation(element);
                            
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
                    removeAnimationEnd(element);
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
                startAnimation(element);
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

    // CSS cancels animations without animationend under reduced motion. Settle the
    // runtime state too, so restoring the preference cannot start a deferred entrance.
    if (reducedMotion) {
        const onMotionChange = function(event) {
            if (!event.matches) return;
            document.querySelectorAll('.bp-animate.bp-is-visible, .bp-animate.bp-is-animating').forEach(function(element) {
                if (getKeyframeName(element) !== null) settleReducedMotion(element);
            });
        };
        if (typeof reducedMotion.addEventListener === 'function') {
            reducedMotion.addEventListener('change', onMotionChange);
        } else if (typeof reducedMotion.addListener === 'function') {
            reducedMotion.addListener(onMotionChange);
        }
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

`;var Ur=`<script>
(function(){
  if(typeof Element.prototype.animate!=='function')return;
  var media=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
  var groups=[];
  document.querySelectorAll('.pagecraft-accordion').forEach(function(root){
    if(root.hasAttribute('data-pc-accordion-motion'))return;
    var items=Array.from(root.children).filter(function(item){return item.matches('details.pagecraft-accordion-item');});
    if(!items.length)return;
    var single=items.some(function(item){return item.hasAttribute('name');});
    var controls=[];
    root.setAttribute('data-pc-accordion-motion','');
    items.forEach(function(item){
      var summary=item.querySelector(':scope > summary');
      var answer=item.querySelector(':scope > .pagecraft-accordion-a');
      if(!summary||!answer)return;
      var name=item.getAttribute('name');
      var originalHeight=item.style.height,originalOverflow=item.style.overflow;
      var originalInert=answer.getAttribute('inert');
      var expanded=item.open,animation=null;
      // The native group would hide an outgoing answer before its closing transition.
      if(single)item.removeAttribute('name');
      function stop(){
        var previous=animation;animation=null;
        if(previous){previous.onfinish=null;previous.oncancel=null;previous.cancel();}
      }
      function settle(){
        stop();item.open=expanded;
        item.style.height=originalHeight;item.style.overflow=originalOverflow;
        if(originalInert===null)answer.removeAttribute('inert');else answer.setAttribute('inert',originalInert);
      }
      function set(open){
        if(open&&single)controls.forEach(function(other){if(other!==control&&other.expanded())other.set(false);});
        var from=item.getBoundingClientRect().height;
        stop();expanded=open;
        if(!open&&answer.contains(document.activeElement))summary.focus({preventScroll:true});
        if(media&&media.matches){settle();return;}
        if(!open)answer.setAttribute('inert','');else if(originalInert===null)answer.removeAttribute('inert');
        item.style.height=from+'px';item.style.overflow='hidden';item.open=true;
        var style=getComputedStyle(item);
        var border=(parseFloat(style.borderTopWidth)||0)+(parseFloat(style.borderBottomWidth)||0);
        var to=summary.getBoundingClientRect().height+border+(open?answer.getBoundingClientRect().height:0);
        if(Math.abs(to-from)<.5){settle();return;}
        try{
          var current=item.animate([{height:from+'px'},{height:to+'px'}],{
            duration:open?220:180,easing:open?'cubic-bezier(.16,1,.3,1)':'cubic-bezier(.4,0,1,1)'
          });
          animation=current;item.style.height=to+'px';
          current.onfinish=function(){if(animation===current)settle();};
          current.oncancel=function(){if(animation===current)settle();};
        }catch(error){settle();}
      }
      function click(event){
        if(event.defaultPrevented||event.button>0)return;
        if(!animation)expanded=item.open;
        event.preventDefault();set(!expanded);
      }
      function toggle(){
        // Honor native changes, including browser find/reveal and external open updates.
        if(animation){if(!item.open){expanded=false;settle();}return;}
        if(item.open===expanded)return;
        expanded=item.open;
        if(expanded&&single)controls.forEach(function(other){if(other!==control&&other.expanded())other.set(false);});
      }
      var control={set:set,expanded:function(){return expanded;},settle:settle,dispose:function(){
        summary.removeEventListener('click',click);item.removeEventListener('toggle',toggle);settle();
        if(name!==null)item.setAttribute('name',name);
      }};
      controls.push(control);summary.addEventListener('click',click);item.addEventListener('toggle',toggle);
    });
    groups.push({controls:controls,dispose:function(){
      controls.forEach(function(control){control.dispose();});root.removeAttribute('data-pc-accordion-motion');
    }});
  });
  if(!groups.length)return;
  function settleAll(){groups.forEach(function(group){group.controls.forEach(function(control){control.settle();});});}
  function preference(){if(media&&media.matches)settleAll();}
  window.addEventListener('resize',settleAll);
  if(media){if(media.addEventListener)media.addEventListener('change',preference);else if(media.addListener)media.addListener(preference);}
  if(typeof window.__pagecraftRegisterPreviewDispose==='function')window.__pagecraftRegisterPreviewDispose(function(){
    window.removeEventListener('resize',settleAll);
    if(media){if(media.removeEventListener)media.removeEventListener('change',preference);else if(media.removeListener)media.removeListener(preference);}
    groups.forEach(function(group){group.dispose();});
  });
})();
<\/script>
`;var Yr=new Uint16Array('\u1D41<\xD5\u0131\u028A\u049D\u057B\u05D0\u0675\u06DE\u07A2\u07D6\u080F\u0A4A\u0A91\u0DA1\u0E6D\u0F09\u0F26\u10CA\u1228\u12E1\u1415\u149D\u14C3\u14DF\u1525\0\0\0\0\0\0\u156B\u16CD\u198D\u1C12\u1DDD\u1F7E\u2060\u21B0\u228D\u23C0\u23FB\u2442\u2824\u2912\u2D08\u2E48\u2FCE\u3016\u32BA\u3639\u37AC\u38FE\u3A28\u3A71\u3AE0\u3B2E\u0800EMabcfglmnoprstu\\bfms\x7F\x84\x8B\x90\x95\x98\xA6\xB3\xB9\xC8\xCFlig\u803B\xC6\u40C6P\u803B&\u4026cute\u803B\xC1\u40C1reve;\u4102\u0100iyx}rc\u803B\xC2\u40C2;\u4410r;\uC000\u{1D504}rave\u803B\xC0\u40C0pha;\u4391acr;\u4100d;\u6A53\u0100gp\x9D\xA1on;\u4104f;\uC000\u{1D538}plyFunction;\u6061ing\u803B\xC5\u40C5\u0100cs\xBE\xC3r;\uC000\u{1D49C}ign;\u6254ilde\u803B\xC3\u40C3ml\u803B\xC4\u40C4\u0400aceforsu\xE5\xFB\xFE\u0117\u011C\u0122\u0127\u012A\u0100cr\xEA\xF2kslash;\u6216\u0176\xF6\xF8;\u6AE7ed;\u6306y;\u4411\u0180crt\u0105\u010B\u0114ause;\u6235noullis;\u612Ca;\u4392r;\uC000\u{1D505}pf;\uC000\u{1D539}eve;\u42D8c\xF2\u0113mpeq;\u624E\u0700HOacdefhilorsu\u014D\u0151\u0156\u0180\u019E\u01A2\u01B5\u01B7\u01BA\u01DC\u0215\u0273\u0278\u027Ecy;\u4427PY\u803B\xA9\u40A9\u0180cpy\u015D\u0162\u017Aute;\u4106\u0100;i\u0167\u0168\u62D2talDifferentialD;\u6145leys;\u612D\u0200aeio\u0189\u018E\u0194\u0198ron;\u410Cdil\u803B\xC7\u40C7rc;\u4108nint;\u6230ot;\u410A\u0100dn\u01A7\u01ADilla;\u40B8terDot;\u40B7\xF2\u017Fi;\u43A7rcle\u0200DMPT\u01C7\u01CB\u01D1\u01D6ot;\u6299inus;\u6296lus;\u6295imes;\u6297o\u0100cs\u01E2\u01F8kwiseContourIntegral;\u6232eCurly\u0100DQ\u0203\u020FoubleQuote;\u601Duote;\u6019\u0200lnpu\u021E\u0228\u0247\u0255on\u0100;e\u0225\u0226\u6237;\u6A74\u0180git\u022F\u0236\u023Aruent;\u6261nt;\u622FourIntegral;\u622E\u0100fr\u024C\u024E;\u6102oduct;\u6210nterClockwiseContourIntegral;\u6233oss;\u6A2Fcr;\uC000\u{1D49E}p\u0100;C\u0284\u0285\u62D3ap;\u624D\u0580DJSZacefios\u02A0\u02AC\u02B0\u02B4\u02B8\u02CB\u02D7\u02E1\u02E6\u0333\u048D\u0100;o\u0179\u02A5trahd;\u6911cy;\u4402cy;\u4405cy;\u440F\u0180grs\u02BF\u02C4\u02C7ger;\u6021r;\u61A1hv;\u6AE4\u0100ay\u02D0\u02D5ron;\u410E;\u4414l\u0100;t\u02DD\u02DE\u6207a;\u4394r;\uC000\u{1D507}\u0100af\u02EB\u0327\u0100cm\u02F0\u0322ritical\u0200ADGT\u0300\u0306\u0316\u031Ccute;\u40B4o\u0174\u030B\u030D;\u42D9bleAcute;\u42DDrave;\u4060ilde;\u42DCond;\u62C4ferentialD;\u6146\u0470\u033D\0\0\0\u0342\u0354\0\u0405f;\uC000\u{1D53B}\u0180;DE\u0348\u0349\u034D\u40A8ot;\u60DCqual;\u6250ble\u0300CDLRUV\u0363\u0372\u0382\u03CF\u03E2\u03F8ontourIntegra\xEC\u0239o\u0274\u0379\0\0\u037B\xBB\u0349nArrow;\u61D3\u0100eo\u0387\u03A4ft\u0180ART\u0390\u0396\u03A1rrow;\u61D0ightArrow;\u61D4e\xE5\u02CAng\u0100LR\u03AB\u03C4eft\u0100AR\u03B3\u03B9rrow;\u67F8ightArrow;\u67FAightArrow;\u67F9ight\u0100AT\u03D8\u03DErrow;\u61D2ee;\u62A8p\u0241\u03E9\0\0\u03EFrrow;\u61D1ownArrow;\u61D5erticalBar;\u6225n\u0300ABLRTa\u0412\u042A\u0430\u045E\u047F\u037Crrow\u0180;BU\u041D\u041E\u0422\u6193ar;\u6913pArrow;\u61F5reve;\u4311eft\u02D2\u043A\0\u0446\0\u0450ightVector;\u6950eeVector;\u695Eector\u0100;B\u0459\u045A\u61BDar;\u6956ight\u01D4\u0467\0\u0471eeVector;\u695Fector\u0100;B\u047A\u047B\u61C1ar;\u6957ee\u0100;A\u0486\u0487\u62A4rrow;\u61A7\u0100ct\u0492\u0497r;\uC000\u{1D49F}rok;\u4110\u0800NTacdfglmopqstux\u04BD\u04C0\u04C4\u04CB\u04DE\u04E2\u04E7\u04EE\u04F5\u0521\u052F\u0536\u0552\u055D\u0560\u0565G;\u414AH\u803B\xD0\u40D0cute\u803B\xC9\u40C9\u0180aiy\u04D2\u04D7\u04DCron;\u411Arc\u803B\xCA\u40CA;\u442Dot;\u4116r;\uC000\u{1D508}rave\u803B\xC8\u40C8ement;\u6208\u0100ap\u04FA\u04FEcr;\u4112ty\u0253\u0506\0\0\u0512mallSquare;\u65FBerySmallSquare;\u65AB\u0100gp\u0526\u052Aon;\u4118f;\uC000\u{1D53C}silon;\u4395u\u0100ai\u053C\u0549l\u0100;T\u0542\u0543\u6A75ilde;\u6242librium;\u61CC\u0100ci\u0557\u055Ar;\u6130m;\u6A73a;\u4397ml\u803B\xCB\u40CB\u0100ip\u056A\u056Fsts;\u6203onentialE;\u6147\u0280cfios\u0585\u0588\u058D\u05B2\u05CCy;\u4424r;\uC000\u{1D509}lled\u0253\u0597\0\0\u05A3mallSquare;\u65FCerySmallSquare;\u65AA\u0370\u05BA\0\u05BF\0\0\u05C4f;\uC000\u{1D53D}All;\u6200riertrf;\u6131c\xF2\u05CB\u0600JTabcdfgorst\u05E8\u05EC\u05EF\u05FA\u0600\u0612\u0616\u061B\u061D\u0623\u066C\u0672cy;\u4403\u803B>\u403Emma\u0100;d\u05F7\u05F8\u4393;\u43DCreve;\u411E\u0180eiy\u0607\u060C\u0610dil;\u4122rc;\u411C;\u4413ot;\u4120r;\uC000\u{1D50A};\u62D9pf;\uC000\u{1D53E}eater\u0300EFGLST\u0635\u0644\u064E\u0656\u065B\u0666qual\u0100;L\u063E\u063F\u6265ess;\u62DBullEqual;\u6267reater;\u6AA2ess;\u6277lantEqual;\u6A7Eilde;\u6273cr;\uC000\u{1D4A2};\u626B\u0400Aacfiosu\u0685\u068B\u0696\u069B\u069E\u06AA\u06BE\u06CARDcy;\u442A\u0100ct\u0690\u0694ek;\u42C7;\u405Eirc;\u4124r;\u610ClbertSpace;\u610B\u01F0\u06AF\0\u06B2f;\u610DizontalLine;\u6500\u0100ct\u06C3\u06C5\xF2\u06A9rok;\u4126mp\u0144\u06D0\u06D8ownHum\xF0\u012Fqual;\u624F\u0700EJOacdfgmnostu\u06FA\u06FE\u0703\u0707\u070E\u071A\u071E\u0721\u0728\u0744\u0778\u078B\u078F\u0795cy;\u4415lig;\u4132cy;\u4401cute\u803B\xCD\u40CD\u0100iy\u0713\u0718rc\u803B\xCE\u40CE;\u4418ot;\u4130r;\u6111rave\u803B\xCC\u40CC\u0180;ap\u0720\u072F\u073F\u0100cg\u0734\u0737r;\u412AinaryI;\u6148lie\xF3\u03DD\u01F4\u0749\0\u0762\u0100;e\u074D\u074E\u622C\u0100gr\u0753\u0758ral;\u622Bsection;\u62C2isible\u0100CT\u076C\u0772omma;\u6063imes;\u6062\u0180gpt\u077F\u0783\u0788on;\u412Ef;\uC000\u{1D540}a;\u4399cr;\u6110ilde;\u4128\u01EB\u079A\0\u079Ecy;\u4406l\u803B\xCF\u40CF\u0280cfosu\u07AC\u07B7\u07BC\u07C2\u07D0\u0100iy\u07B1\u07B5rc;\u4134;\u4419r;\uC000\u{1D50D}pf;\uC000\u{1D541}\u01E3\u07C7\0\u07CCr;\uC000\u{1D4A5}rcy;\u4408kcy;\u4404\u0380HJacfos\u07E4\u07E8\u07EC\u07F1\u07FD\u0802\u0808cy;\u4425cy;\u440Cppa;\u439A\u0100ey\u07F6\u07FBdil;\u4136;\u441Ar;\uC000\u{1D50E}pf;\uC000\u{1D542}cr;\uC000\u{1D4A6}\u0580JTaceflmost\u0825\u0829\u082C\u0850\u0863\u09B3\u09B8\u09C7\u09CD\u0A37\u0A47cy;\u4409\u803B<\u403C\u0280cmnpr\u0837\u083C\u0841\u0844\u084Dute;\u4139bda;\u439Bg;\u67EAlacetrf;\u6112r;\u619E\u0180aey\u0857\u085C\u0861ron;\u413Ddil;\u413B;\u441B\u0100fs\u0868\u0970t\u0500ACDFRTUVar\u087E\u08A9\u08B1\u08E0\u08E6\u08FC\u092F\u095B\u0390\u096A\u0100nr\u0883\u088FgleBracket;\u67E8row\u0180;BR\u0899\u089A\u089E\u6190ar;\u61E4ightArrow;\u61C6eiling;\u6308o\u01F5\u08B7\0\u08C3bleBracket;\u67E6n\u01D4\u08C8\0\u08D2eeVector;\u6961ector\u0100;B\u08DB\u08DC\u61C3ar;\u6959loor;\u630Aight\u0100AV\u08EF\u08F5rrow;\u6194ector;\u694E\u0100er\u0901\u0917e\u0180;AV\u0909\u090A\u0910\u62A3rrow;\u61A4ector;\u695Aiangle\u0180;BE\u0924\u0925\u0929\u62B2ar;\u69CFqual;\u62B4p\u0180DTV\u0937\u0942\u094CownVector;\u6951eeVector;\u6960ector\u0100;B\u0956\u0957\u61BFar;\u6958ector\u0100;B\u0965\u0966\u61BCar;\u6952ight\xE1\u039Cs\u0300EFGLST\u097E\u098B\u0995\u099D\u09A2\u09ADqualGreater;\u62DAullEqual;\u6266reater;\u6276ess;\u6AA1lantEqual;\u6A7Dilde;\u6272r;\uC000\u{1D50F}\u0100;e\u09BD\u09BE\u62D8ftarrow;\u61DAidot;\u413F\u0180npw\u09D4\u0A16\u0A1Bg\u0200LRlr\u09DE\u09F7\u0A02\u0A10eft\u0100AR\u09E6\u09ECrrow;\u67F5ightArrow;\u67F7ightArrow;\u67F6eft\u0100ar\u03B3\u0A0Aight\xE1\u03BFight\xE1\u03CAf;\uC000\u{1D543}er\u0100LR\u0A22\u0A2CeftArrow;\u6199ightArrow;\u6198\u0180cht\u0A3E\u0A40\u0A42\xF2\u084C;\u61B0rok;\u4141;\u626A\u0400acefiosu\u0A5A\u0A5D\u0A60\u0A77\u0A7C\u0A85\u0A8B\u0A8Ep;\u6905y;\u441C\u0100dl\u0A65\u0A6FiumSpace;\u605Flintrf;\u6133r;\uC000\u{1D510}nusPlus;\u6213pf;\uC000\u{1D544}c\xF2\u0A76;\u439C\u0480Jacefostu\u0AA3\u0AA7\u0AAD\u0AC0\u0B14\u0B19\u0D91\u0D97\u0D9Ecy;\u440Acute;\u4143\u0180aey\u0AB4\u0AB9\u0ABEron;\u4147dil;\u4145;\u441D\u0180gsw\u0AC7\u0AF0\u0B0Eative\u0180MTV\u0AD3\u0ADF\u0AE8ediumSpace;\u600Bhi\u0100cn\u0AE6\u0AD8\xEB\u0AD9eryThi\xEE\u0AD9ted\u0100GL\u0AF8\u0B06reaterGreate\xF2\u0673essLes\xF3\u0A48Line;\u400Ar;\uC000\u{1D511}\u0200Bnpt\u0B22\u0B28\u0B37\u0B3Areak;\u6060BreakingSpace;\u40A0f;\u6115\u0680;CDEGHLNPRSTV\u0B55\u0B56\u0B6A\u0B7C\u0BA1\u0BEB\u0C04\u0C5E\u0C84\u0CA6\u0CD8\u0D61\u0D85\u6AEC\u0100ou\u0B5B\u0B64ngruent;\u6262pCap;\u626DoubleVerticalBar;\u6226\u0180lqx\u0B83\u0B8A\u0B9Bement;\u6209ual\u0100;T\u0B92\u0B93\u6260ilde;\uC000\u2242\u0338ists;\u6204reater\u0380;EFGLST\u0BB6\u0BB7\u0BBD\u0BC9\u0BD3\u0BD8\u0BE5\u626Fqual;\u6271ullEqual;\uC000\u2267\u0338reater;\uC000\u226B\u0338ess;\u6279lantEqual;\uC000\u2A7E\u0338ilde;\u6275ump\u0144\u0BF2\u0BFDownHump;\uC000\u224E\u0338qual;\uC000\u224F\u0338e\u0100fs\u0C0A\u0C27tTriangle\u0180;BE\u0C1A\u0C1B\u0C21\u62EAar;\uC000\u29CF\u0338qual;\u62ECs\u0300;EGLST\u0C35\u0C36\u0C3C\u0C44\u0C4B\u0C58\u626Equal;\u6270reater;\u6278ess;\uC000\u226A\u0338lantEqual;\uC000\u2A7D\u0338ilde;\u6274ested\u0100GL\u0C68\u0C79reaterGreater;\uC000\u2AA2\u0338essLess;\uC000\u2AA1\u0338recedes\u0180;ES\u0C92\u0C93\u0C9B\u6280qual;\uC000\u2AAF\u0338lantEqual;\u62E0\u0100ei\u0CAB\u0CB9verseElement;\u620CghtTriangle\u0180;BE\u0CCB\u0CCC\u0CD2\u62EBar;\uC000\u29D0\u0338qual;\u62ED\u0100qu\u0CDD\u0D0CuareSu\u0100bp\u0CE8\u0CF9set\u0100;E\u0CF0\u0CF3\uC000\u228F\u0338qual;\u62E2erset\u0100;E\u0D03\u0D06\uC000\u2290\u0338qual;\u62E3\u0180bcp\u0D13\u0D24\u0D4Eset\u0100;E\u0D1B\u0D1E\uC000\u2282\u20D2qual;\u6288ceeds\u0200;EST\u0D32\u0D33\u0D3B\u0D46\u6281qual;\uC000\u2AB0\u0338lantEqual;\u62E1ilde;\uC000\u227F\u0338erset\u0100;E\u0D58\u0D5B\uC000\u2283\u20D2qual;\u6289ilde\u0200;EFT\u0D6E\u0D6F\u0D75\u0D7F\u6241qual;\u6244ullEqual;\u6247ilde;\u6249erticalBar;\u6224cr;\uC000\u{1D4A9}ilde\u803B\xD1\u40D1;\u439D\u0700Eacdfgmoprstuv\u0DBD\u0DC2\u0DC9\u0DD5\u0DDB\u0DE0\u0DE7\u0DFC\u0E02\u0E20\u0E22\u0E32\u0E3F\u0E44lig;\u4152cute\u803B\xD3\u40D3\u0100iy\u0DCE\u0DD3rc\u803B\xD4\u40D4;\u441Eblac;\u4150r;\uC000\u{1D512}rave\u803B\xD2\u40D2\u0180aei\u0DEE\u0DF2\u0DF6cr;\u414Cga;\u43A9cron;\u439Fpf;\uC000\u{1D546}enCurly\u0100DQ\u0E0E\u0E1AoubleQuote;\u601Cuote;\u6018;\u6A54\u0100cl\u0E27\u0E2Cr;\uC000\u{1D4AA}ash\u803B\xD8\u40D8i\u016C\u0E37\u0E3Cde\u803B\xD5\u40D5es;\u6A37ml\u803B\xD6\u40D6er\u0100BP\u0E4B\u0E60\u0100ar\u0E50\u0E53r;\u603Eac\u0100ek\u0E5A\u0E5C;\u63DEet;\u63B4arenthesis;\u63DC\u0480acfhilors\u0E7F\u0E87\u0E8A\u0E8F\u0E92\u0E94\u0E9D\u0EB0\u0EFCrtialD;\u6202y;\u441Fr;\uC000\u{1D513}i;\u43A6;\u43A0usMinus;\u40B1\u0100ip\u0EA2\u0EADncareplan\xE5\u069Df;\u6119\u0200;eio\u0EB9\u0EBA\u0EE0\u0EE4\u6ABBcedes\u0200;EST\u0EC8\u0EC9\u0ECF\u0EDA\u627Aqual;\u6AAFlantEqual;\u627Cilde;\u627Eme;\u6033\u0100dp\u0EE9\u0EEEuct;\u620Fortion\u0100;a\u0225\u0EF9l;\u621D\u0100ci\u0F01\u0F06r;\uC000\u{1D4AB};\u43A8\u0200Ufos\u0F11\u0F16\u0F1B\u0F1FOT\u803B"\u4022r;\uC000\u{1D514}pf;\u611Acr;\uC000\u{1D4AC}\u0600BEacefhiorsu\u0F3E\u0F43\u0F47\u0F60\u0F73\u0FA7\u0FAA\u0FAD\u1096\u10A9\u10B4\u10BEarr;\u6910G\u803B\xAE\u40AE\u0180cnr\u0F4E\u0F53\u0F56ute;\u4154g;\u67EBr\u0100;t\u0F5C\u0F5D\u61A0l;\u6916\u0180aey\u0F67\u0F6C\u0F71ron;\u4158dil;\u4156;\u4420\u0100;v\u0F78\u0F79\u611Cerse\u0100EU\u0F82\u0F99\u0100lq\u0F87\u0F8Eement;\u620Builibrium;\u61CBpEquilibrium;\u696Fr\xBB\u0F79o;\u43A1ght\u0400ACDFTUVa\u0FC1\u0FEB\u0FF3\u1022\u1028\u105B\u1087\u03D8\u0100nr\u0FC6\u0FD2gleBracket;\u67E9row\u0180;BL\u0FDC\u0FDD\u0FE1\u6192ar;\u61E5eftArrow;\u61C4eiling;\u6309o\u01F5\u0FF9\0\u1005bleBracket;\u67E7n\u01D4\u100A\0\u1014eeVector;\u695Dector\u0100;B\u101D\u101E\u61C2ar;\u6955loor;\u630B\u0100er\u102D\u1043e\u0180;AV\u1035\u1036\u103C\u62A2rrow;\u61A6ector;\u695Biangle\u0180;BE\u1050\u1051\u1055\u62B3ar;\u69D0qual;\u62B5p\u0180DTV\u1063\u106E\u1078ownVector;\u694FeeVector;\u695Cector\u0100;B\u1082\u1083\u61BEar;\u6954ector\u0100;B\u1091\u1092\u61C0ar;\u6953\u0100pu\u109B\u109Ef;\u611DndImplies;\u6970ightarrow;\u61DB\u0100ch\u10B9\u10BCr;\u611B;\u61B1leDelayed;\u69F4\u0680HOacfhimoqstu\u10E4\u10F1\u10F7\u10FD\u1119\u111E\u1151\u1156\u1161\u1167\u11B5\u11BB\u11BF\u0100Cc\u10E9\u10EEHcy;\u4429y;\u4428FTcy;\u442Ccute;\u415A\u0280;aeiy\u1108\u1109\u110E\u1113\u1117\u6ABCron;\u4160dil;\u415Erc;\u415C;\u4421r;\uC000\u{1D516}ort\u0200DLRU\u112A\u1134\u113E\u1149ownArrow\xBB\u041EeftArrow\xBB\u089AightArrow\xBB\u0FDDpArrow;\u6191gma;\u43A3allCircle;\u6218pf;\uC000\u{1D54A}\u0272\u116D\0\0\u1170t;\u621Aare\u0200;ISU\u117B\u117C\u1189\u11AF\u65A1ntersection;\u6293u\u0100bp\u118F\u119Eset\u0100;E\u1197\u1198\u628Fqual;\u6291erset\u0100;E\u11A8\u11A9\u6290qual;\u6292nion;\u6294cr;\uC000\u{1D4AE}ar;\u62C6\u0200bcmp\u11C8\u11DB\u1209\u120B\u0100;s\u11CD\u11CE\u62D0et\u0100;E\u11CD\u11D5qual;\u6286\u0100ch\u11E0\u1205eeds\u0200;EST\u11ED\u11EE\u11F4\u11FF\u627Bqual;\u6AB0lantEqual;\u627Dilde;\u627FTh\xE1\u0F8C;\u6211\u0180;es\u1212\u1213\u1223\u62D1rset\u0100;E\u121C\u121D\u6283qual;\u6287et\xBB\u1213\u0580HRSacfhiors\u123E\u1244\u1249\u1255\u125E\u1271\u1276\u129F\u12C2\u12C8\u12D1ORN\u803B\xDE\u40DEADE;\u6122\u0100Hc\u124E\u1252cy;\u440By;\u4426\u0100bu\u125A\u125C;\u4009;\u43A4\u0180aey\u1265\u126A\u126Fron;\u4164dil;\u4162;\u4422r;\uC000\u{1D517}\u0100ei\u127B\u1289\u01F2\u1280\0\u1287efore;\u6234a;\u4398\u0100cn\u128E\u1298kSpace;\uC000\u205F\u200ASpace;\u6009lde\u0200;EFT\u12AB\u12AC\u12B2\u12BC\u623Cqual;\u6243ullEqual;\u6245ilde;\u6248pf;\uC000\u{1D54B}ipleDot;\u60DB\u0100ct\u12D6\u12DBr;\uC000\u{1D4AF}rok;\u4166\u0AE1\u12F7\u130E\u131A\u1326\0\u132C\u1331\0\0\0\0\0\u1338\u133D\u1377\u1385\0\u13FF\u1404\u140A\u1410\u0100cr\u12FB\u1301ute\u803B\xDA\u40DAr\u0100;o\u1307\u1308\u619Fcir;\u6949r\u01E3\u1313\0\u1316y;\u440Eve;\u416C\u0100iy\u131E\u1323rc\u803B\xDB\u40DB;\u4423blac;\u4170r;\uC000\u{1D518}rave\u803B\xD9\u40D9acr;\u416A\u0100di\u1341\u1369er\u0100BP\u1348\u135D\u0100ar\u134D\u1350r;\u405Fac\u0100ek\u1357\u1359;\u63DFet;\u63B5arenthesis;\u63DDon\u0100;P\u1370\u1371\u62C3lus;\u628E\u0100gp\u137B\u137Fon;\u4172f;\uC000\u{1D54C}\u0400ADETadps\u1395\u13AE\u13B8\u13C4\u03E8\u13D2\u13D7\u13F3rrow\u0180;BD\u1150\u13A0\u13A4ar;\u6912ownArrow;\u61C5ownArrow;\u6195quilibrium;\u696Eee\u0100;A\u13CB\u13CC\u62A5rrow;\u61A5own\xE1\u03F3er\u0100LR\u13DE\u13E8eftArrow;\u6196ightArrow;\u6197i\u0100;l\u13F9\u13FA\u43D2on;\u43A5ing;\u416Ecr;\uC000\u{1D4B0}ilde;\u4168ml\u803B\xDC\u40DC\u0480Dbcdefosv\u1427\u142C\u1430\u1433\u143E\u1485\u148A\u1490\u1496ash;\u62ABar;\u6AEBy;\u4412ash\u0100;l\u143B\u143C\u62A9;\u6AE6\u0100er\u1443\u1445;\u62C1\u0180bty\u144C\u1450\u147Aar;\u6016\u0100;i\u144F\u1455cal\u0200BLST\u1461\u1465\u146A\u1474ar;\u6223ine;\u407Ceparator;\u6758ilde;\u6240ThinSpace;\u600Ar;\uC000\u{1D519}pf;\uC000\u{1D54D}cr;\uC000\u{1D4B1}dash;\u62AA\u0280cefos\u14A7\u14AC\u14B1\u14B6\u14BCirc;\u4174dge;\u62C0r;\uC000\u{1D51A}pf;\uC000\u{1D54E}cr;\uC000\u{1D4B2}\u0200fios\u14CB\u14D0\u14D2\u14D8r;\uC000\u{1D51B};\u439Epf;\uC000\u{1D54F}cr;\uC000\u{1D4B3}\u0480AIUacfosu\u14F1\u14F5\u14F9\u14FD\u1504\u150F\u1514\u151A\u1520cy;\u442Fcy;\u4407cy;\u442Ecute\u803B\xDD\u40DD\u0100iy\u1509\u150Drc;\u4176;\u442Br;\uC000\u{1D51C}pf;\uC000\u{1D550}cr;\uC000\u{1D4B4}ml;\u4178\u0400Hacdefos\u1535\u1539\u153F\u154B\u154F\u155D\u1560\u1564cy;\u4416cute;\u4179\u0100ay\u1544\u1549ron;\u417D;\u4417ot;\u417B\u01F2\u1554\0\u155BoWidt\xE8\u0AD9a;\u4396r;\u6128pf;\u6124cr;\uC000\u{1D4B5}\u0BE1\u1583\u158A\u1590\0\u15B0\u15B6\u15BF\0\0\0\0\u15C6\u15DB\u15EB\u165F\u166D\0\u1695\u169B\u16B2\u16B9\0\u16BEcute\u803B\xE1\u40E1reve;\u4103\u0300;Ediuy\u159C\u159D\u15A1\u15A3\u15A8\u15AD\u623E;\uC000\u223E\u0333;\u623Frc\u803B\xE2\u40E2te\u80BB\xB4\u0306;\u4430lig\u803B\xE6\u40E6\u0100;r\xB2\u15BA;\uC000\u{1D51E}rave\u803B\xE0\u40E0\u0100ep\u15CA\u15D6\u0100fp\u15CF\u15D4sym;\u6135\xE8\u15D3ha;\u43B1\u0100ap\u15DFc\u0100cl\u15E4\u15E7r;\u4101g;\u6A3F\u0264\u15F0\0\0\u160A\u0280;adsv\u15FA\u15FB\u15FF\u1601\u1607\u6227nd;\u6A55;\u6A5Clope;\u6A58;\u6A5A\u0380;elmrsz\u1618\u1619\u161B\u161E\u163F\u164F\u1659\u6220;\u69A4e\xBB\u1619sd\u0100;a\u1625\u1626\u6221\u0461\u1630\u1632\u1634\u1636\u1638\u163A\u163C\u163E;\u69A8;\u69A9;\u69AA;\u69AB;\u69AC;\u69AD;\u69AE;\u69AFt\u0100;v\u1645\u1646\u621Fb\u0100;d\u164C\u164D\u62BE;\u699D\u0100pt\u1654\u1657h;\u6222\xBB\xB9arr;\u637C\u0100gp\u1663\u1667on;\u4105f;\uC000\u{1D552}\u0380;Eaeiop\u12C1\u167B\u167D\u1682\u1684\u1687\u168A;\u6A70cir;\u6A6F;\u624Ad;\u624Bs;\u4027rox\u0100;e\u12C1\u1692\xF1\u1683ing\u803B\xE5\u40E5\u0180cty\u16A1\u16A6\u16A8r;\uC000\u{1D4B6};\u402Amp\u0100;e\u12C1\u16AF\xF1\u0288ilde\u803B\xE3\u40E3ml\u803B\xE4\u40E4\u0100ci\u16C2\u16C8onin\xF4\u0272nt;\u6A11\u0800Nabcdefiklnoprsu\u16ED\u16F1\u1730\u173C\u1743\u1748\u1778\u177D\u17E0\u17E6\u1839\u1850\u170D\u193D\u1948\u1970ot;\u6AED\u0100cr\u16F6\u171Ek\u0200ceps\u1700\u1705\u170D\u1713ong;\u624Cpsilon;\u43F6rime;\u6035im\u0100;e\u171A\u171B\u623Dq;\u62CD\u0176\u1722\u1726ee;\u62BDed\u0100;g\u172C\u172D\u6305e\xBB\u172Drk\u0100;t\u135C\u1737brk;\u63B6\u0100oy\u1701\u1741;\u4431quo;\u601E\u0280cmprt\u1753\u175B\u1761\u1764\u1768aus\u0100;e\u010A\u0109ptyv;\u69B0s\xE9\u170Cno\xF5\u0113\u0180ahw\u176F\u1771\u1773;\u43B2;\u6136een;\u626Cr;\uC000\u{1D51F}g\u0380costuvw\u178D\u179D\u17B3\u17C1\u17D5\u17DB\u17DE\u0180aiu\u1794\u1796\u179A\xF0\u0760rc;\u65EFp\xBB\u1371\u0180dpt\u17A4\u17A8\u17ADot;\u6A00lus;\u6A01imes;\u6A02\u0271\u17B9\0\0\u17BEcup;\u6A06ar;\u6605riangle\u0100du\u17CD\u17D2own;\u65BDp;\u65B3plus;\u6A04e\xE5\u1444\xE5\u14ADarow;\u690D\u0180ako\u17ED\u1826\u1835\u0100cn\u17F2\u1823k\u0180lst\u17FA\u05AB\u1802ozenge;\u69EBriangle\u0200;dlr\u1812\u1813\u1818\u181D\u65B4own;\u65BEeft;\u65C2ight;\u65B8k;\u6423\u01B1\u182B\0\u1833\u01B2\u182F\0\u1831;\u6592;\u65914;\u6593ck;\u6588\u0100eo\u183E\u184D\u0100;q\u1843\u1846\uC000=\u20E5uiv;\uC000\u2261\u20E5t;\u6310\u0200ptwx\u1859\u185E\u1867\u186Cf;\uC000\u{1D553}\u0100;t\u13CB\u1863om\xBB\u13CCtie;\u62C8\u0600DHUVbdhmptuv\u1885\u1896\u18AA\u18BB\u18D7\u18DB\u18EC\u18FF\u1905\u190A\u1910\u1921\u0200LRlr\u188E\u1890\u1892\u1894;\u6557;\u6554;\u6556;\u6553\u0280;DUdu\u18A1\u18A2\u18A4\u18A6\u18A8\u6550;\u6566;\u6569;\u6564;\u6567\u0200LRlr\u18B3\u18B5\u18B7\u18B9;\u655D;\u655A;\u655C;\u6559\u0380;HLRhlr\u18CA\u18CB\u18CD\u18CF\u18D1\u18D3\u18D5\u6551;\u656C;\u6563;\u6560;\u656B;\u6562;\u655Fox;\u69C9\u0200LRlr\u18E4\u18E6\u18E8\u18EA;\u6555;\u6552;\u6510;\u650C\u0280;DUdu\u06BD\u18F7\u18F9\u18FB\u18FD;\u6565;\u6568;\u652C;\u6534inus;\u629Flus;\u629Eimes;\u62A0\u0200LRlr\u1919\u191B\u191D\u191F;\u655B;\u6558;\u6518;\u6514\u0380;HLRhlr\u1930\u1931\u1933\u1935\u1937\u1939\u193B\u6502;\u656A;\u6561;\u655E;\u653C;\u6524;\u651C\u0100ev\u0123\u1942bar\u803B\xA6\u40A6\u0200ceio\u1951\u1956\u195A\u1960r;\uC000\u{1D4B7}mi;\u604Fm\u0100;e\u171A\u171Cl\u0180;bh\u1968\u1969\u196B\u405C;\u69C5sub;\u67C8\u016C\u1974\u197El\u0100;e\u1979\u197A\u6022t\xBB\u197Ap\u0180;Ee\u012F\u1985\u1987;\u6AAE\u0100;q\u06DC\u06DB\u0CE1\u19A7\0\u19E8\u1A11\u1A15\u1A32\0\u1A37\u1A50\0\0\u1AB4\0\0\u1AC1\0\0\u1B21\u1B2E\u1B4D\u1B52\0\u1BFD\0\u1C0C\u0180cpr\u19AD\u19B2\u19DDute;\u4107\u0300;abcds\u19BF\u19C0\u19C4\u19CA\u19D5\u19D9\u6229nd;\u6A44rcup;\u6A49\u0100au\u19CF\u19D2p;\u6A4Bp;\u6A47ot;\u6A40;\uC000\u2229\uFE00\u0100eo\u19E2\u19E5t;\u6041\xEE\u0693\u0200aeiu\u19F0\u19FB\u1A01\u1A05\u01F0\u19F5\0\u19F8s;\u6A4Don;\u410Ddil\u803B\xE7\u40E7rc;\u4109ps\u0100;s\u1A0C\u1A0D\u6A4Cm;\u6A50ot;\u410B\u0180dmn\u1A1B\u1A20\u1A26il\u80BB\xB8\u01ADptyv;\u69B2t\u8100\xA2;e\u1A2D\u1A2E\u40A2r\xE4\u01B2r;\uC000\u{1D520}\u0180cei\u1A3D\u1A40\u1A4Dy;\u4447ck\u0100;m\u1A47\u1A48\u6713ark\xBB\u1A48;\u43C7r\u0380;Ecefms\u1A5F\u1A60\u1A62\u1A6B\u1AA4\u1AAA\u1AAE\u65CB;\u69C3\u0180;el\u1A69\u1A6A\u1A6D\u42C6q;\u6257e\u0261\u1A74\0\0\u1A88rrow\u0100lr\u1A7C\u1A81eft;\u61BAight;\u61BB\u0280RSacd\u1A92\u1A94\u1A96\u1A9A\u1A9F\xBB\u0F47;\u64C8st;\u629Birc;\u629Aash;\u629Dnint;\u6A10id;\u6AEFcir;\u69C2ubs\u0100;u\u1ABB\u1ABC\u6663it\xBB\u1ABC\u02EC\u1AC7\u1AD4\u1AFA\0\u1B0Aon\u0100;e\u1ACD\u1ACE\u403A\u0100;q\xC7\xC6\u026D\u1AD9\0\0\u1AE2a\u0100;t\u1ADE\u1ADF\u402C;\u4040\u0180;fl\u1AE8\u1AE9\u1AEB\u6201\xEE\u1160e\u0100mx\u1AF1\u1AF6ent\xBB\u1AE9e\xF3\u024D\u01E7\u1AFE\0\u1B07\u0100;d\u12BB\u1B02ot;\u6A6Dn\xF4\u0246\u0180fry\u1B10\u1B14\u1B17;\uC000\u{1D554}o\xE4\u0254\u8100\xA9;s\u0155\u1B1Dr;\u6117\u0100ao\u1B25\u1B29rr;\u61B5ss;\u6717\u0100cu\u1B32\u1B37r;\uC000\u{1D4B8}\u0100bp\u1B3C\u1B44\u0100;e\u1B41\u1B42\u6ACF;\u6AD1\u0100;e\u1B49\u1B4A\u6AD0;\u6AD2dot;\u62EF\u0380delprvw\u1B60\u1B6C\u1B77\u1B82\u1BAC\u1BD4\u1BF9arr\u0100lr\u1B68\u1B6A;\u6938;\u6935\u0270\u1B72\0\0\u1B75r;\u62DEc;\u62DFarr\u0100;p\u1B7F\u1B80\u61B6;\u693D\u0300;bcdos\u1B8F\u1B90\u1B96\u1BA1\u1BA5\u1BA8\u622Arcap;\u6A48\u0100au\u1B9B\u1B9Ep;\u6A46p;\u6A4Aot;\u628Dr;\u6A45;\uC000\u222A\uFE00\u0200alrv\u1BB5\u1BBF\u1BDE\u1BE3rr\u0100;m\u1BBC\u1BBD\u61B7;\u693Cy\u0180evw\u1BC7\u1BD4\u1BD8q\u0270\u1BCE\0\0\u1BD2re\xE3\u1B73u\xE3\u1B75ee;\u62CEedge;\u62CFen\u803B\xA4\u40A4earrow\u0100lr\u1BEE\u1BF3eft\xBB\u1B80ight\xBB\u1BBDe\xE4\u1BDD\u0100ci\u1C01\u1C07onin\xF4\u01F7nt;\u6231lcty;\u632D\u0980AHabcdefhijlorstuwz\u1C38\u1C3B\u1C3F\u1C5D\u1C69\u1C75\u1C8A\u1C9E\u1CAC\u1CB7\u1CFB\u1CFF\u1D0D\u1D7B\u1D91\u1DAB\u1DBB\u1DC6\u1DCDr\xF2\u0381ar;\u6965\u0200glrs\u1C48\u1C4D\u1C52\u1C54ger;\u6020eth;\u6138\xF2\u1133h\u0100;v\u1C5A\u1C5B\u6010\xBB\u090A\u016B\u1C61\u1C67arow;\u690Fa\xE3\u0315\u0100ay\u1C6E\u1C73ron;\u410F;\u4434\u0180;ao\u0332\u1C7C\u1C84\u0100gr\u02BF\u1C81r;\u61CAtseq;\u6A77\u0180glm\u1C91\u1C94\u1C98\u803B\xB0\u40B0ta;\u43B4ptyv;\u69B1\u0100ir\u1CA3\u1CA8sht;\u697F;\uC000\u{1D521}ar\u0100lr\u1CB3\u1CB5\xBB\u08DC\xBB\u101E\u0280aegsv\u1CC2\u0378\u1CD6\u1CDC\u1CE0m\u0180;os\u0326\u1CCA\u1CD4nd\u0100;s\u0326\u1CD1uit;\u6666amma;\u43DDin;\u62F2\u0180;io\u1CE7\u1CE8\u1CF8\u40F7de\u8100\xF7;o\u1CE7\u1CF0ntimes;\u62C7n\xF8\u1CF7cy;\u4452c\u026F\u1D06\0\0\u1D0Arn;\u631Eop;\u630D\u0280lptuw\u1D18\u1D1D\u1D22\u1D49\u1D55lar;\u4024f;\uC000\u{1D555}\u0280;emps\u030B\u1D2D\u1D37\u1D3D\u1D42q\u0100;d\u0352\u1D33ot;\u6251inus;\u6238lus;\u6214quare;\u62A1blebarwedg\xE5\xFAn\u0180adh\u112E\u1D5D\u1D67ownarrow\xF3\u1C83arpoon\u0100lr\u1D72\u1D76ef\xF4\u1CB4igh\xF4\u1CB6\u0162\u1D7F\u1D85karo\xF7\u0F42\u026F\u1D8A\0\0\u1D8Ern;\u631Fop;\u630C\u0180cot\u1D98\u1DA3\u1DA6\u0100ry\u1D9D\u1DA1;\uC000\u{1D4B9};\u4455l;\u69F6rok;\u4111\u0100dr\u1DB0\u1DB4ot;\u62F1i\u0100;f\u1DBA\u1816\u65BF\u0100ah\u1DC0\u1DC3r\xF2\u0429a\xF2\u0FA6angle;\u69A6\u0100ci\u1DD2\u1DD5y;\u445Fgrarr;\u67FF\u0900Dacdefglmnopqrstux\u1E01\u1E09\u1E19\u1E38\u0578\u1E3C\u1E49\u1E61\u1E7E\u1EA5\u1EAF\u1EBD\u1EE1\u1F2A\u1F37\u1F44\u1F4E\u1F5A\u0100Do\u1E06\u1D34o\xF4\u1C89\u0100cs\u1E0E\u1E14ute\u803B\xE9\u40E9ter;\u6A6E\u0200aioy\u1E22\u1E27\u1E31\u1E36ron;\u411Br\u0100;c\u1E2D\u1E2E\u6256\u803B\xEA\u40EAlon;\u6255;\u444Dot;\u4117\u0100Dr\u1E41\u1E45ot;\u6252;\uC000\u{1D522}\u0180;rs\u1E50\u1E51\u1E57\u6A9Aave\u803B\xE8\u40E8\u0100;d\u1E5C\u1E5D\u6A96ot;\u6A98\u0200;ils\u1E6A\u1E6B\u1E72\u1E74\u6A99nters;\u63E7;\u6113\u0100;d\u1E79\u1E7A\u6A95ot;\u6A97\u0180aps\u1E85\u1E89\u1E97cr;\u4113ty\u0180;sv\u1E92\u1E93\u1E95\u6205et\xBB\u1E93p\u01001;\u1E9D\u1EA4\u0133\u1EA1\u1EA3;\u6004;\u6005\u6003\u0100gs\u1EAA\u1EAC;\u414Bp;\u6002\u0100gp\u1EB4\u1EB8on;\u4119f;\uC000\u{1D556}\u0180als\u1EC4\u1ECE\u1ED2r\u0100;s\u1ECA\u1ECB\u62D5l;\u69E3us;\u6A71i\u0180;lv\u1EDA\u1EDB\u1EDF\u43B5on\xBB\u1EDB;\u43F5\u0200csuv\u1EEA\u1EF3\u1F0B\u1F23\u0100io\u1EEF\u1E31rc\xBB\u1E2E\u0269\u1EF9\0\0\u1EFB\xED\u0548ant\u0100gl\u1F02\u1F06tr\xBB\u1E5Dess\xBB\u1E7A\u0180aei\u1F12\u1F16\u1F1Als;\u403Dst;\u625Fv\u0100;D\u0235\u1F20D;\u6A78parsl;\u69E5\u0100Da\u1F2F\u1F33ot;\u6253rr;\u6971\u0180cdi\u1F3E\u1F41\u1EF8r;\u612Fo\xF4\u0352\u0100ah\u1F49\u1F4B;\u43B7\u803B\xF0\u40F0\u0100mr\u1F53\u1F57l\u803B\xEB\u40EBo;\u60AC\u0180cip\u1F61\u1F64\u1F67l;\u4021s\xF4\u056E\u0100eo\u1F6C\u1F74ctatio\xEE\u0559nential\xE5\u0579\u09E1\u1F92\0\u1F9E\0\u1FA1\u1FA7\0\0\u1FC6\u1FCC\0\u1FD3\0\u1FE6\u1FEA\u2000\0\u2008\u205Allingdotse\xF1\u1E44y;\u4444male;\u6640\u0180ilr\u1FAD\u1FB3\u1FC1lig;\u8000\uFB03\u0269\u1FB9\0\0\u1FBDg;\u8000\uFB00ig;\u8000\uFB04;\uC000\u{1D523}lig;\u8000\uFB01lig;\uC000fj\u0180alt\u1FD9\u1FDC\u1FE1t;\u666Dig;\u8000\uFB02ns;\u65B1of;\u4192\u01F0\u1FEE\0\u1FF3f;\uC000\u{1D557}\u0100ak\u05BF\u1FF7\u0100;v\u1FFC\u1FFD\u62D4;\u6AD9artint;\u6A0D\u0100ao\u200C\u2055\u0100cs\u2011\u2052\u03B1\u201A\u2030\u2038\u2045\u2048\0\u2050\u03B2\u2022\u2025\u2027\u202A\u202C\0\u202E\u803B\xBD\u40BD;\u6153\u803B\xBC\u40BC;\u6155;\u6159;\u615B\u01B3\u2034\0\u2036;\u6154;\u6156\u02B4\u203E\u2041\0\0\u2043\u803B\xBE\u40BE;\u6157;\u615C5;\u6158\u01B6\u204C\0\u204E;\u615A;\u615D8;\u615El;\u6044wn;\u6322cr;\uC000\u{1D4BB}\u0880Eabcdefgijlnorstv\u2082\u2089\u209F\u20A5\u20B0\u20B4\u20F0\u20F5\u20FA\u20FF\u2103\u2112\u2138\u0317\u213E\u2152\u219E\u0100;l\u064D\u2087;\u6A8C\u0180cmp\u2090\u2095\u209Dute;\u41F5ma\u0100;d\u209C\u1CDA\u43B3;\u6A86reve;\u411F\u0100iy\u20AA\u20AErc;\u411D;\u4433ot;\u4121\u0200;lqs\u063E\u0642\u20BD\u20C9\u0180;qs\u063E\u064C\u20C4lan\xF4\u0665\u0200;cdl\u0665\u20D2\u20D5\u20E5c;\u6AA9ot\u0100;o\u20DC\u20DD\u6A80\u0100;l\u20E2\u20E3\u6A82;\u6A84\u0100;e\u20EA\u20ED\uC000\u22DB\uFE00s;\u6A94r;\uC000\u{1D524}\u0100;g\u0673\u061Bmel;\u6137cy;\u4453\u0200;Eaj\u065A\u210C\u210E\u2110;\u6A92;\u6AA5;\u6AA4\u0200Eaes\u211B\u211D\u2129\u2134;\u6269p\u0100;p\u2123\u2124\u6A8Arox\xBB\u2124\u0100;q\u212E\u212F\u6A88\u0100;q\u212E\u211Bim;\u62E7pf;\uC000\u{1D558}\u0100ci\u2143\u2146r;\u610Am\u0180;el\u066B\u214E\u2150;\u6A8E;\u6A90\u8300>;cdlqr\u05EE\u2160\u216A\u216E\u2173\u2179\u0100ci\u2165\u2167;\u6AA7r;\u6A7Aot;\u62D7Par;\u6995uest;\u6A7C\u0280adels\u2184\u216A\u2190\u0656\u219B\u01F0\u2189\0\u218Epro\xF8\u209Er;\u6978q\u0100lq\u063F\u2196les\xF3\u2088i\xED\u066B\u0100en\u21A3\u21ADrtneqq;\uC000\u2269\uFE00\xC5\u21AA\u0500Aabcefkosy\u21C4\u21C7\u21F1\u21F5\u21FA\u2218\u221D\u222F\u2268\u227Dr\xF2\u03A0\u0200ilmr\u21D0\u21D4\u21D7\u21DBrs\xF0\u1484f\xBB\u2024il\xF4\u06A9\u0100dr\u21E0\u21E4cy;\u444A\u0180;cw\u08F4\u21EB\u21EFir;\u6948;\u61ADar;\u610Firc;\u4125\u0180alr\u2201\u220E\u2213rts\u0100;u\u2209\u220A\u6665it\xBB\u220Alip;\u6026con;\u62B9r;\uC000\u{1D525}s\u0100ew\u2223\u2229arow;\u6925arow;\u6926\u0280amopr\u223A\u223E\u2243\u225E\u2263rr;\u61FFtht;\u623Bk\u0100lr\u2249\u2253eftarrow;\u61A9ightarrow;\u61AAf;\uC000\u{1D559}bar;\u6015\u0180clt\u226F\u2274\u2278r;\uC000\u{1D4BD}as\xE8\u21F4rok;\u4127\u0100bp\u2282\u2287ull;\u6043hen\xBB\u1C5B\u0AE1\u22A3\0\u22AA\0\u22B8\u22C5\u22CE\0\u22D5\u22F3\0\0\u22F8\u2322\u2367\u2362\u237F\0\u2386\u23AA\u23B4cute\u803B\xED\u40ED\u0180;iy\u0771\u22B0\u22B5rc\u803B\xEE\u40EE;\u4438\u0100cx\u22BC\u22BFy;\u4435cl\u803B\xA1\u40A1\u0100fr\u039F\u22C9;\uC000\u{1D526}rave\u803B\xEC\u40EC\u0200;ino\u073E\u22DD\u22E9\u22EE\u0100in\u22E2\u22E6nt;\u6A0Ct;\u622Dfin;\u69DCta;\u6129lig;\u4133\u0180aop\u22FE\u231A\u231D\u0180cgt\u2305\u2308\u2317r;\u412B\u0180elp\u071F\u230F\u2313in\xE5\u078Ear\xF4\u0720h;\u4131f;\u62B7ed;\u41B5\u0280;cfot\u04F4\u232C\u2331\u233D\u2341are;\u6105in\u0100;t\u2338\u2339\u621Eie;\u69DDdo\xF4\u2319\u0280;celp\u0757\u234C\u2350\u235B\u2361al;\u62BA\u0100gr\u2355\u2359er\xF3\u1563\xE3\u234Darhk;\u6A17rod;\u6A3C\u0200cgpt\u236F\u2372\u2376\u237By;\u4451on;\u412Ff;\uC000\u{1D55A}a;\u43B9uest\u803B\xBF\u40BF\u0100ci\u238A\u238Fr;\uC000\u{1D4BE}n\u0280;Edsv\u04F4\u239B\u239D\u23A1\u04F3;\u62F9ot;\u62F5\u0100;v\u23A6\u23A7\u62F4;\u62F3\u0100;i\u0777\u23AElde;\u4129\u01EB\u23B8\0\u23BCcy;\u4456l\u803B\xEF\u40EF\u0300cfmosu\u23CC\u23D7\u23DC\u23E1\u23E7\u23F5\u0100iy\u23D1\u23D5rc;\u4135;\u4439r;\uC000\u{1D527}ath;\u4237pf;\uC000\u{1D55B}\u01E3\u23EC\0\u23F1r;\uC000\u{1D4BF}rcy;\u4458kcy;\u4454\u0400acfghjos\u240B\u2416\u2422\u2427\u242D\u2431\u2435\u243Bppa\u0100;v\u2413\u2414\u43BA;\u43F0\u0100ey\u241B\u2420dil;\u4137;\u443Ar;\uC000\u{1D528}reen;\u4138cy;\u4445cy;\u445Cpf;\uC000\u{1D55C}cr;\uC000\u{1D4C0}\u0B80ABEHabcdefghjlmnoprstuv\u2470\u2481\u2486\u248D\u2491\u250E\u253D\u255A\u2580\u264E\u265E\u2665\u2679\u267D\u269A\u26B2\u26D8\u275D\u2768\u278B\u27C0\u2801\u2812\u0180art\u2477\u247A\u247Cr\xF2\u09C6\xF2\u0395ail;\u691Barr;\u690E\u0100;g\u0994\u248B;\u6A8Bar;\u6962\u0963\u24A5\0\u24AA\0\u24B1\0\0\0\0\0\u24B5\u24BA\0\u24C6\u24C8\u24CD\0\u24F9ute;\u413Amptyv;\u69B4ra\xEE\u084Cbda;\u43BBg\u0180;dl\u088E\u24C1\u24C3;\u6991\xE5\u088E;\u6A85uo\u803B\xAB\u40ABr\u0400;bfhlpst\u0899\u24DE\u24E6\u24E9\u24EB\u24EE\u24F1\u24F5\u0100;f\u089D\u24E3s;\u691Fs;\u691D\xEB\u2252p;\u61ABl;\u6939im;\u6973l;\u61A2\u0180;ae\u24FF\u2500\u2504\u6AABil;\u6919\u0100;s\u2509\u250A\u6AAD;\uC000\u2AAD\uFE00\u0180abr\u2515\u2519\u251Drr;\u690Crk;\u6772\u0100ak\u2522\u252Cc\u0100ek\u2528\u252A;\u407B;\u405B\u0100es\u2531\u2533;\u698Bl\u0100du\u2539\u253B;\u698F;\u698D\u0200aeuy\u2546\u254B\u2556\u2558ron;\u413E\u0100di\u2550\u2554il;\u413C\xEC\u08B0\xE2\u2529;\u443B\u0200cqrs\u2563\u2566\u256D\u257Da;\u6936uo\u0100;r\u0E19\u1746\u0100du\u2572\u2577har;\u6967shar;\u694Bh;\u61B2\u0280;fgqs\u258B\u258C\u0989\u25F3\u25FF\u6264t\u0280ahlrt\u2598\u25A4\u25B7\u25C2\u25E8rrow\u0100;t\u0899\u25A1a\xE9\u24F6arpoon\u0100du\u25AF\u25B4own\xBB\u045Ap\xBB\u0966eftarrows;\u61C7ight\u0180ahs\u25CD\u25D6\u25DErrow\u0100;s\u08F4\u08A7arpoon\xF3\u0F98quigarro\xF7\u21F0hreetimes;\u62CB\u0180;qs\u258B\u0993\u25FAlan\xF4\u09AC\u0280;cdgs\u09AC\u260A\u260D\u261D\u2628c;\u6AA8ot\u0100;o\u2614\u2615\u6A7F\u0100;r\u261A\u261B\u6A81;\u6A83\u0100;e\u2622\u2625\uC000\u22DA\uFE00s;\u6A93\u0280adegs\u2633\u2639\u263D\u2649\u264Bppro\xF8\u24C6ot;\u62D6q\u0100gq\u2643\u2645\xF4\u0989gt\xF2\u248C\xF4\u099Bi\xED\u09B2\u0180ilr\u2655\u08E1\u265Asht;\u697C;\uC000\u{1D529}\u0100;E\u099C\u2663;\u6A91\u0161\u2669\u2676r\u0100du\u25B2\u266E\u0100;l\u0965\u2673;\u696Alk;\u6584cy;\u4459\u0280;acht\u0A48\u2688\u268B\u2691\u2696r\xF2\u25C1orne\xF2\u1D08ard;\u696Bri;\u65FA\u0100io\u269F\u26A4dot;\u4140ust\u0100;a\u26AC\u26AD\u63B0che\xBB\u26AD\u0200Eaes\u26BB\u26BD\u26C9\u26D4;\u6268p\u0100;p\u26C3\u26C4\u6A89rox\xBB\u26C4\u0100;q\u26CE\u26CF\u6A87\u0100;q\u26CE\u26BBim;\u62E6\u0400abnoptwz\u26E9\u26F4\u26F7\u271A\u272F\u2741\u2747\u2750\u0100nr\u26EE\u26F1g;\u67ECr;\u61FDr\xEB\u08C1g\u0180lmr\u26FF\u270D\u2714eft\u0100ar\u09E6\u2707ight\xE1\u09F2apsto;\u67FCight\xE1\u09FDparrow\u0100lr\u2725\u2729ef\xF4\u24EDight;\u61AC\u0180afl\u2736\u2739\u273Dr;\u6985;\uC000\u{1D55D}us;\u6A2Dimes;\u6A34\u0161\u274B\u274Fst;\u6217\xE1\u134E\u0180;ef\u2757\u2758\u1800\u65CAnge\xBB\u2758ar\u0100;l\u2764\u2765\u4028t;\u6993\u0280achmt\u2773\u2776\u277C\u2785\u2787r\xF2\u08A8orne\xF2\u1D8Car\u0100;d\u0F98\u2783;\u696D;\u600Eri;\u62BF\u0300achiqt\u2798\u279D\u0A40\u27A2\u27AE\u27BBquo;\u6039r;\uC000\u{1D4C1}m\u0180;eg\u09B2\u27AA\u27AC;\u6A8D;\u6A8F\u0100bu\u252A\u27B3o\u0100;r\u0E1F\u27B9;\u601Arok;\u4142\u8400<;cdhilqr\u082B\u27D2\u2639\u27DC\u27E0\u27E5\u27EA\u27F0\u0100ci\u27D7\u27D9;\u6AA6r;\u6A79re\xE5\u25F2mes;\u62C9arr;\u6976uest;\u6A7B\u0100Pi\u27F5\u27F9ar;\u6996\u0180;ef\u2800\u092D\u181B\u65C3r\u0100du\u2807\u280Dshar;\u694Ahar;\u6966\u0100en\u2817\u2821rtneqq;\uC000\u2268\uFE00\xC5\u281E\u0700Dacdefhilnopsu\u2840\u2845\u2882\u288E\u2893\u28A0\u28A5\u28A8\u28DA\u28E2\u28E4\u0A83\u28F3\u2902Dot;\u623A\u0200clpr\u284E\u2852\u2863\u287Dr\u803B\xAF\u40AF\u0100et\u2857\u2859;\u6642\u0100;e\u285E\u285F\u6720se\xBB\u285F\u0100;s\u103B\u2868to\u0200;dlu\u103B\u2873\u2877\u287Bow\xEE\u048Cef\xF4\u090F\xF0\u13D1ker;\u65AE\u0100oy\u2887\u288Cmma;\u6A29;\u443Cash;\u6014asuredangle\xBB\u1626r;\uC000\u{1D52A}o;\u6127\u0180cdn\u28AF\u28B4\u28C9ro\u803B\xB5\u40B5\u0200;acd\u1464\u28BD\u28C0\u28C4s\xF4\u16A7ir;\u6AF0ot\u80BB\xB7\u01B5us\u0180;bd\u28D2\u1903\u28D3\u6212\u0100;u\u1D3C\u28D8;\u6A2A\u0163\u28DE\u28E1p;\u6ADB\xF2\u2212\xF0\u0A81\u0100dp\u28E9\u28EEels;\u62A7f;\uC000\u{1D55E}\u0100ct\u28F8\u28FDr;\uC000\u{1D4C2}pos\xBB\u159D\u0180;lm\u2909\u290A\u290D\u43BCtimap;\u62B8\u0C00GLRVabcdefghijlmoprstuvw\u2942\u2953\u297E\u2989\u2998\u29DA\u29E9\u2A15\u2A1A\u2A58\u2A5D\u2A83\u2A95\u2AA4\u2AA8\u2B04\u2B07\u2B44\u2B7F\u2BAE\u2C34\u2C67\u2C7C\u2CE9\u0100gt\u2947\u294B;\uC000\u22D9\u0338\u0100;v\u2950\u0BCF\uC000\u226B\u20D2\u0180elt\u295A\u2972\u2976ft\u0100ar\u2961\u2967rrow;\u61CDightarrow;\u61CE;\uC000\u22D8\u0338\u0100;v\u297B\u0C47\uC000\u226A\u20D2ightarrow;\u61CF\u0100Dd\u298E\u2993ash;\u62AFash;\u62AE\u0280bcnpt\u29A3\u29A7\u29AC\u29B1\u29CCla\xBB\u02DEute;\u4144g;\uC000\u2220\u20D2\u0280;Eiop\u0D84\u29BC\u29C0\u29C5\u29C8;\uC000\u2A70\u0338d;\uC000\u224B\u0338s;\u4149ro\xF8\u0D84ur\u0100;a\u29D3\u29D4\u666El\u0100;s\u29D3\u0B38\u01F3\u29DF\0\u29E3p\u80BB\xA0\u0B37mp\u0100;e\u0BF9\u0C00\u0280aeouy\u29F4\u29FE\u2A03\u2A10\u2A13\u01F0\u29F9\0\u29FB;\u6A43on;\u4148dil;\u4146ng\u0100;d\u0D7E\u2A0Aot;\uC000\u2A6D\u0338p;\u6A42;\u443Dash;\u6013\u0380;Aadqsx\u0B92\u2A29\u2A2D\u2A3B\u2A41\u2A45\u2A50rr;\u61D7r\u0100hr\u2A33\u2A36k;\u6924\u0100;o\u13F2\u13F0ot;\uC000\u2250\u0338ui\xF6\u0B63\u0100ei\u2A4A\u2A4Ear;\u6928\xED\u0B98ist\u0100;s\u0BA0\u0B9Fr;\uC000\u{1D52B}\u0200Eest\u0BC5\u2A66\u2A79\u2A7C\u0180;qs\u0BBC\u2A6D\u0BE1\u0180;qs\u0BBC\u0BC5\u2A74lan\xF4\u0BE2i\xED\u0BEA\u0100;r\u0BB6\u2A81\xBB\u0BB7\u0180Aap\u2A8A\u2A8D\u2A91r\xF2\u2971rr;\u61AEar;\u6AF2\u0180;sv\u0F8D\u2A9C\u0F8C\u0100;d\u2AA1\u2AA2\u62FC;\u62FAcy;\u445A\u0380AEadest\u2AB7\u2ABA\u2ABE\u2AC2\u2AC5\u2AF6\u2AF9r\xF2\u2966;\uC000\u2266\u0338rr;\u619Ar;\u6025\u0200;fqs\u0C3B\u2ACE\u2AE3\u2AEFt\u0100ar\u2AD4\u2AD9rro\xF7\u2AC1ightarro\xF7\u2A90\u0180;qs\u0C3B\u2ABA\u2AEAlan\xF4\u0C55\u0100;s\u0C55\u2AF4\xBB\u0C36i\xED\u0C5D\u0100;r\u0C35\u2AFEi\u0100;e\u0C1A\u0C25i\xE4\u0D90\u0100pt\u2B0C\u2B11f;\uC000\u{1D55F}\u8180\xAC;in\u2B19\u2B1A\u2B36\u40ACn\u0200;Edv\u0B89\u2B24\u2B28\u2B2E;\uC000\u22F9\u0338ot;\uC000\u22F5\u0338\u01E1\u0B89\u2B33\u2B35;\u62F7;\u62F6i\u0100;v\u0CB8\u2B3C\u01E1\u0CB8\u2B41\u2B43;\u62FE;\u62FD\u0180aor\u2B4B\u2B63\u2B69r\u0200;ast\u0B7B\u2B55\u2B5A\u2B5Flle\xEC\u0B7Bl;\uC000\u2AFD\u20E5;\uC000\u2202\u0338lint;\u6A14\u0180;ce\u0C92\u2B70\u2B73u\xE5\u0CA5\u0100;c\u0C98\u2B78\u0100;e\u0C92\u2B7D\xF1\u0C98\u0200Aait\u2B88\u2B8B\u2B9D\u2BA7r\xF2\u2988rr\u0180;cw\u2B94\u2B95\u2B99\u619B;\uC000\u2933\u0338;\uC000\u219D\u0338ghtarrow\xBB\u2B95ri\u0100;e\u0CCB\u0CD6\u0380chimpqu\u2BBD\u2BCD\u2BD9\u2B04\u0B78\u2BE4\u2BEF\u0200;cer\u0D32\u2BC6\u0D37\u2BC9u\xE5\u0D45;\uC000\u{1D4C3}ort\u026D\u2B05\0\0\u2BD6ar\xE1\u2B56m\u0100;e\u0D6E\u2BDF\u0100;q\u0D74\u0D73su\u0100bp\u2BEB\u2BED\xE5\u0CF8\xE5\u0D0B\u0180bcp\u2BF6\u2C11\u2C19\u0200;Ees\u2BFF\u2C00\u0D22\u2C04\u6284;\uC000\u2AC5\u0338et\u0100;e\u0D1B\u2C0Bq\u0100;q\u0D23\u2C00c\u0100;e\u0D32\u2C17\xF1\u0D38\u0200;Ees\u2C22\u2C23\u0D5F\u2C27\u6285;\uC000\u2AC6\u0338et\u0100;e\u0D58\u2C2Eq\u0100;q\u0D60\u2C23\u0200gilr\u2C3D\u2C3F\u2C45\u2C47\xEC\u0BD7lde\u803B\xF1\u40F1\xE7\u0C43iangle\u0100lr\u2C52\u2C5Ceft\u0100;e\u0C1A\u2C5A\xF1\u0C26ight\u0100;e\u0CCB\u2C65\xF1\u0CD7\u0100;m\u2C6C\u2C6D\u43BD\u0180;es\u2C74\u2C75\u2C79\u4023ro;\u6116p;\u6007\u0480DHadgilrs\u2C8F\u2C94\u2C99\u2C9E\u2CA3\u2CB0\u2CB6\u2CD3\u2CE3ash;\u62ADarr;\u6904p;\uC000\u224D\u20D2ash;\u62AC\u0100et\u2CA8\u2CAC;\uC000\u2265\u20D2;\uC000>\u20D2nfin;\u69DE\u0180Aet\u2CBD\u2CC1\u2CC5rr;\u6902;\uC000\u2264\u20D2\u0100;r\u2CCA\u2CCD\uC000<\u20D2ie;\uC000\u22B4\u20D2\u0100At\u2CD8\u2CDCrr;\u6903rie;\uC000\u22B5\u20D2im;\uC000\u223C\u20D2\u0180Aan\u2CF0\u2CF4\u2D02rr;\u61D6r\u0100hr\u2CFA\u2CFDk;\u6923\u0100;o\u13E7\u13E5ear;\u6927\u1253\u1A95\0\0\0\0\0\0\0\0\0\0\0\0\0\u2D2D\0\u2D38\u2D48\u2D60\u2D65\u2D72\u2D84\u1B07\0\0\u2D8D\u2DAB\0\u2DC8\u2DCE\0\u2DDC\u2E19\u2E2B\u2E3E\u2E43\u0100cs\u2D31\u1A97ute\u803B\xF3\u40F3\u0100iy\u2D3C\u2D45r\u0100;c\u1A9E\u2D42\u803B\xF4\u40F4;\u443E\u0280abios\u1AA0\u2D52\u2D57\u01C8\u2D5Alac;\u4151v;\u6A38old;\u69BClig;\u4153\u0100cr\u2D69\u2D6Dir;\u69BF;\uC000\u{1D52C}\u036F\u2D79\0\0\u2D7C\0\u2D82n;\u42DBave\u803B\xF2\u40F2;\u69C1\u0100bm\u2D88\u0DF4ar;\u69B5\u0200acit\u2D95\u2D98\u2DA5\u2DA8r\xF2\u1A80\u0100ir\u2D9D\u2DA0r;\u69BEoss;\u69BBn\xE5\u0E52;\u69C0\u0180aei\u2DB1\u2DB5\u2DB9cr;\u414Dga;\u43C9\u0180cdn\u2DC0\u2DC5\u01CDron;\u43BF;\u69B6pf;\uC000\u{1D560}\u0180ael\u2DD4\u2DD7\u01D2r;\u69B7rp;\u69B9\u0380;adiosv\u2DEA\u2DEB\u2DEE\u2E08\u2E0D\u2E10\u2E16\u6228r\xF2\u1A86\u0200;efm\u2DF7\u2DF8\u2E02\u2E05\u6A5Dr\u0100;o\u2DFE\u2DFF\u6134f\xBB\u2DFF\u803B\xAA\u40AA\u803B\xBA\u40BAgof;\u62B6r;\u6A56lope;\u6A57;\u6A5B\u0180clo\u2E1F\u2E21\u2E27\xF2\u2E01ash\u803B\xF8\u40F8l;\u6298i\u016C\u2E2F\u2E34de\u803B\xF5\u40F5es\u0100;a\u01DB\u2E3As;\u6A36ml\u803B\xF6\u40F6bar;\u633D\u0AE1\u2E5E\0\u2E7D\0\u2E80\u2E9D\0\u2EA2\u2EB9\0\0\u2ECB\u0E9C\0\u2F13\0\0\u2F2B\u2FBC\0\u2FC8r\u0200;ast\u0403\u2E67\u2E72\u0E85\u8100\xB6;l\u2E6D\u2E6E\u40B6le\xEC\u0403\u0269\u2E78\0\0\u2E7Bm;\u6AF3;\u6AFDy;\u443Fr\u0280cimpt\u2E8B\u2E8F\u2E93\u1865\u2E97nt;\u4025od;\u402Eil;\u6030enk;\u6031r;\uC000\u{1D52D}\u0180imo\u2EA8\u2EB0\u2EB4\u0100;v\u2EAD\u2EAE\u43C6;\u43D5ma\xF4\u0A76ne;\u660E\u0180;tv\u2EBF\u2EC0\u2EC8\u43C0chfork\xBB\u1FFD;\u43D6\u0100au\u2ECF\u2EDFn\u0100ck\u2ED5\u2EDDk\u0100;h\u21F4\u2EDB;\u610E\xF6\u21F4s\u0480;abcdemst\u2EF3\u2EF4\u1908\u2EF9\u2EFD\u2F04\u2F06\u2F0A\u2F0E\u402Bcir;\u6A23ir;\u6A22\u0100ou\u1D40\u2F02;\u6A25;\u6A72n\u80BB\xB1\u0E9Dim;\u6A26wo;\u6A27\u0180ipu\u2F19\u2F20\u2F25ntint;\u6A15f;\uC000\u{1D561}nd\u803B\xA3\u40A3\u0500;Eaceinosu\u0EC8\u2F3F\u2F41\u2F44\u2F47\u2F81\u2F89\u2F92\u2F7E\u2FB6;\u6AB3p;\u6AB7u\xE5\u0ED9\u0100;c\u0ECE\u2F4C\u0300;acens\u0EC8\u2F59\u2F5F\u2F66\u2F68\u2F7Eppro\xF8\u2F43urlye\xF1\u0ED9\xF1\u0ECE\u0180aes\u2F6F\u2F76\u2F7Approx;\u6AB9qq;\u6AB5im;\u62E8i\xED\u0EDFme\u0100;s\u2F88\u0EAE\u6032\u0180Eas\u2F78\u2F90\u2F7A\xF0\u2F75\u0180dfp\u0EEC\u2F99\u2FAF\u0180als\u2FA0\u2FA5\u2FAAlar;\u632Eine;\u6312urf;\u6313\u0100;t\u0EFB\u2FB4\xEF\u0EFBrel;\u62B0\u0100ci\u2FC0\u2FC5r;\uC000\u{1D4C5};\u43C8ncsp;\u6008\u0300fiopsu\u2FDA\u22E2\u2FDF\u2FE5\u2FEB\u2FF1r;\uC000\u{1D52E}pf;\uC000\u{1D562}rime;\u6057cr;\uC000\u{1D4C6}\u0180aeo\u2FF8\u3009\u3013t\u0100ei\u2FFE\u3005rnion\xF3\u06B0nt;\u6A16st\u0100;e\u3010\u3011\u403F\xF1\u1F19\xF4\u0F14\u0A80ABHabcdefhilmnoprstux\u3040\u3051\u3055\u3059\u30E0\u310E\u312B\u3147\u3162\u3172\u318E\u3206\u3215\u3224\u3229\u3258\u326E\u3272\u3290\u32B0\u32B7\u0180art\u3047\u304A\u304Cr\xF2\u10B3\xF2\u03DDail;\u691Car\xF2\u1C65ar;\u6964\u0380cdenqrt\u3068\u3075\u3078\u307F\u308F\u3094\u30CC\u0100eu\u306D\u3071;\uC000\u223D\u0331te;\u4155i\xE3\u116Emptyv;\u69B3g\u0200;del\u0FD1\u3089\u308B\u308D;\u6992;\u69A5\xE5\u0FD1uo\u803B\xBB\u40BBr\u0580;abcfhlpstw\u0FDC\u30AC\u30AF\u30B7\u30B9\u30BC\u30BE\u30C0\u30C3\u30C7\u30CAp;\u6975\u0100;f\u0FE0\u30B4s;\u6920;\u6933s;\u691E\xEB\u225D\xF0\u272El;\u6945im;\u6974l;\u61A3;\u619D\u0100ai\u30D1\u30D5il;\u691Ao\u0100;n\u30DB\u30DC\u6236al\xF3\u0F1E\u0180abr\u30E7\u30EA\u30EEr\xF2\u17E5rk;\u6773\u0100ak\u30F3\u30FDc\u0100ek\u30F9\u30FB;\u407D;\u405D\u0100es\u3102\u3104;\u698Cl\u0100du\u310A\u310C;\u698E;\u6990\u0200aeuy\u3117\u311C\u3127\u3129ron;\u4159\u0100di\u3121\u3125il;\u4157\xEC\u0FF2\xE2\u30FA;\u4440\u0200clqs\u3134\u3137\u313D\u3144a;\u6937dhar;\u6969uo\u0100;r\u020E\u020Dh;\u61B3\u0180acg\u314E\u315F\u0F44l\u0200;ips\u0F78\u3158\u315B\u109Cn\xE5\u10BBar\xF4\u0FA9t;\u65AD\u0180ilr\u3169\u1023\u316Esht;\u697D;\uC000\u{1D52F}\u0100ao\u3177\u3186r\u0100du\u317D\u317F\xBB\u047B\u0100;l\u1091\u3184;\u696C\u0100;v\u318B\u318C\u43C1;\u43F1\u0180gns\u3195\u31F9\u31FCht\u0300ahlrst\u31A4\u31B0\u31C2\u31D8\u31E4\u31EErrow\u0100;t\u0FDC\u31ADa\xE9\u30C8arpoon\u0100du\u31BB\u31BFow\xEE\u317Ep\xBB\u1092eft\u0100ah\u31CA\u31D0rrow\xF3\u0FEAarpoon\xF3\u0551ightarrows;\u61C9quigarro\xF7\u30CBhreetimes;\u62CCg;\u42DAingdotse\xF1\u1F32\u0180ahm\u320D\u3210\u3213r\xF2\u0FEAa\xF2\u0551;\u600Foust\u0100;a\u321E\u321F\u63B1che\xBB\u321Fmid;\u6AEE\u0200abpt\u3232\u323D\u3240\u3252\u0100nr\u3237\u323Ag;\u67EDr;\u61FEr\xEB\u1003\u0180afl\u3247\u324A\u324Er;\u6986;\uC000\u{1D563}us;\u6A2Eimes;\u6A35\u0100ap\u325D\u3267r\u0100;g\u3263\u3264\u4029t;\u6994olint;\u6A12ar\xF2\u31E3\u0200achq\u327B\u3280\u10BC\u3285quo;\u603Ar;\uC000\u{1D4C7}\u0100bu\u30FB\u328Ao\u0100;r\u0214\u0213\u0180hir\u3297\u329B\u32A0re\xE5\u31F8mes;\u62CAi\u0200;efl\u32AA\u1059\u1821\u32AB\u65B9tri;\u69CEluhar;\u6968;\u611E\u0D61\u32D5\u32DB\u32DF\u332C\u3338\u3371\0\u337A\u33A4\0\0\u33EC\u33F0\0\u3428\u3448\u345A\u34AD\u34B1\u34CA\u34F1\0\u3616\0\0\u3633cute;\u415Bqu\xEF\u27BA\u0500;Eaceinpsy\u11ED\u32F3\u32F5\u32FF\u3302\u330B\u330F\u331F\u3326\u3329;\u6AB4\u01F0\u32FA\0\u32FC;\u6AB8on;\u4161u\xE5\u11FE\u0100;d\u11F3\u3307il;\u415Frc;\u415D\u0180Eas\u3316\u3318\u331B;\u6AB6p;\u6ABAim;\u62E9olint;\u6A13i\xED\u1204;\u4441ot\u0180;be\u3334\u1D47\u3335\u62C5;\u6A66\u0380Aacmstx\u3346\u334A\u3357\u335B\u335E\u3363\u336Drr;\u61D8r\u0100hr\u3350\u3352\xEB\u2228\u0100;o\u0A36\u0A34t\u803B\xA7\u40A7i;\u403Bwar;\u6929m\u0100in\u3369\xF0nu\xF3\xF1t;\u6736r\u0100;o\u3376\u2055\uC000\u{1D530}\u0200acoy\u3382\u3386\u3391\u33A0rp;\u666F\u0100hy\u338B\u338Fcy;\u4449;\u4448rt\u026D\u3399\0\0\u339Ci\xE4\u1464ara\xEC\u2E6F\u803B\xAD\u40AD\u0100gm\u33A8\u33B4ma\u0180;fv\u33B1\u33B2\u33B2\u43C3;\u43C2\u0400;deglnpr\u12AB\u33C5\u33C9\u33CE\u33D6\u33DE\u33E1\u33E6ot;\u6A6A\u0100;q\u12B1\u12B0\u0100;E\u33D3\u33D4\u6A9E;\u6AA0\u0100;E\u33DB\u33DC\u6A9D;\u6A9Fe;\u6246lus;\u6A24arr;\u6972ar\xF2\u113D\u0200aeit\u33F8\u3408\u340F\u3417\u0100ls\u33FD\u3404lsetm\xE9\u336Ahp;\u6A33parsl;\u69E4\u0100dl\u1463\u3414e;\u6323\u0100;e\u341C\u341D\u6AAA\u0100;s\u3422\u3423\u6AAC;\uC000\u2AAC\uFE00\u0180flp\u342E\u3433\u3442tcy;\u444C\u0100;b\u3438\u3439\u402F\u0100;a\u343E\u343F\u69C4r;\u633Ff;\uC000\u{1D564}a\u0100dr\u344D\u0402es\u0100;u\u3454\u3455\u6660it\xBB\u3455\u0180csu\u3460\u3479\u349F\u0100au\u3465\u346Fp\u0100;s\u1188\u346B;\uC000\u2293\uFE00p\u0100;s\u11B4\u3475;\uC000\u2294\uFE00u\u0100bp\u347F\u348F\u0180;es\u1197\u119C\u3486et\u0100;e\u1197\u348D\xF1\u119D\u0180;es\u11A8\u11AD\u3496et\u0100;e\u11A8\u349D\xF1\u11AE\u0180;af\u117B\u34A6\u05B0r\u0165\u34AB\u05B1\xBB\u117Car\xF2\u1148\u0200cemt\u34B9\u34BE\u34C2\u34C5r;\uC000\u{1D4C8}tm\xEE\xF1i\xEC\u3415ar\xE6\u11BE\u0100ar\u34CE\u34D5r\u0100;f\u34D4\u17BF\u6606\u0100an\u34DA\u34EDight\u0100ep\u34E3\u34EApsilo\xEE\u1EE0h\xE9\u2EAFs\xBB\u2852\u0280bcmnp\u34FB\u355E\u1209\u358B\u358E\u0480;Edemnprs\u350E\u350F\u3511\u3515\u351E\u3523\u352C\u3531\u3536\u6282;\u6AC5ot;\u6ABD\u0100;d\u11DA\u351Aot;\u6AC3ult;\u6AC1\u0100Ee\u3528\u352A;\u6ACB;\u628Alus;\u6ABFarr;\u6979\u0180eiu\u353D\u3552\u3555t\u0180;en\u350E\u3545\u354Bq\u0100;q\u11DA\u350Feq\u0100;q\u352B\u3528m;\u6AC7\u0100bp\u355A\u355C;\u6AD5;\u6AD3c\u0300;acens\u11ED\u356C\u3572\u3579\u357B\u3326ppro\xF8\u32FAurlye\xF1\u11FE\xF1\u11F3\u0180aes\u3582\u3588\u331Bppro\xF8\u331Aq\xF1\u3317g;\u666A\u0680123;Edehlmnps\u35A9\u35AC\u35AF\u121C\u35B2\u35B4\u35C0\u35C9\u35D5\u35DA\u35DF\u35E8\u35ED\u803B\xB9\u40B9\u803B\xB2\u40B2\u803B\xB3\u40B3;\u6AC6\u0100os\u35B9\u35BCt;\u6ABEub;\u6AD8\u0100;d\u1222\u35C5ot;\u6AC4s\u0100ou\u35CF\u35D2l;\u67C9b;\u6AD7arr;\u697Bult;\u6AC2\u0100Ee\u35E4\u35E6;\u6ACC;\u628Blus;\u6AC0\u0180eiu\u35F4\u3609\u360Ct\u0180;en\u121C\u35FC\u3602q\u0100;q\u1222\u35B2eq\u0100;q\u35E7\u35E4m;\u6AC8\u0100bp\u3611\u3613;\u6AD4;\u6AD6\u0180Aan\u361C\u3620\u362Drr;\u61D9r\u0100hr\u3626\u3628\xEB\u222E\u0100;o\u0A2B\u0A29war;\u692Alig\u803B\xDF\u40DF\u0BE1\u3651\u365D\u3660\u12CE\u3673\u3679\0\u367E\u36C2\0\0\0\0\0\u36DB\u3703\0\u3709\u376C\0\0\0\u3787\u0272\u3656\0\0\u365Bget;\u6316;\u43C4r\xEB\u0E5F\u0180aey\u3666\u366B\u3670ron;\u4165dil;\u4163;\u4442lrec;\u6315r;\uC000\u{1D531}\u0200eiko\u3686\u369D\u36B5\u36BC\u01F2\u368B\0\u3691e\u01004f\u1284\u1281a\u0180;sv\u3698\u3699\u369B\u43B8ym;\u43D1\u0100cn\u36A2\u36B2k\u0100as\u36A8\u36AEppro\xF8\u12C1im\xBB\u12ACs\xF0\u129E\u0100as\u36BA\u36AE\xF0\u12C1rn\u803B\xFE\u40FE\u01EC\u031F\u36C6\u22E7es\u8180\xD7;bd\u36CF\u36D0\u36D8\u40D7\u0100;a\u190F\u36D5r;\u6A31;\u6A30\u0180eps\u36E1\u36E3\u3700\xE1\u2A4D\u0200;bcf\u0486\u36EC\u36F0\u36F4ot;\u6336ir;\u6AF1\u0100;o\u36F9\u36FC\uC000\u{1D565}rk;\u6ADA\xE1\u3362rime;\u6034\u0180aip\u370F\u3712\u3764d\xE5\u1248\u0380adempst\u3721\u374D\u3740\u3751\u3757\u375C\u375Fngle\u0280;dlqr\u3730\u3731\u3736\u3740\u3742\u65B5own\xBB\u1DBBeft\u0100;e\u2800\u373E\xF1\u092E;\u625Cight\u0100;e\u32AA\u374B\xF1\u105Aot;\u65ECinus;\u6A3Alus;\u6A39b;\u69CDime;\u6A3Bezium;\u63E2\u0180cht\u3772\u377D\u3781\u0100ry\u3777\u377B;\uC000\u{1D4C9};\u4446cy;\u445Brok;\u4167\u0100io\u378B\u378Ex\xF4\u1777head\u0100lr\u3797\u37A0eftarro\xF7\u084Fightarrow\xBB\u0F5D\u0900AHabcdfghlmoprstuw\u37D0\u37D3\u37D7\u37E4\u37F0\u37FC\u380E\u381C\u3823\u3834\u3851\u385D\u386B\u38A9\u38CC\u38D2\u38EA\u38F6r\xF2\u03EDar;\u6963\u0100cr\u37DC\u37E2ute\u803B\xFA\u40FA\xF2\u1150r\u01E3\u37EA\0\u37EDy;\u445Eve;\u416D\u0100iy\u37F5\u37FArc\u803B\xFB\u40FB;\u4443\u0180abh\u3803\u3806\u380Br\xF2\u13ADlac;\u4171a\xF2\u13C3\u0100ir\u3813\u3818sht;\u697E;\uC000\u{1D532}rave\u803B\xF9\u40F9\u0161\u3827\u3831r\u0100lr\u382C\u382E\xBB\u0957\xBB\u1083lk;\u6580\u0100ct\u3839\u384D\u026F\u383F\0\0\u384Arn\u0100;e\u3845\u3846\u631Cr\xBB\u3846op;\u630Fri;\u65F8\u0100al\u3856\u385Acr;\u416B\u80BB\xA8\u0349\u0100gp\u3862\u3866on;\u4173f;\uC000\u{1D566}\u0300adhlsu\u114B\u3878\u387D\u1372\u3891\u38A0own\xE1\u13B3arpoon\u0100lr\u3888\u388Cef\xF4\u382Digh\xF4\u382Fi\u0180;hl\u3899\u389A\u389C\u43C5\xBB\u13FAon\xBB\u389Aparrows;\u61C8\u0180cit\u38B0\u38C4\u38C8\u026F\u38B6\0\0\u38C1rn\u0100;e\u38BC\u38BD\u631Dr\xBB\u38BDop;\u630Eng;\u416Fri;\u65F9cr;\uC000\u{1D4CA}\u0180dir\u38D9\u38DD\u38E2ot;\u62F0lde;\u4169i\u0100;f\u3730\u38E8\xBB\u1813\u0100am\u38EF\u38F2r\xF2\u38A8l\u803B\xFC\u40FCangle;\u69A7\u0780ABDacdeflnoprsz\u391C\u391F\u3929\u392D\u39B5\u39B8\u39BD\u39DF\u39E4\u39E8\u39F3\u39F9\u39FD\u3A01\u3A20r\xF2\u03F7ar\u0100;v\u3926\u3927\u6AE8;\u6AE9as\xE8\u03E1\u0100nr\u3932\u3937grt;\u699C\u0380eknprst\u34E3\u3946\u394B\u3952\u395D\u3964\u3996app\xE1\u2415othin\xE7\u1E96\u0180hir\u34EB\u2EC8\u3959op\xF4\u2FB5\u0100;h\u13B7\u3962\xEF\u318D\u0100iu\u3969\u396Dgm\xE1\u33B3\u0100bp\u3972\u3984setneq\u0100;q\u397D\u3980\uC000\u228A\uFE00;\uC000\u2ACB\uFE00setneq\u0100;q\u398F\u3992\uC000\u228B\uFE00;\uC000\u2ACC\uFE00\u0100hr\u399B\u399Fet\xE1\u369Ciangle\u0100lr\u39AA\u39AFeft\xBB\u0925ight\xBB\u1051y;\u4432ash\xBB\u1036\u0180elr\u39C4\u39D2\u39D7\u0180;be\u2DEA\u39CB\u39CFar;\u62BBq;\u625Alip;\u62EE\u0100bt\u39DC\u1468a\xF2\u1469r;\uC000\u{1D533}tr\xE9\u39AEsu\u0100bp\u39EF\u39F1\xBB\u0D1C\xBB\u0D59pf;\uC000\u{1D567}ro\xF0\u0EFBtr\xE9\u39B4\u0100cu\u3A06\u3A0Br;\uC000\u{1D4CB}\u0100bp\u3A10\u3A18n\u0100Ee\u3980\u3A16\xBB\u397En\u0100Ee\u3992\u3A1E\xBB\u3990igzag;\u699A\u0380cefoprs\u3A36\u3A3B\u3A56\u3A5B\u3A54\u3A61\u3A6Airc;\u4175\u0100di\u3A40\u3A51\u0100bg\u3A45\u3A49ar;\u6A5Fe\u0100;q\u15FA\u3A4F;\u6259erp;\u6118r;\uC000\u{1D534}pf;\uC000\u{1D568}\u0100;e\u1479\u3A66at\xE8\u1479cr;\uC000\u{1D4CC}\u0AE3\u178E\u3A87\0\u3A8B\0\u3A90\u3A9B\0\0\u3A9D\u3AA8\u3AAB\u3AAF\0\0\u3AC3\u3ACE\0\u3AD8\u17DC\u17DFtr\xE9\u17D1r;\uC000\u{1D535}\u0100Aa\u3A94\u3A97r\xF2\u03C3r\xF2\u09F6;\u43BE\u0100Aa\u3AA1\u3AA4r\xF2\u03B8r\xF2\u09EBa\xF0\u2713is;\u62FB\u0180dpt\u17A4\u3AB5\u3ABE\u0100fl\u3ABA\u17A9;\uC000\u{1D569}im\xE5\u17B2\u0100Aa\u3AC7\u3ACAr\xF2\u03CEr\xF2\u0A01\u0100cq\u3AD2\u17B8r;\uC000\u{1D4CD}\u0100pt\u17D6\u3ADCr\xE9\u17D4\u0400acefiosu\u3AF0\u3AFD\u3B08\u3B0C\u3B11\u3B15\u3B1B\u3B21c\u0100uy\u3AF6\u3AFBte\u803B\xFD\u40FD;\u444F\u0100iy\u3B02\u3B06rc;\u4177;\u444Bn\u803B\xA5\u40A5r;\uC000\u{1D536}cy;\u4457pf;\uC000\u{1D56A}cr;\uC000\u{1D4CE}\u0100cm\u3B26\u3B29y;\u444El\u803B\xFF\u40FF\u0500acdefhiosw\u3B42\u3B48\u3B54\u3B58\u3B64\u3B69\u3B6D\u3B74\u3B7A\u3B80cute;\u417A\u0100ay\u3B4D\u3B52ron;\u417E;\u4437ot;\u417C\u0100et\u3B5D\u3B61tr\xE6\u155Fa;\u43B6r;\uC000\u{1D537}cy;\u4436grarr;\u61DDpf;\uC000\u{1D56B}cr;\uC000\u{1D4CF}\u0100jn\u3B85\u3B87;\u600Dj;\u600C'.split("").map(e=>e.charCodeAt(0)));var Gr=new Uint16Array("\u0200aglq	\x1B\u026D\0\0p;\u4026os;\u4027t;\u403Et;\u403Cuot;\u4022".split("").map(e=>e.charCodeAt(0)));var Nt,ao=new Map([[0,65533],[128,8364],[130,8218],[131,402],[132,8222],[133,8230],[134,8224],[135,8225],[136,710],[137,8240],[138,352],[139,8249],[140,338],[142,381],[145,8216],[146,8217],[147,8220],[148,8221],[149,8226],[150,8211],[151,8212],[152,732],[153,8482],[154,353],[155,8250],[156,339],[158,382],[159,376]]),Ft=(Nt=String.fromCodePoint)!==null&&Nt!==void 0?Nt:function(e){let t="";return e>65535&&(e-=65536,t+=String.fromCharCode(e>>>10&1023|55296),e=56320|e&1023),t+=String.fromCharCode(e),t};function Bt(e){var t;return e>=55296&&e<=57343||e>1114111?65533:(t=ao.get(e))!==null&&t!==void 0?t:e}var te;(function(e){e[e.NUM=35]="NUM",e[e.SEMI=59]="SEMI",e[e.EQUALS=61]="EQUALS",e[e.ZERO=48]="ZERO",e[e.NINE=57]="NINE",e[e.LOWER_A=97]="LOWER_A",e[e.LOWER_F=102]="LOWER_F",e[e.LOWER_X=120]="LOWER_X",e[e.LOWER_Z=122]="LOWER_Z",e[e.UPPER_A=65]="UPPER_A",e[e.UPPER_F=70]="UPPER_F",e[e.UPPER_Z=90]="UPPER_Z"})(te||(te={}));var no=32,Te;(function(e){e[e.VALUE_LENGTH=49152]="VALUE_LENGTH",e[e.BRANCH_LENGTH=16256]="BRANCH_LENGTH",e[e.JUMP_TABLE=127]="JUMP_TABLE"})(Te||(Te={}));function qt(e){return e>=te.ZERO&&e<=te.NINE}function io(e){return e>=te.UPPER_A&&e<=te.UPPER_F||e>=te.LOWER_A&&e<=te.LOWER_F}function oo(e){return e>=te.UPPER_A&&e<=te.UPPER_Z||e>=te.LOWER_A&&e<=te.LOWER_Z||qt(e)}function so(e){return e===te.EQUALS||oo(e)}var ee;(function(e){e[e.EntityStart=0]="EntityStart",e[e.NumericStart=1]="NumericStart",e[e.NumericDecimal=2]="NumericDecimal",e[e.NumericHex=3]="NumericHex",e[e.NamedEntity=4]="NamedEntity"})(ee||(ee={}));var Pe;(function(e){e[e.Legacy=0]="Legacy",e[e.Strict=1]="Strict",e[e.Attribute=2]="Attribute"})(Pe||(Pe={}));var zt=class{constructor(t,r,a){this.decodeTree=t,this.emitCodePoint=r,this.errors=a,this.state=ee.EntityStart,this.consumed=1,this.result=0,this.treeIndex=0,this.excess=1,this.decodeMode=Pe.Strict}startEntity(t){this.decodeMode=t,this.state=ee.EntityStart,this.result=0,this.treeIndex=0,this.excess=1,this.consumed=1}write(t,r){switch(this.state){case ee.EntityStart:return t.charCodeAt(r)===te.NUM?(this.state=ee.NumericStart,this.consumed+=1,this.stateNumericStart(t,r+1)):(this.state=ee.NamedEntity,this.stateNamedEntity(t,r));case ee.NumericStart:return this.stateNumericStart(t,r);case ee.NumericDecimal:return this.stateNumericDecimal(t,r);case ee.NumericHex:return this.stateNumericHex(t,r);case ee.NamedEntity:return this.stateNamedEntity(t,r)}}stateNumericStart(t,r){return r>=t.length?-1:(t.charCodeAt(r)|no)===te.LOWER_X?(this.state=ee.NumericHex,this.consumed+=1,this.stateNumericHex(t,r+1)):(this.state=ee.NumericDecimal,this.stateNumericDecimal(t,r))}addToNumericResult(t,r,a,i){if(r!==a){let n=a-r;this.result=this.result*Math.pow(i,n)+parseInt(t.substr(r,n),i),this.consumed+=n}}stateNumericHex(t,r){let a=r;for(;r<t.length;){let i=t.charCodeAt(r);if(qt(i)||io(i))r+=1;else return this.addToNumericResult(t,a,r,16),this.emitNumericEntity(i,3)}return this.addToNumericResult(t,a,r,16),-1}stateNumericDecimal(t,r){let a=r;for(;r<t.length;){let i=t.charCodeAt(r);if(qt(i))r+=1;else return this.addToNumericResult(t,a,r,10),this.emitNumericEntity(i,2)}return this.addToNumericResult(t,a,r,10),-1}emitNumericEntity(t,r){var a;if(this.consumed<=r)return(a=this.errors)===null||a===void 0||a.absenceOfDigitsInNumericCharacterReference(this.consumed),0;if(t===te.SEMI)this.consumed+=1;else if(this.decodeMode===Pe.Strict)return 0;return this.emitCodePoint(Bt(this.result),this.consumed),this.errors&&(t!==te.SEMI&&this.errors.missingSemicolonAfterCharacterReference(),this.errors.validateNumericCharacterReference(this.result)),this.consumed}stateNamedEntity(t,r){let{decodeTree:a}=this,i=a[this.treeIndex],n=(i&Te.VALUE_LENGTH)>>14;for(;r<t.length;r++,this.excess++){let o=t.charCodeAt(r);if(this.treeIndex=lo(a,i,this.treeIndex+Math.max(1,n),o),this.treeIndex<0)return this.result===0||this.decodeMode===Pe.Attribute&&(n===0||so(o))?0:this.emitNotTerminatedNamedEntity();if(i=a[this.treeIndex],n=(i&Te.VALUE_LENGTH)>>14,n!==0){if(o===te.SEMI)return this.emitNamedEntityData(this.treeIndex,n,this.consumed+this.excess);this.decodeMode!==Pe.Strict&&(this.result=this.treeIndex,this.consumed+=this.excess,this.excess=0)}}return-1}emitNotTerminatedNamedEntity(){var t;let{result:r,decodeTree:a}=this,i=(a[r]&Te.VALUE_LENGTH)>>14;return this.emitNamedEntityData(r,i,this.consumed),(t=this.errors)===null||t===void 0||t.missingSemicolonAfterCharacterReference(),this.consumed}emitNamedEntityData(t,r,a){let{decodeTree:i}=this;return this.emitCodePoint(r===1?i[t]&~Te.VALUE_LENGTH:i[t+1],a),r===3&&this.emitCodePoint(i[t+2],a),a}end(){var t;switch(this.state){case ee.NamedEntity:return this.result!==0&&(this.decodeMode!==Pe.Attribute||this.result===this.treeIndex)?this.emitNotTerminatedNamedEntity():0;case ee.NumericDecimal:return this.emitNumericEntity(0,2);case ee.NumericHex:return this.emitNumericEntity(0,3);case ee.NumericStart:return(t=this.errors)===null||t===void 0||t.absenceOfDigitsInNumericCharacterReference(this.consumed),0;case ee.EntityStart:return 0}}};function Kr(e){let t="",r=new zt(e,a=>t+=Ft(a));return function(i,n){let o=0,c=0;for(;(c=i.indexOf("&",c))>=0;){t+=i.slice(o,c),r.startEntity(n);let m=r.write(i,c+1);if(m<0){o=c+r.end();break}o=c+m,c=m===0?o+1:o}let f=t+i.slice(o);return t="",f}}function lo(e,t,r,a){let i=(t&Te.BRANCH_LENGTH)>>7,n=t&Te.JUMP_TABLE;if(i===0)return n!==0&&a===n?r:-1;if(n){let f=a-n;return f<0||f>=i?-1:e[r+f]-1}let o=r,c=o+i-1;for(;o<=c;){let f=o+c>>>1,m=e[f];if(m<a)o=f+1;else if(m>a)c=f-1;else return e[f+i]}return-1}var co=Kr(Yr),pc=Kr(Gr);function Zr(e,t=Pe.Legacy){return co(e,t)}var xe=e=>{let t=String(e??"").trim();return t&&(/^(https?:\/\/|mailto:|tel:|#|\/|\.{1,2}\/)/i.test(t)||/^data:image\//i.test(t)||/^asset:[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(t)||/^[\w.-]+(\/|\?|#|$)/.test(t))?t:""},Xr=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),Jr={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:"\xA0",colon:":",Tab:"	",NewLine:`
`,sol:"/",lpar:"(",rpar:")",period:".",comma:",",semi:";",equals:"=",excl:"!",num:"#",quest:"?",plus:"+"},_t=e=>e.replace(/&(?:#(\d+)|#x([0-9a-f]+));?|&([A-Za-z]+);/gi,(t,r,a,i)=>{if(i)return Object.prototype.hasOwnProperty.call(Jr,i)?Jr[i]:t;let n=r?parseInt(r,10):parseInt(a,16);return n>0&&n<=1114111&&!(n>=55296&&n<=57343)?String.fromCodePoint(n):"\uFFFD"}),Qr=e=>_t(e).replace(/[\u0000- \u007f]/g,"").toLowerCase(),Oe=e=>e===" "||e==="	"||e===`
`||e==="\r"||e==="\f";function ea(e,t){let r=t+1,a="";for(;r<e.length&&!Oe(e[r])&&e[r]!=="/"&&e[r]!==">";)a+=e[r++];let i=[],n=!1;for(;r<e.length;){let o=e[r];if(Oe(o)){r++;continue}if(o===">")return{name:a,attrs:i,selfClosing:n,end:r+1};if(o==="/"){r++,n=e[r]===">";continue}n=!1;let c=e[r++];for(;r<e.length&&!Oe(e[r])&&e[r]!=="/"&&e[r]!==">"&&e[r]!=="=";)c+=e[r++];for(;r<e.length&&Oe(e[r]);)r++;if(e[r]!=="="){i.push({name:c,value:null});continue}for(r++;r<e.length&&Oe(e[r]);)r++;let f=e[r];if(f==='"'||f==="'"){let d=e.indexOf(f,r+1);if(d<0)return null;i.push({name:c,value:_t(e.slice(r+1,d))}),r=d+1;continue}let m="";for(;r<e.length&&!Oe(e[r])&&e[r]!==">";)m+=e[r++];i.push({name:c,value:_t(m)})}return null}function ta(e){let t=0,r=String(e??"").replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,()=>(t++,"")).replace(/<script\b[^>]*\/?>/gi,()=>(t++,"")),a=/<[a-z]/gi,i="",n=0;for(;;){a.lastIndex=n;let o=a.exec(r);if(!o){i+=r.slice(n);break}i+=r.slice(n,o.index);let c=ea(r,o.index);if(!c)break;if(n=c.end,c.name.toLowerCase()==="script"){t++;continue}let f=c.attrs.filter(m=>{let d=m.name.toLowerCase(),E=m.value==null?"":Qr(m.value),P=!/^[a-z_:][-a-z0-9_:.]*$/.test(d)||d.startsWith("on")||d==="srcdoc"||/(java|vb)script:/.test(E)||d==="attributename"&&E.startsWith("on");return P&&t++,!P});i+=`<${c.name}${f.map(m=>" "+m.name+(m.value==null?"":`="${Xr(m.value)}"`)).join("")}${c.selfClosing?"/":""}>`}return{html:i,stripped:t}}var uo=new Set(["p","br","h2","h3","blockquote","ul","ol","li","b","strong","i","em","u","s","strike","a","div"]),po=new Set(["script","style","textarea","option","noscript","template","title","iframe","xmp","noembed","noframes"]),fo="<!--",go=new Set(["p","div","h2","h3","ul","ol","blockquote"]),mo=e=>{let t=Qr(e);return/^(https?:|mailto:|tel:)/.test(t)?!0:!t.startsWith("//")&&!/^[^/?#]*:/.test(t)};function He(e){let t=String(e??""),r=t.toLowerCase(),a=/<\/([a-z][^\s/>]*)[^>]*>/iy,i=[],n=f=>{let m="";for(;i.length>f;)m+=`</${i.pop()}>`;return m},o="",c=0;for(;c<t.length;){let f=t.indexOf("<",c);if(f<0){o+=t.slice(c).replace(/>/g,"&gt;");break}o+=t.slice(c,f).replace(/>/g,"&gt;");let m=t[f+1]||"";if(t.startsWith(fo,f)){let w=t.indexOf("-->",f+2);c=w<0?t.length:w+3;continue}if(m==="!"||m==="?"||m==="/"&&!/[a-z]/i.test(t[f+2]||"")){let w=t.indexOf(">",f);c=w<0?t.length:w+1;continue}if(m==="/"){a.lastIndex=f;let w=a.exec(t);if(!w)break;let D=i.lastIndexOf(w[1].toLowerCase());D>=0&&(o+=n(D)),c=f+w[0].length;continue}if(!/[a-z]/i.test(m)){o+="&lt;",c=f+1;continue}let d=ea(t,f);if(!d)break;let E=d.name.toLowerCase();if(c=d.end,po.has(E)){let w=r.indexOf(`</${E}`,c),D=w<0?-1:t.indexOf(">",w);c=D<0?t.length:D+1;continue}if(!uo.has(E))continue;if(E==="br"){o+="<br>";continue}if(go.has(E)&&i.includes("p")&&(o+=n(i.lastIndexOf("p"))),E==="li"){for(let w=i.length-1;w>=0&&!["ul","ol","blockquote","h2","h3"].includes(i[w]);w--)if(i[w]==="li"){o+=n(w);break}}let P=E==="a"?d.attrs.find(w=>w.name.toLowerCase()==="href"&&w.value!=null):null;o+=P&&mo(P.value)?`<a href="${Xr(P.value)}">`:`<${E}>`,i.push(E)}return o+n(0)}function jt(e){let t=He(e).replace(/<\/?(?:p|div|h2|h3|blockquote|ul|ol|li|br)\b[^>]*>/gi," ").replace(/<[^>]*>/g,"");return Zr(t).replace(/\s+/g," ").trim()}var ho=Uint32Array.from([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]);function Ht(e){let t=new TextEncoder().encode(e),r=t.length*8,a=new Uint8Array(t.length+9+63>>6<<6);a.set(t),a[t.length]=128;let i=new DataView(a.buffer);i.setUint32(a.length-8,Math.floor(r/4294967296)),i.setUint32(a.length-4,r>>>0);let n=Uint32Array.from([1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225]),o=new Uint32Array(64),c=(f,m)=>f>>>m|f<<32-m;for(let f=0;f<a.length;f+=64){for(let F=0;F<16;F++)o[F]=i.getUint32(f+F*4);for(let F=16;F<64;F++){let V=c(o[F-15],7)^c(o[F-15],18)^o[F-15]>>>3,U=c(o[F-2],17)^c(o[F-2],19)^o[F-2]>>>10;o[F]=o[F-16]+V+o[F-7]+U>>>0}let[m,d,E,P,w,D,N,R]=n;for(let F=0;F<64;F++){let V=R+(c(w,6)^c(w,11)^c(w,25))+(w&D^~w&N)+ho[F]+o[F]>>>0,U=(c(m,2)^c(m,13)^c(m,22))+(m&d^m&E^d&E)>>>0;R=N,N=D,D=w,w=P+V>>>0,P=E,E=d,d=m,m=V+U>>>0}n[0]+=m,n[1]+=d,n[2]+=E,n[3]+=P,n[4]+=w,n[5]+=D,n[6]+=N,n[7]+=R}return Array.from(n,f=>(f>>>0).toString(16).padStart(8,"0")).join("")}var Vt=`
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
`,Wt=`
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
`;var ra='<script>\n"use strict";(()=>{var R=".pagecraft-form[data-pagecraft-controls]",W=\'<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9 6 6 6-6"/></svg>\';function F(i){var M,H;if(i.dataset.pagecraftEnhanced)return;i.dataset.pagecraftEnhanced="true",i.tabIndex=-1,i.setAttribute("aria-hidden","true");let p=document.createElement("div");p.className="pc-select";let o=document.createElement("button");o.className="pc-select-button",o.type="button",o.setAttribute("role","combobox"),o.setAttribute("aria-haspopup","listbox"),o.setAttribute("aria-expanded","false"),o.id=`${i.id||"pagecraft-select"}-button`;let y=document.createElement("span");y.className="pc-select-value";let m=document.createElement("span");m.className="pc-select-icon",m.setAttribute("aria-hidden","true"),m.innerHTML=W,o.append(y,m);let a=document.createElement("ul");a.className="pc-select-list",a.id=`${i.id||"pagecraft-select"}-listbox`,a.setAttribute("role","listbox"),a.dataset.pagecraftSelectPopover="",a.hidden=!0,o.setAttribute("aria-controls",a.id);let d=Array.from(((M=i.closest(".pagecraft-field"))==null?void 0:M.querySelectorAll("label[for]"))||[]).find(t=>t.htmlFor===i.id);d&&(d.id||(d.id=`${i.id}-label`),o.setAttribute("aria-labelledby",`${d.id} ${o.id}`),a.setAttribute("aria-labelledby",d.id)),i.before(p),p.append(i,o),document.body.append(a);let s=-1,E="",L=0,c=!1,h=()=>Array.from(i.options).map((t,e)=>({option:t,index:e})).filter(t=>!t.option.disabled),b=t=>{let e=Array.from(a.children);if(!(!e[t]||e[t].getAttribute("aria-disabled")==="true")){s=t;for(let[n,r]of e.entries())r.toggleAttribute("data-active",n===s);o.setAttribute("aria-activedescendant",e[s].id),e[s].scrollIntoView({block:"nearest"})}},l=()=>{let t=i.options[i.selectedIndex]||i.options[0];y.textContent=(t==null?void 0:t.textContent)||"",o.disabled=i.disabled,c?o.setAttribute("aria-invalid",i.validity.valid?"false":"true"):o.removeAttribute("aria-invalid"),Array.from(a.children).forEach((e,n)=>{e.setAttribute("aria-selected",String(n===i.selectedIndex))})},u=(t=!1)=>{a.hidden||(a.hidden=!0,o.setAttribute("aria-expanded","false"),o.removeAttribute("aria-activedescendant"),t&&o.focus())},x=()=>{if(a.hidden)return;let t=getComputedStyle(o);for(let N of["--f-text","--f-bg","--f-border","--f-radius","--f-pad","--f-btn-bg","--f-btn-fg","--f-label"]){let q=t.getPropertyValue(N);q&&a.style.setProperty(N,q)}a.style.font=t.font;let e=o.getBoundingClientRect(),n=12,r=6,g=window.innerWidth,w=window.innerHeight,S=Math.max(0,Math.min(e.width,g-n*2)),O=Math.max(n,Math.min(e.left,g-n-S)),A=Math.max(0,w-n-e.bottom-r),C=Math.max(0,e.top-n-r),v=Math.min(256,w/2),T=Math.min(a.scrollHeight||v,v),$=A<T&&C>A,D=$?C:A,I=Math.min(T,D),P=$?Math.max(n,e.top-r-I):Math.min(e.bottom+r,w-n-I);a.style.position="fixed",a.style.width=`${S}px`,a.style.left=`${O}px`,a.style.top=`${Math.max(n,P)}px`,a.style.maxHeight=`${Math.min(v,D)}px`},f=(t=0)=>{if(o.disabled)return;a.hidden=!1,o.setAttribute("aria-expanded","true");let e=h(),n=e.find(g=>g.index===i.selectedIndex),r=t>0?e[0]:t<0?e[e.length-1]:n||e[0];r&&b(r.index),x()},k=t=>{let e=i.options[t];if(!e||e.disabled)return;let n=i.selectedIndex!==t;i.selectedIndex=t,c=!0,l(),u(!0),n&&(i.dispatchEvent(new Event("input",{bubbles:!0})),i.dispatchEvent(new Event("change",{bubbles:!0})))},B=t=>{let e=h();if(!e.length)return;let n=Math.max(0,e.findIndex(r=>r.index===s));b(e[(n+t+e.length)%e.length].index)};Array.from(i.options).forEach((t,e)=>{let n=document.createElement("li");n.className="pc-select-option",n.id=`${a.id}-option-${e}`,n.setAttribute("role","option"),n.setAttribute("aria-disabled",String(t.disabled)),n.textContent=t.textContent,n.addEventListener("pointerdown",r=>r.preventDefault()),n.addEventListener("click",()=>k(e)),a.append(n)}),o.addEventListener("click",()=>a.hidden?f():u()),o.addEventListener("keydown",t=>{if(t.key==="Escape"){a.hidden||(t.preventDefault(),u(!0));return}if(t.key==="Tab"){u();return}if(t.key==="Enter"||t.key===" "){t.preventDefault(),a.hidden?f():k(s);return}if(t.key==="ArrowDown"||t.key==="ArrowUp"){t.preventDefault(),a.hidden?f(t.key==="ArrowDown"?1:-1):B(t.key==="ArrowDown"?1:-1);return}if(t.key==="Home"||t.key==="End"){t.preventDefault(),a.hidden&&f();let e=h(),n=t.key==="Home"?e[0]:e[e.length-1];n&&b(n.index);return}if(t.key.length===1&&/\\S/.test(t.key)){E+=t.key.toLocaleLowerCase(),window.clearTimeout(L),L=window.setTimeout(()=>{E=""},600);let e=h().find(n=>(n.option.textContent||"").trim().toLocaleLowerCase().startsWith(E));e&&(t.preventDefault(),a.hidden&&f(),b(e.index))}}),o.addEventListener("blur",()=>{c=!0,l()}),i.addEventListener("change",l),i.addEventListener("focus",()=>o.focus()),i.addEventListener("invalid",t=>{t.preventDefault(),c=!0,o.setAttribute("aria-invalid","true"),o.focus()}),document.addEventListener("pointerdown",t=>{let e=t.target;!p.contains(e)&&!a.contains(e)&&u()}),window.addEventListener("resize",x),document.addEventListener("scroll",x,!0),(H=i.form)==null||H.addEventListener("reset",()=>window.setTimeout(()=>{c=!1,l()})),l()}document.querySelectorAll(R).forEach(i=>{i.querySelectorAll("select[data-pagecraft-select]").forEach(F)});})();\n<\/script>',aa='<script>\n"use strict";(()=>{var bc=Object.defineProperty,wc=Object.defineProperties;var $c=Object.getOwnPropertyDescriptors;var $n=Object.getOwnPropertySymbols;var oa=Object.prototype.hasOwnProperty,aa=Object.prototype.propertyIsEnumerable;var xc=e=>{throw TypeError(e)};var ra=(e,t,n)=>t in e?bc(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n,R=(e,t)=>{for(var n in t||(t={}))oa.call(t,n)&&ra(e,n,t[n]);if($n)for(var n of $n(t))aa.call(t,n)&&ra(e,n,t[n]);return e},I=(e,t)=>wc(e,$c(t));var Se=(e,t)=>{var n={};for(var r in e)oa.call(e,r)&&t.indexOf(r)<0&&(n[r]=e[r]);if(e!=null&&$n)for(var r of $n(e))t.indexOf(r)<0&&aa.call(e,r)&&(n[r]=e[r]);return n};var xn=(e,t,n)=>t.has(e)?xc("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,n);var Je=(e,t=[])=>({parts:(...n)=>{if(Ec(t))return Je(e,n);throw new Error("createAnatomy().parts(...) should only be called once. Did you mean to use .extendWith(...) ?")},extendWith:(...n)=>Je(e,[...t,...n]),omit:(...n)=>Je(e,t.filter(r=>!n.includes(r))),rename:n=>Je(n,t),keys:()=>t,build:()=>[...new Set(t)].reduce((n,r)=>Object.assign(n,{[r]:{selector:[`&[data-scope="${yt(e)}"][data-part="${yt(r)}"]`,`& [data-scope="${yt(e)}"][data-part="${yt(r)}"]`].join(", "),attrs:{"data-scope":yt(e),"data-part":yt(r)}}}),{})}),yt=e=>e.replace(/([A-Z])([A-Z])/g,"$1-$2").replace(/([a-z])([A-Z])/g,"$1-$2").replace(/[\\s_]+/g,"-").toLowerCase(),Ec=e=>e.length===0;var Tc=Je("date-picker").parts("clearTrigger","content","control","input","label","monthSelect","nextTrigger","positioner","presetTrigger","prevTrigger","rangeText","root","table","tableBody","tableCell","tableCellTrigger","tableHead","tableHeader","tableRow","trigger","view","viewControl","viewTrigger","yearSelect"),Y=Tc.build();function En(e,t){return e-t*Math.floor(e/t)}var sa=1721426;function Tn(e,t,n,r){t=Dn(e,t);let o=t-1,a=-2;return n<=2?a=0:Sn(t)&&(a=-1),sa-1+365*o+Math.floor(o/4)-Math.floor(o/100)+Math.floor(o/400)+Math.floor((367*n-362)/12+a+r)}function Sn(e){return e%4===0&&(e%100!==0||e%400===0)}function Dn(e,t){return e==="BC"?1-t:t}function Sc(e){let t="AD";return e<=0&&(t="BC",e=1-e),[t,e]}var Dc={standard:[31,28,31,30,31,30,31,31,30,31,30,31],leapyear:[31,29,31,30,31,30,31,31,30,31,30,31]},ye=class{fromJulianDay(t){let n=t,r=n-sa,o=Math.floor(r/146097),a=En(r,146097),s=Math.floor(a/36524),i=En(a,36524),c=Math.floor(i/1461),u=En(i,1461),f=Math.floor(u/365),h=o*400+s*100+c*4+f+(s!==4&&f!==4?1:0),[p,g]=Sc(h),d=n-Tn(p,g,1,1),l=2;n<Tn(p,g,3,1)?l=0:Sn(g)&&(l=1);let b=Math.floor(((d+l)*12+373)/367),y=n-Tn(p,g,b,1)+1;return new te(p,g,b,y)}toJulianDay(t){return Tn(t.era,t.year,t.month,t.day)}getDaysInMonth(t){return Dc[Sn(t.year)?"leapyear":"standard"][t.month-1]}getMonthsInYear(t){return 12}getDaysInYear(t){return Sn(t.year)?366:365}getMaximumMonthsInYear(){return 12}getMaximumDaysInMonth(){return 31}getYearsInEra(t){return 9999}getEras(){return["BC","AD"]}isInverseEra(t){return t.era==="BC"}balanceDate(t){t.year<=0&&(t.era=t.era==="BC"?"AD":"BC",t.year=1-t.year)}constructor(){this.identifier="gregory"}};var ia={"001":1,AD:1,AE:6,AF:6,AI:1,AL:1,AM:1,AN:1,AR:1,AT:1,AU:1,AX:1,AZ:1,BA:1,BE:1,BG:1,BH:6,BM:1,BN:1,BY:1,CH:1,CL:1,CM:1,CN:1,CR:1,CY:1,CZ:1,DE:1,DJ:6,DK:1,DZ:6,EC:1,EE:1,EG:6,ES:1,FI:1,FJ:1,FO:1,FR:1,GB:1,GE:1,GF:1,GP:1,GR:1,HR:1,HU:1,IE:1,IQ:6,IR:6,IS:1,IT:1,JO:6,KG:1,KW:6,KZ:1,LB:1,LI:1,LK:1,LT:1,LU:1,LV:1,LY:6,MC:1,MD:1,ME:1,MK:1,MN:1,MQ:1,MV:5,MY:1,NL:1,NO:1,NZ:1,OM:6,PL:1,QA:6,RE:1,RO:1,RS:1,RU:1,SD:6,SE:1,SI:1,SK:1,SM:1,SY:6,TJ:1,TM:1,TR:1,UA:1,UY:1,UZ:1,VA:1,VN:1,XK:1};function ee(e,t){return t=K(t,e.calendar),e.era===t.era&&e.year===t.year&&e.month===t.month&&e.day===t.day}function ua(e,t){return t=K(t,e.calendar),e=ge(e),t=ge(t),e.era===t.era&&e.year===t.year&&e.month===t.month}function da(e,t){return t=K(t,e.calendar),e=je(e),t=je(t),e.era===t.era&&e.year===t.year}function wr(e,t){return vt(e.calendar,t.calendar)&&ee(e,t)}function Qe(e,t){return vt(e.calendar,t.calendar)&&ua(e,t)}function et(e,t){return vt(e.calendar,t.calendar)&&da(e,t)}function vt(e,t){var n,r,o,a;return(a=(o=(n=e.isEqual)==null?void 0:n.call(e,t))!=null?o:(r=t.isEqual)==null?void 0:r.call(t,e))!=null?a:e.identifier===t.identifier}function $r(e,t){return ee(e,tt(t))}var Ac={sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6};function xr(e,t,n){let r=e.calendar.toJulianDay(e),o=n?Ac[n]:Pc(t),a=Math.ceil(r+1-o)%7;return a<0&&(a+=7),a}function An(e){return me(Date.now(),e)}function tt(e){return we(An(e))}function Er(e,t){return e.calendar.toJulianDay(e)-t.calendar.toJulianDay(t)}function fa(e,t){return ca(e)-ca(t)}function ca(e){return e.hour*36e5+e.minute*6e4+e.second*1e3+e.millisecond}var vr=null,Oc=!1;function bt(){return vr==null&&(vr=new Intl.DateTimeFormat().resolvedOptions().timeZone),vr}function Tr(){return Oc}function ge(e){return e.subtract({days:e.day-1})}function wt(e){return e.add({days:e.calendar.getDaysInMonth(e)-e.day})}function je(e){return ge(e.subtract({months:e.month-1}))}function Sr(e){return wt(e.add({months:e.calendar.getMonthsInYear(e)-e.month}))}function ve(e,t,n){let r=xr(e,t,n);return e.subtract({days:r})}function _t(e,t,n){return ve(e,t,n).add({days:6})}var la=new Map,br=new Map;function ga(e){if(Intl.Locale){let n=la.get(e);return n||(n=new Intl.Locale(e).maximize().region,n&&la.set(e,n)),n}let t=e.split("-")[1];return t==="u"?void 0:t}function Pc(e){let t=br.get(e);if(!t){if(Intl.Locale){let r=new Intl.Locale(e);if("getWeekInfo"in r&&(t=r.getWeekInfo(),t))return br.set(e,t),t.firstDay}let n=ga(e);if(e.includes("-fw-")){let r=e.split("-fw-")[1].split("-")[0];r==="mon"?t={firstDay:1}:r==="tue"?t={firstDay:2}:r==="wed"?t={firstDay:3}:r==="thu"?t={firstDay:4}:r==="fri"?t={firstDay:5}:r==="sat"?t={firstDay:6}:t={firstDay:0}}else e.includes("-ca-iso8601")?t={firstDay:1}:t={firstDay:n&&ia[n]||0};br.set(e,t)}return t.firstDay}function Dr(e,t,n){let r=e.calendar.getDaysInMonth(e);return Math.ceil((xr(ge(e),t,n)+r)/7)}function On(e,t){return e&&t?e.compare(t)<=0?e:t:e||t}function Pn(e,t){return e&&t?e.compare(t)>=0?e:t:e||t}var Rc={AF:[4,5],AE:[5,6],BH:[5,6],DZ:[5,6],EG:[5,6],IL:[5,6],IQ:[5,6],IR:[5,5],JO:[5,6],KW:[5,6],LY:[5,6],OM:[5,6],QA:[5,6],SA:[5,6],SD:[5,6],SY:[5,6],YE:[5,6]};function Ar(e,t){let n=e.calendar.toJulianDay(e),r=Math.ceil(n+1)%7;r<0&&(r+=7);let o=ga(t),[a,s]=Rc[o]||[6,0];return r===a||r===s}function Ke(e){e=K(e,new ye);let t=Dn(e.era,e.year);return pa(t,e.month,e.day,e.hour,e.minute,e.second,e.millisecond)}function pa(e,t,n,r,o,a,s){let i=new Date;return i.setUTCHours(r,o,a,s),i.setUTCFullYear(e,t-1,n),i.getTime()}function Or(e,t){if(t==="UTC")return 0;if(e>0&&t===bt()&&!Tr())return new Date(e).getTimezoneOffset()*-6e4;let{year:n,month:r,day:o,hour:a,minute:s,second:i}=ya(e,t);return pa(n,r,o,a,s,i,0)-Math.floor(e/1e3)*1e3}var ma=new Map;function ya(e,t){let n=ma.get(t);n||(n=new Intl.DateTimeFormat("en-US",{timeZone:t,hour12:!1,era:"short",year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",second:"numeric"}),ma.set(t,n));let r=n.formatToParts(new Date(e)),o={};for(let a of r)a.type!=="literal"&&(o[a.type]=a.value);return{year:o.era==="BC"||o.era==="B"?-o.year+1:+o.year,month:+o.month,day:+o.day,hour:o.hour==="24"?0:+o.hour,minute:+o.minute,second:+o.second}}var ha=864e5;function Cc(e,t,n,r){return(n===r?[n]:[n,r]).filter(a=>Ic(e,t,a))}function Ic(e,t,n){let r=ya(n,t);return e.year===r.year&&e.month===r.month&&e.day===r.day&&e.hour===r.hour&&e.minute===r.minute&&e.second===r.second}function be(e,t,n="compatible"){let r=G(e);if(t==="UTC")return Ke(r);if(t===bt()&&n==="compatible"&&!Tr()){r=K(r,new ye);let c=new Date,u=Dn(r.era,r.year);return c.setFullYear(u,r.month-1,r.day),c.setHours(r.hour,r.minute,r.second,r.millisecond),c.getTime()}let o=Ke(r),a=Or(o-ha,t),s=Or(o+ha,t),i=Cc(r,t,o-a,o-s);if(i.length===1)return i[0];if(i.length>1)switch(n){case"compatible":case"earlier":return i[0];case"later":return i[i.length-1];case"reject":throw new RangeError("Multiple possible absolute times found")}switch(n){case"earlier":return Math.min(o-a,o-s);case"compatible":case"later":return Math.max(o-a,o-s);case"reject":throw new RangeError("No such absolute time found")}}function Pr(e,t,n="compatible"){return new Date(be(e,t,n))}function me(e,t){let n=Or(e,t),r=new Date(e+n),o=r.getUTCFullYear(),a=r.getUTCMonth()+1,s=r.getUTCDate(),i=r.getUTCHours(),c=r.getUTCMinutes(),u=r.getUTCSeconds(),f=r.getUTCMilliseconds();return new nt(o<1?"BC":"AD",o<1?-o+1:o,a,s,t,n,i,c,u,f)}function we(e){return new te(e.calendar,e.era,e.year,e.month,e.day)}function G(e,t){let n=0,r=0,o=0,a=0;if("timeZone"in e)({hour:n,minute:r,second:o,millisecond:a}=e);else if("hour"in e&&!t)return e;return t&&({hour:n,minute:r,second:o,millisecond:a}=t),new $t(e.calendar,e.era,e.year,e.month,e.day,n,r,o,a)}function K(e,t){if(vt(e.calendar,t))return e;let n=t.fromJulianDay(e.calendar.toJulianDay(e)),r=e.copy();return r.calendar=t,r.era=n.era,r.year=n.year,r.month=n.month,r.day=n.day,Ce(r),r}function Wt(e,t,n){if(e instanceof nt)return e.timeZone===t?e:Rr(e,t);let r=be(e,t,n);return me(r,t)}function va(e){let t=Ke(e)-e.offset;return new Date(t)}function Rr(e,t){let n=Ke(e)-e.offset;return K(me(n,t),e.calendar)}var Yt=36e5;function Ut(e,t){var s,i;let n=e.copy(),r="hour"in n?kc(n,t):0;Cr(n,t.years||0),n.calendar.balanceYearMonth&&n.calendar.balanceYearMonth(n,e),n.month+=t.months||0,Ir(n),wa(n),n.day+=(t.weeks||0)*7,n.day+=t.days||0,n.day+=r,Mc(n),n.calendar.balanceDate&&n.calendar.balanceDate(n),n.year<1&&(n.year=1,n.month=1,n.day=1);let o=n.calendar.getYearsInEra(n);if(n.year>o){let c=(i=(s=n.calendar).isInverseEra)==null?void 0:i.call(s,n);n.year=o,n.month=c?1:n.calendar.getMonthsInYear(n),n.day=c?1:n.calendar.getDaysInMonth(n)}n.month<1&&(n.month=1,n.day=1);let a=n.calendar.getMonthsInYear(n);return n.month>a&&(n.month=a,n.day=n.calendar.getDaysInMonth(n)),n.day=Math.max(1,Math.min(n.calendar.getDaysInMonth(n),n.day)),n}function Cr(e,t){var n,r;(r=(n=e.calendar).isInverseEra)!=null&&r.call(n,e)&&(t=-t),e.year+=t}function Ir(e){for(;e.month<1;)Cr(e,-1),e.month+=e.calendar.getMonthsInYear(e);let t=0;for(;e.month>(t=e.calendar.getMonthsInYear(e));)e.month-=t,Cr(e,1)}function Mc(e){for(;e.day<1;)e.month--,Ir(e),e.day+=e.calendar.getDaysInMonth(e);for(;e.day>e.calendar.getDaysInMonth(e);)e.day-=e.calendar.getDaysInMonth(e),e.month++,Ir(e)}function wa(e){e.month=Math.max(1,Math.min(e.calendar.getMonthsInYear(e),e.month)),e.day=Math.max(1,Math.min(e.calendar.getDaysInMonth(e),e.day))}function Ce(e){e.calendar.constrainDate&&e.calendar.constrainDate(e),e.year=Math.max(1,Math.min(e.calendar.getYearsInEra(e),e.year)),wa(e)}function $a(e){let t={};for(let n in e)typeof e[n]=="number"&&(t[n]=-e[n]);return t}function Mr(e,t){return Ut(e,$a(t))}function Cn(e,t){let n=e.copy();return t.era!=null&&(n.era=t.era),t.year!=null&&(n.year=t.year),t.month!=null&&(n.month=t.month),t.day!=null&&(n.day=t.day),Ce(n),n}function Ht(e,t){let n=e.copy();return t.hour!=null&&(n.hour=t.hour),t.minute!=null&&(n.minute=t.minute),t.second!=null&&(n.second=t.second),t.millisecond!=null&&(n.millisecond=t.millisecond),xa(n),n}function Vc(e){e.second+=Math.floor(e.millisecond/1e3),e.millisecond=Rn(e.millisecond,1e3),e.minute+=Math.floor(e.second/60),e.second=Rn(e.second,60),e.hour+=Math.floor(e.minute/60),e.minute=Rn(e.minute,60);let t=Math.floor(e.hour/24);return e.hour=Rn(e.hour,24),t}function xa(e){e.millisecond=Math.max(0,Math.min(e.millisecond,999)),e.second=Math.max(0,Math.min(e.second,59)),e.minute=Math.max(0,Math.min(e.minute,59)),e.hour=Math.max(0,Math.min(e.hour,23))}function Rn(e,t){let n=e%t;return n<0&&(n+=t),n}function kc(e,t){return e.hour+=t.hours||0,e.minute+=t.minutes||0,e.second+=t.seconds||0,e.millisecond+=t.milliseconds||0,Vc(e)}function In(e,t,n,r){var a,s;let o=e.copy();switch(t){case"era":{let i=e.calendar.getEras(),c=i.indexOf(e.era);if(c<0)throw new Error("Invalid era: "+e.era);c=Ie(c,n,0,i.length-1,r==null?void 0:r.round),o.era=i[c],Ce(o);break}case"year":(s=(a=o.calendar).isInverseEra)!=null&&s.call(a,o)&&(n=-n),o.year=Ie(e.year,n,-1/0,9999,r==null?void 0:r.round),o.year===-1/0&&(o.year=1),o.calendar.balanceYearMonth&&o.calendar.balanceYearMonth(o,e);break;case"month":o.month=Ie(e.month,n,1,e.calendar.getMonthsInYear(e),r==null?void 0:r.round);break;case"day":o.day=Ie(e.day,n,1,e.calendar.getDaysInMonth(e),r==null?void 0:r.round);break;default:throw new Error("Unsupported field "+t)}return e.calendar.balanceDate&&e.calendar.balanceDate(o),Ce(o),o}function Vr(e,t,n,r){let o=e.copy();switch(t){case"hour":{let a=e.hour,s=0,i=23;if((r==null?void 0:r.hourCycle)===12){let c=a>=12;s=c?12:0,i=c?23:11}o.hour=Ie(a,n,s,i,r==null?void 0:r.round);break}case"minute":o.minute=Ie(e.minute,n,0,59,r==null?void 0:r.round);break;case"second":o.second=Ie(e.second,n,0,59,r==null?void 0:r.round);break;case"millisecond":o.millisecond=Ie(e.millisecond,n,0,999,r==null?void 0:r.round);break;default:throw new Error("Unsupported field "+t)}return o}function Ie(e,t,n,r,o=!1){if(o){e+=Math.sign(t),e<n&&(e=r);let a=Math.abs(t);t>0?e=Math.ceil(e/a)*a:e=Math.floor(e/a)*a,e>r&&(e=n)}else e+=t,e<n?e=r-(n-e-1):e>r&&(e=n+(e-r-1));return e}function kr(e,t){let n;if(t.years!=null&&t.years!==0||t.months!=null&&t.months!==0||t.weeks!=null&&t.weeks!==0||t.days!=null&&t.days!==0){let o=Ut(G(e),{years:t.years,months:t.months,weeks:t.weeks,days:t.days});n=be(o,e.timeZone)}else n=Ke(e)-e.offset;n+=t.milliseconds||0,n+=(t.seconds||0)*1e3,n+=(t.minutes||0)*6e4,n+=(t.hours||0)*36e5;let r=me(n,e.timeZone);return K(r,e.calendar)}function Ea(e,t){return kr(e,$a(t))}function Ta(e,t,n,r){switch(t){case"hour":{let o=0,a=23;if((r==null?void 0:r.hourCycle)===12){let d=e.hour>=12;o=d?12:0,a=d?23:11}let s=G(e),i=K(Ht(s,{hour:o}),new ye),c=[be(i,e.timeZone,"earlier"),be(i,e.timeZone,"later")].filter(d=>me(d,e.timeZone).day===i.day)[0],u=K(Ht(s,{hour:a}),new ye),f=[be(u,e.timeZone,"earlier"),be(u,e.timeZone,"later")].filter(d=>me(d,e.timeZone).day===u.day).pop(),h=Ke(e)-e.offset,p=Math.floor(h/Yt),g=h%Yt;return h=Ie(p,n,Math.floor(c/Yt),Math.floor(f/Yt),r==null?void 0:r.round)*Yt+g,K(me(h,e.timeZone),e.calendar)}case"minute":case"second":case"millisecond":return Vr(e,t,n,r);case"era":case"year":case"month":case"day":{let o=In(G(e),t,n,r),a=be(o,e.timeZone);return K(me(a,e.timeZone),e.calendar)}default:throw new Error("Unsupported field "+t)}}function Sa(e,t,n){let r=G(e),o=Ht(Cn(r,t),t);if(o.compare(r)===0)return e;let a=be(o,e.timeZone,n);return K(me(a,e.timeZone),e.calendar)}var Lc=/^([+-]\\d{6}|\\d{4})-(\\d{2})-(\\d{2})$/;var Nc=/^([+-]\\d{6}|\\d{4})-(\\d{2})-(\\d{2})(?:T(\\d{2}))?(?::(\\d{2}))?(?::(\\d{2}))?(\\.\\d+)?(?:(?:([+-]\\d{2})(?::?(\\d{2}))?)|Z)$/,Fd=new RegExp("^((?<negative>-)|\\\\+)?P((?<years>\\\\d*)Y)?((?<months>\\\\d*)M)?((?<weeks>\\\\d*)W)?((?<days>\\\\d*)D)?((?<time>T)((?<hours>\\\\d*[.,]?\\\\d{1,9})H)?((?<minutes>\\\\d*[.,]?\\\\d{1,9})M)?((?<seconds>\\\\d*[.,]?\\\\d{1,9})S)?)?$"),Fc=["hours","minutes","seconds"],Bd=["years","months","weeks","days",...Fc];function Nr(e){let t=e.match(Lc);if(!t)throw Nc.test(e)?new Error(`Invalid ISO 8601 date string: ${e}. Use parseAbsolute() instead.`):new Error("Invalid ISO 8601 date string: "+e);let n=new te(Lr(t[1],0,9999),Lr(t[2],1,12),1);return n.day=Lr(t[3],1,n.calendar.getDaysInMonth(n)),n}function Lr(e,t,n){let r=Number(e);if(r<t||r>n)throw new RangeError(`Value out of range: ${t} <= ${r} <= ${n}`);return r}function Da(e){return`${String(e.hour).padStart(2,"0")}:${String(e.minute).padStart(2,"0")}:${String(e.second).padStart(2,"0")}${e.millisecond?String(e.millisecond/1e3).slice(1):""}`}function Fr(e){let t=K(e,new ye),n;return t.era==="BC"?n=t.year===1?"0000":"-"+String(Math.abs(1-t.year)).padStart(6,"00"):n=String(t.year).padStart(4,"0"),`${n}-${String(t.month).padStart(2,"0")}-${String(t.day).padStart(2,"0")}`}function Br(e){return`${Fr(e)}T${Da(e)}`}function Bc(e){let t=Math.sign(e)<0?"-":"+";e=Math.abs(e);let n=Math.floor(e/36e5),r=Math.floor(e%36e5/6e4),o=Math.floor(e%36e5%6e4/1e3),a=`${t}${String(n).padStart(2,"0")}:${String(r).padStart(2,"0")}`;return o!==0&&(a+=`:${String(o).padStart(2,"0")}`),a}function Aa(e){return`${Br(e)}${Bc(e.offset)}[${e.timeZone}]`}function Hr(e){let t=typeof e[0]=="object"?e.shift():new ye,n;if(typeof e[0]=="string")n=e.shift();else{let s=t.getEras();n=s[s.length-1]}let r=e.shift(),o=e.shift(),a=e.shift();return[t,n,r,o,a]}var _r,Mn=class Mn{constructor(...t){xn(this,_r);let[n,r,o,a,s]=Hr(t);this.calendar=n,this.era=r,this.year=o,this.month=a,this.day=s,Ce(this)}copy(){return this.era?new Mn(this.calendar,this.era,this.year,this.month,this.day):new Mn(this.calendar,this.year,this.month,this.day)}add(t){return Ut(this,t)}subtract(t){return Mr(this,t)}set(t){return Cn(this,t)}cycle(t,n,r){return In(this,t,n,r)}toDate(t){return Pr(this,t)}toString(){return Fr(this)}compare(t){return Er(this,t)}};_r=new WeakMap;var te=Mn;var Wr,Vn=class Vn{constructor(...t){xn(this,Wr);let[n,r,o,a,s]=Hr(t);this.calendar=n,this.era=r,this.year=o,this.month=a,this.day=s,this.hour=t.shift()||0,this.minute=t.shift()||0,this.second=t.shift()||0,this.millisecond=t.shift()||0,Ce(this)}copy(){return this.era?new Vn(this.calendar,this.era,this.year,this.month,this.day,this.hour,this.minute,this.second,this.millisecond):new Vn(this.calendar,this.year,this.month,this.day,this.hour,this.minute,this.second,this.millisecond)}add(t){return Ut(this,t)}subtract(t){return Mr(this,t)}set(t){return Cn(Ht(this,t),t)}cycle(t,n,r){switch(t){case"era":case"year":case"month":case"day":return In(this,t,n,r);default:return Vr(this,t,n,r)}}toDate(t,n){return Pr(this,t,n)}toString(){return Br(this)}compare(t){let n=Er(this,t);return n===0?fa(this,G(t)):n}};Wr=new WeakMap;var $t=Vn,Yr,kn=class kn{constructor(...t){xn(this,Yr);let[n,r,o,a,s]=Hr(t),i=t.shift(),c=t.shift();this.calendar=n,this.era=r,this.year=o,this.month=a,this.day=s,this.timeZone=i,this.offset=c,this.hour=t.shift()||0,this.minute=t.shift()||0,this.second=t.shift()||0,this.millisecond=t.shift()||0,Ce(this)}copy(){return this.era?new kn(this.calendar,this.era,this.year,this.month,this.day,this.timeZone,this.offset,this.hour,this.minute,this.second,this.millisecond):new kn(this.calendar,this.year,this.month,this.day,this.timeZone,this.offset,this.hour,this.minute,this.second,this.millisecond)}add(t){return kr(this,t)}subtract(t){return Ea(this,t)}set(t,n){return Sa(this,t,n)}cycle(t,n,r){return Ta(this,t,n,r)}toDate(){return va(this)}toString(){return Aa(this)}toAbsoluteString(){return this.toDate().toISOString()}compare(t){return this.toDate().getTime()-Wt(t,this.timeZone).toDate().getTime()}};Yr=new WeakMap;var nt=kn;var Ur=new Map,z=class{constructor(t,n={}){this.formatter=Oa(t,n),this.options=n}format(t){return this.formatter.format(t)}formatToParts(t){return this.formatter.formatToParts(t)}formatRange(t,n){if(typeof this.formatter.formatRange=="function")return this.formatter.formatRange(t,n);if(n<t)throw new RangeError("End date must be >= start date");return`${this.formatter.format(t)} \\u2013 ${this.formatter.format(n)}`}formatRangeToParts(t,n){if(typeof this.formatter.formatRangeToParts=="function")return this.formatter.formatRangeToParts(t,n);if(n<t)throw new RangeError("End date must be >= start date");let r=this.formatter.formatToParts(t),o=this.formatter.formatToParts(n);return[...r.map(a=>I(R({},a),{source:"startRange"})),{type:"literal",value:" \\u2013 ",source:"shared"},...o.map(a=>I(R({},a),{source:"endRange"}))]}resolvedOptions(){let t=this.formatter.resolvedOptions();return Yc()&&(this.resolvedHourCycle||(this.resolvedHourCycle=Hc(t.locale,this.options)),t.hourCycle=this.resolvedHourCycle,t.hour12=this.resolvedHourCycle==="h11"||this.resolvedHourCycle==="h12"),t.calendar==="ethiopic-amete-alem"&&(t.calendar="ethioaa"),t}},_c={true:{ja:"h11"},false:{}};function Oa(e,t={}){if(typeof t.hour12=="boolean"&&Wc()){t=R({},t);let o=_c[String(t.hour12)][e.split("-")[0]],a=t.hour12?"h12":"h23";t.hourCycle=o!=null?o:a,delete t.hour12}let n=e+(t?Object.entries(t).sort((o,a)=>o[0]<a[0]?-1:1).join():"");if(Ur.has(n))return Ur.get(n);let r=new Intl.DateTimeFormat(e,t);return Ur.set(n,r),r}var jr=null;function Wc(){return jr==null&&(jr=new Intl.DateTimeFormat("en-US",{hour:"numeric",hour12:!1}).format(new Date(2020,2,3,0))==="24"),jr}var Kr=null;function Yc(){return Kr==null&&(Kr=new Intl.DateTimeFormat("fr",{hour:"numeric",hour12:!1}).resolvedOptions().hourCycle==="h12"),Kr}function Hc(e,t){if(!t.timeStyle&&!t.hour)return;e=e.replace(/(-u-)?-nu-[a-zA-Z0-9]+/,""),e+=(e.includes("-u-")?"":"-u")+"-nu-latn";let n=Oa(e,I(R({},t),{timeZone:void 0})),r=parseInt(n.formatToParts(new Date(2020,2,3,0)).find(a=>a.type==="hour").value,10),o=parseInt(n.formatToParts(new Date(2020,2,3,23)).find(a=>a.type==="hour").value,10);if(r===0&&o===23)return"h23";if(r===24&&o===23)return"h24";if(r===0&&o===11)return"h11";if(r===12&&o===11)return"h12";throw new Error("Unexpected hour cycle result")}function Pa(e,t,n,r,o){let a={};for(let i in t){let c=i,u=t[c];u!=null&&(a[c]=Math.floor(u/2),a[c]>0&&u%2===0&&a[c]--)}let s=Me(e,t,n).subtract(a);return xt(e,s,t,n,r,o)}function Me(e,t,n,r,o){let a=e;return t.years?a=je(e):t.months?a=ge(e):t.weeks&&(a=ve(e,n)),xt(e,a,t,n,r,o)}function jt(e,t,n,r,o){let a=R({},t);a.days?a.days--:a.weeks?a.weeks--:a.months?a.months--:a.years&&a.years--;let s=Me(e,t,n).subtract(a);return xt(e,s,t,n,r,o)}function xt(e,t,n,r,o,a){return o&&e.compare(o)>=0&&(t=Pn(t,Me(we(o),n,r))),a&&e.compare(a)<=0&&(t=On(t,jt(we(a),n,r))),t}function se(e,t,n){let r=we(e),o=t?we(t):void 0,a=n?we(n):void 0,s=r;return o&&(s=Pn(s,o)),a&&(s=On(s,a)),s.compare(r)===0?e:"hour"in e?e.set({year:s.year,month:s.month,day:s.day}):s}function qr(e,t,n,r,o,a){switch(t){case"start":return Me(e,n,r,o,a);case"end":return jt(e,n,r,o,a);default:return Pa(e,n,r,o,a)}}function Ve(e,t){return e==null||t==null?e===t:!("hour"in e)&&!("hour"in t)?ee(e,t):G(e).compare(G(t))===0}function Zr(e,t,n,r,o){return e?t!=null&&t(e,n)?!0:he(e,r,o):!1}function he(e,t,n){return t!=null&&e.compare(t)<0||n!=null&&e.compare(n)>0}function Ra(e,t,n){let r=e.subtract({days:1});return ee(r,e)||he(r,t,n)}function Ca(e,t,n){let r=e.add({days:1});return ee(r,e)||he(r,t,n)}function Kt(e){let t=R({},e);for(let n in t)t[n]=1;return t}function Ln(e,t){let n=R({},t);return n.days?n.days--:n.days=-1,e.add(n)}function Gr(e){if(!e)return;let t=e.calendar.identifier;return t==="gregory"||t==="iso8601"?e.era==="BC"?"short":void 0:"short"}function Nn(e,t,n){let r=n!=null?n:G(tt(t));return new z(e,{weekday:"long",month:"long",year:"numeric",day:"numeric",era:Gr(r),calendar:r.calendar.identifier,timeZone:t})}function Fn(e,t,n){let r=n!=null?n:tt(t);return new z(e,{month:"long",year:"numeric",era:Gr(r),calendar:r.calendar.identifier,timeZone:t})}function Uc(e,t,n,r,o){let a=n.formatRangeToParts(e.toDate(o),t.toDate(o)),s=-1;for(let u=0;u<a.length;u++){let f=a[u];if(f.source==="shared"&&f.type==="literal")s=u;else if(f.source==="endRange")break}let i="",c="";for(let u=0;u<a.length;u++)u<s?i+=a[u].value:u>s&&(c+=a[u].value);return r(i,c)}function qt(e,t,n,r){if(!e)return"";let o=e,a=t!=null?t:e,s=Nn(n,r);return ee(o,a)?s.format(o.toDate(r)):Uc(o,a,s,(i,c)=>`${i} \\u2013 ${c}`,r)}var jc=["sun","mon","tue","wed","thu","fri","sat"];function Ia(e){return e!=null?jc[e]:void 0}function Ma(e,t,n){let r=Ia(n);return ve(e,t,r)}function zr(e,t,n,r){let o=t.add({weeks:e}),a=[],s=Ma(o,n,r);for(;a.length<7;){a.push(s);let i=s.add({days:1});if(ee(s,i))break;s=i}return a}function Va(e,t,n,r){let o=Ia(r),a=n!=null?n:Dr(e,t,o);return[...new Array(a).keys()].map(i=>zr(i,e,t,r))}function Kc(e,t){let n=new z(e,{weekday:"long",timeZone:t}),r=new z(e,{weekday:"short",timeZone:t}),o=new z(e,{weekday:"narrow",timeZone:t});return a=>{let s=a instanceof Date?a:a.toDate(t);return{value:a,short:r.format(s),long:n.format(s),narrow:o.format(s)}}}function ka(e,t,n,r){let o=Ma(e,r,t),a=[...new Array(7).keys()],s=Kc(r,n);return a.map(i=>s(o.add({days:i})))}function La(e,t="long",n){if(!n||n.calendar.identifier==="gregory"||n.calendar.identifier==="iso8601"){let s=new Date(2021,0,1),i=[];for(let c=0;c<12;c++)i.push(s.toLocaleString(e,{month:t})),s.setMonth(s.getMonth()+1);return i}let r=n.calendar.getMonthsInYear(n),o=new z(e,{month:t,calendar:n.calendar.identifier}),a=[];for(let s=1;s<=r;s++){let i=n.set({month:s});a.push(o.format(i.toDate("UTC")))}return a}function Xr(e,t){let n=ve(e,t,"mon"),r=n.year,o=n.set({month:1,day:4}),a=ve(o,t,"mon"),s=n.calendar.toJulianDay(n),i=a.calendar.toJulianDay(a);if(s>=i)return 1+Math.floor((s-i)/7);let c=n.set({year:r-1,month:1,day:4}),u=ve(c,t,"mon"),f=u.calendar.toJulianDay(u);return 1+Math.floor((s-f)/7)}function Na(e){let t=[];for(let n=e.from;n<=e.to;n+=1)t.push(n);return t}var qc=1900,Zc=2099;function Fa(e,t,n){var s,i;let r=e.calendar,o=(s=t==null?void 0:t.year)!=null?s:K(new te(qc,1,1),r).year,a=(i=n==null?void 0:n.year)!=null?i:K(new te(Zc,12,31),r).year;return{from:o,to:a}}var Gc=10;function Ba(e){if(e){if(e.length===3)return e.padEnd(4,"0");if(e.length===2){let t=new Date().getFullYear(),n=Math.floor(t/100)*100,r=parseInt(e.slice(-2),10),o=n+r;return o>t+Gc?(o-100).toString():o.toString()}return e}}function ke(e){let t=e-e%10,n=[];for(let r=0;r<10;r+=1){let o=t+r;n.push(o)}return n}function rt(e,t){let n=tt(e!=null?e:bt());return t?K(n,t):n}function Et(e,t,n,r){return function(a){let{startDate:s,focusedDate:i}=a,c=Ln(s,e);return he(i,n,r)?{startDate:s,focusedDate:se(i,n,r),endDate:c}:i.compare(s)<0?{startDate:jt(i,e,t,n,r),focusedDate:se(i,n,r),endDate:c}:i.compare(c)>0?{startDate:Me(i,e,t,n,r),endDate:c,focusedDate:se(i,n,r)}:{startDate:s,endDate:c,focusedDate:se(i,n,r)}}}function Jr(e,t,n,r,o,a){let s=Et(n,r,o,a),i=t.add(n);return s({focusedDate:e.add(n),startDate:Me(xt(e,i,n,r,o,a),n,r)})}function Qr(e,t,n,r,o,a){let s=Et(n,r,o,a),i=t.subtract(n);return s({focusedDate:e.subtract(n),startDate:Me(xt(e,i,n,r,o,a),n,r)})}function _a(e,t,n,r,o,a,s){let i=Et(r,o,a,s);if(!n&&!r.days)return i({focusedDate:e.add(Kt(r)),startDate:t});if(r.days)return Jr(e,t,r,o,a,s);if(r.weeks)return i({focusedDate:e.add({months:1}),startDate:t});if(r.months||r.years)return i({focusedDate:e.add({years:1}),startDate:t})}function Wa(e,t,n,r,o,a,s){let i=Et(r,o,a,s);if(!n&&!r.days)return i({focusedDate:e.subtract(Kt(r)),startDate:t});if(r.days)return Qr(e,t,r,o,a,s);if(r.weeks)return i({focusedDate:e.subtract({months:1}),startDate:t});if(r.months||r.years)return i({focusedDate:e.subtract({years:1}),startDate:t})}var Ya=new Map;function zc(e){let t=Ya.get(e);return t!=null||(t="0123456789"+new Intl.NumberFormat(e,{useGrouping:!1}).format(1234567890),Ya.set(e,t)),t}var Xc=(e,t)=>t?zc(t).includes(e):/\\d/.test(e),eo=(e,t,n)=>!e||e.length!==1?!0:Xc(e,n)||t.includes(e),Ua=(e,t,n)=>e.split("").filter(r=>eo(r,t,n)).join(""),Ha=new Map;function ja(e){let t=Ha.get(e);if(t!=null)return t;let r=new Intl.DateTimeFormat(e).formatToParts(new Date).find(o=>o.type==="literal");return t=r?r.value:"/",Ha.set(e,t),t}var Ka=e=>e!=null&&e.length===4,Jc=e=>e!=null&&parseFloat(e)<=12,Qc=e=>e!=null&&parseFloat(e)<=31;function qa(e,t,n){var u;let r=el(t,n),{year:o,month:a,day:s}=(u=tl(r,e))!=null?u:{};if(o!=null||a!=null||s!=null){let f=new Date;o||(o=f.getFullYear().toString()),a||(a=(f.getMonth()+1).toString()),s||(s=f.getDate().toString())}if(Ka(o)||(o=Ba(o)),Ka(o)&&Jc(a)&&Qc(s))return new te(+o,+a,+s);let c=Date.parse(e);if(!isNaN(c)){let f=new Date(c);return new te(f.getFullYear(),f.getMonth()+1,f.getDate())}}function el(e,t){return new z(e,{day:"numeric",month:"numeric",year:"numeric",timeZone:t}).formatToParts(new Date(2e3,11,25)).map(({type:o,value:a})=>o==="literal"?`${a}?`:`((?!=<${o}>)\\\\d+)?`).join("")}function tl(e,t){var r;let n=t.match(e);return(r=e.toString().match(/<(.+?)>/g))==null?void 0:r.map(o=>{var s;let a=o.match(/<(.+)>/);return!a||a.length<=0?null:(s=o.match(/<(.+)>/))==null?void 0:s[1]}).reduce((o,a,s)=>(a&&(n&&n.length>s?o[a]=n[s+1]:o[a]=null),o),{})}function to(e,t,n){let r=we(An(n));switch(e){case"thisWeek":return[ve(r,t),_t(r,t)];case"thisMonth":return[ge(r),r];case"thisQuarter":return[ge(r).add({months:-((r.month-1)%3)}),r];case"thisYear":return[je(r),r];case"last3Days":return[r.add({days:-2}),r];case"last7Days":return[r.add({days:-6}),r];case"last14Days":return[r.add({days:-13}),r];case"last30Days":return[r.add({days:-29}),r];case"last90Days":return[r.add({days:-89}),r];case"lastMonth":return[ge(r.add({months:-1})),wt(r.add({months:-1}))];case"lastQuarter":return[ge(r.add({months:-((r.month-1)%3)-3})),wt(r.add({months:-((r.month-1)%3)-1}))];case"lastWeek":return[ve(r,t).add({weeks:-1}),_t(r,t).add({weeks:-1})];case"lastYear":return[je(r.add({years:-1})),Sr(r.add({years:-1}))];default:throw new Error(`Invalid date range preset: ${e}`)}}var nl=Object.defineProperty,rl=(e,t,n)=>t in e?nl(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n,Bn=(e,t,n)=>rl(e,typeof t!="symbol"?t+"":t,n);var no=()=>{},Zt=e=>typeof e=="object"&&e!==null;var M=e=>e?"":void 0,ne=e=>e?"true":void 0;var ol=1,al=9,sl=11;var J=e=>Zt(e)&&e.nodeType===ol&&typeof e.nodeName=="string",ro=e=>Zt(e)&&e.nodeType===al,il=e=>Zt(e)&&e===e.window;var Za=e=>J(e)?e.localName||"":"#document";function Ga(e){return["html","body","#document"].includes(Za(e))}var za=e=>Zt(e)&&e.nodeType!==void 0,ot=e=>za(e)&&e.nodeType===sl&&"host"in e;var Xa=e=>J(e)?e.offsetWidth>0||e.offsetHeight>0||e.getClientRects().length>0:!1;function Ja(e){if(!e)return!1;let t=e.getRootNode();return _n(t)===e}function at(e,t){var r;if(!e||!t||!J(e)||!za(t))return!1;if(J(t)&&e===t||e.contains(t))return!0;let n=(r=t.getRootNode)==null?void 0:r.call(t);if(n&&ot(n)){let o=t;for(;o;){if(e===o)return!0;o=o.parentNode||o.host}}return!1}function pe(e){var t;return ro(e)?e:il(e)?e.document:(t=e==null?void 0:e.ownerDocument)!=null?t:document}function cl(e){return pe(e).documentElement}function ie(e){var t,n,r;return ot(e)?ie(e.host):ro(e)?(t=e.defaultView)!=null?t:window:J(e)&&(r=(n=e.ownerDocument)==null?void 0:n.defaultView)!=null?r:window}function _n(e){let t=e.activeElement;for(;t!=null&&t.shadowRoot;){let n=t.shadowRoot.activeElement;if(!n||n===t)break;t=n}return t}function Qa(e){if(Za(e)==="html")return e;let t=e.assignedSlot||e.parentNode||ot(e)&&e.host||cl(e);return ot(t)?t.host:t}function es(e){var n;let t;try{if(t=e.getRootNode({composed:!0}),ro(t)||ot(t))return t}catch(r){}return(n=e.ownerDocument)!=null?n:document}var oo=new WeakMap;function Wn(e){return oo.has(e)||oo.set(e,ie(e).getComputedStyle(e)),oo.get(e)}var ts=()=>typeof document!="undefined";function ll(){var t;let e=navigator.userAgentData;return(t=e==null?void 0:e.platform)!=null?t:navigator.platform}var ao=e=>ts()&&e.test(ll());var ul=/^iPhone/i,dl=/^iPad/i,fl=/^Mac/i;var so=()=>ts()&&!!navigator.maxTouchPoints,gl=()=>ao(ul),ml=()=>ao(dl)||co()&&navigator.maxTouchPoints>1,io=()=>gl()||ml();var co=()=>ao(fl);var hl=new Set(["menu","listbox","dialog","grid","tree","region","application"]),pl=e=>hl.has(e),yl=e=>{var t;return((t=e.getAttribute("aria-controls"))==null?void 0:t.split(" "))||[]};function ns(e,t){let n=new Set,r=es(e),o=a=>{let s=a.querySelectorAll("[aria-controls]");for(let i of s){if(i.getAttribute("aria-expanded")!=="true")continue;let c=yl(i);for(let u of c){if(!u||n.has(u))continue;n.add(u);let f=r.getElementById(u);if(f){let h=f.getAttribute("role"),p=f.getAttribute("aria-modal")==="true";if(h&&pl(h)&&!p&&(f===t||f.contains(t)||o(f)))return!0}}}return!1};return o(e)}function vl(e){var t,n,r,o;return(o=(t=e.composedPath)==null?void 0:t.call(e))!=null?o:(r=(n=e.nativeEvent)==null?void 0:n.composedPath)==null?void 0:r.call(n)}function Tt(e){var n;let t=vl(e);return(n=t==null?void 0:t[0])!=null?n:e.target}function os(e){return lo(e).isComposing||e.keyCode===229}var as=e=>e.button===2||co()&&e.ctrlKey&&e.button===0;var bl={Up:"ArrowUp",Down:"ArrowDown",Esc:"Escape"," ":"Space",",":"Comma",Left:"ArrowLeft",Right:"ArrowRight"},rs={ArrowLeft:"ArrowRight",ArrowRight:"ArrowLeft"};function ss(e,t={}){var s;let{dir:n="ltr",orientation:r="horizontal"}=t,o=e.key;return o=(s=bl[o])!=null?s:o,n==="rtl"&&r==="horizontal"&&o in rs&&(o=rs[o]),o}function lo(e){var t;return(t=e.nativeEvent)!=null?t:e}var St=(e,t,n,r)=>{let o=typeof e=="function"?e():e;return o==null||o.addEventListener(t,n,r),()=>{o==null||o.removeEventListener(t,n,r)}};function wl(e,t){var a;let{type:n="HTMLInputElement",property:r="value"}=t,o=ie(e)[n].prototype;return(a=Object.getOwnPropertyDescriptor(o,r))!=null?a:{}}function $l(e){if(e.localName==="input")return"HTMLInputElement";if(e.localName==="textarea")return"HTMLTextAreaElement";if(e.localName==="select")return"HTMLSelectElement"}function Gt(e,t,n="value"){var o;if(!e)return;let r=$l(e);r&&((o=wl(e,{type:r,property:n}).set)==null||o.call(e,t)),e.setAttribute(n,t)}var xl="input:not([type=\'hidden\']):not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], button:not([disabled]), [tabindex], iframe, object, embed, area[href], audio[controls], video[controls], [contenteditable]:not([contenteditable=\'false\']), details > summary:first-of-type";function uo(e){return!J(e)||e.closest("[inert]")?!1:e.matches(xl)&&Xa(e)}var El=class is{constructor(){Bn(this,"id",null),Bn(this,"fn_cleanup"),Bn(this,"cleanup",()=>{this.cancel()})}static create(){return new is}request(t){this.cancel(),this.id=globalThis.requestAnimationFrame(()=>{this.id=null,this.fn_cleanup=t==null?void 0:t()})}cancel(){var t;this.id!==null&&(globalThis.cancelAnimationFrame(this.id),this.id=null),(t=this.fn_cleanup)==null||t.call(this),this.fn_cleanup=void 0}isActive(){return this.id!==null}};function re(e){let t=El.create();return t.request(e),t.cleanup}function Yn(e){let t=new Set;function n(r){let o=globalThis.requestAnimationFrame(r);t.add(()=>globalThis.cancelAnimationFrame(o))}return n(()=>n(e)),function(){t.forEach(o=>o())}}function Hn(e){let t=Qa(e);return Ga(t)?pe(t).body:J(t)&&Dl(t)?t:Hn(t)}var Tl=/auto|scroll|overlay|hidden|clip/,Sl=new Set(["inline","contents"]);function Dl(e){let t=ie(e),{overflow:n,overflowX:r,overflowY:o,display:a}=t.getComputedStyle(e);return Tl.test(n+o+r)&&!Sl.has(a)}var Dt="default",fo="",Un=new WeakMap;function Al(e={}){let{target:t,doc:n}=e,r=n!=null?n:document,o=r.documentElement;return io()?(Dt==="default"&&(fo=o.style.webkitUserSelect,o.style.webkitUserSelect="none"),Dt="disabled"):t&&(Un.set(t,t.style.userSelect),t.style.userSelect="none"),()=>go({target:t,doc:r})}function go(e={}){let{target:t,doc:n}=e,o=(n!=null?n:document).documentElement;if(io()){if(Dt!=="disabled")return;Dt="restoring",setTimeout(()=>{Yn(()=>{Dt==="restoring"&&(o.style.webkitUserSelect==="none"&&(o.style.webkitUserSelect=fo||""),fo="",Dt="default")})},300)}else if(t&&Un.has(t)){let a=Un.get(t);t.style.userSelect==="none"&&(t.style.userSelect=a!=null?a:""),t.getAttribute("style")===""&&t.removeAttribute("style"),Un.delete(t)}}function cs(e={}){let s=e,{defer:t,target:n}=s,r=Se(s,["defer","target"]),o=t?re:i=>i(),a=[];return a.push(o(()=>{let i=typeof n=="function"?n():n;a.push(Al(I(R({},r),{target:i})))})),()=>{a.forEach(i=>i==null?void 0:i())}}function ls(e,t){var n;return Array.from((n=e==null?void 0:e.querySelectorAll(t))!=null?n:[])}function us(e,t){var n;return(n=e==null?void 0:e.querySelector(t))!=null?n:null}function ds(e,t){if(!e)return no;let n=Object.keys(t).reduce((r,o)=>(r[o]=e.style.getPropertyValue(o),r),{});return Ol(n,t)?no:(Object.assign(e.style,t),()=>{Object.assign(e.style,n),e.style.length===0&&e.removeAttribute("style")})}function Ol(e,t){return Object.keys(e).every(n=>e[n]===t[n])}function Pl(e,t,n){let{signal:r}=t;return[new Promise((s,i)=>{let c=setTimeout(()=>{i(new Error(`Timeout of ${n}ms exceeded`))},n);r.addEventListener("abort",()=>{clearTimeout(c),i(new DOMException("Promise aborted","AbortError"))}),e.then(u=>{r.aborted||(clearTimeout(c),s(u))}).catch(u=>{r.aborted||(clearTimeout(c),i(u))})}),()=>t.abort()]}function fs(e,t){let{timeout:n,rootNode:r}=t,o=ie(r),a=pe(r),s=new o.AbortController;return Pl(new Promise(i=>{let c=e();if(c){i(c);return}let u=new o.MutationObserver(()=>{let f=e();f&&f.isConnected&&(u.disconnect(),i(f))});u.observe(a.body,{childList:!0,subtree:!0})}),s,n)}function gs(e,t,n={}){let{defer:r,onMissing:o}=n,a=()=>typeof e=="function"?e():e,s=[],i=c=>{if(!c)return o==null?void 0:o();s.push(t(c))};if(!r)i(a());else{let c=!1;s.push(()=>{c=!0}),queueMicrotask(()=>{if(c)return;let u=a();if(u){i(u);return}s.push(re(()=>{c||i(a())}))})}return()=>{s.forEach(c=>c==null?void 0:c())}}var ps=["top","right","bottom","left"];var De=Math.min,$e=Math.max,Xt=Math.round,Jt=Math.floor,Ae=e=>({x:e,y:e}),Rl={left:"right",right:"left",bottom:"top",top:"bottom"};function mo(e,t,n){return $e(e,De(t,n))}function Oe(e,t){return typeof e=="function"?e(t):e}function Le(e){return e.split("-")[0]}function st(e){return e.split("-")[1]}function Kn(e){return e==="x"?"y":"x"}function qn(e){return e==="y"?"height":"width"}function xe(e){let t=e[0];return t==="t"||t==="b"?"y":"x"}function Zn(e){return Kn(xe(e))}function ys(e,t,n){n===void 0&&(n=!1);let r=st(e),o=Zn(e),a=qn(o),s=o==="x"?r===(n?"end":"start")?"right":"left":r==="start"?"bottom":"top";return t.reference[a]>t.floating[a]&&(s=zt(s)),[s,zt(s)]}function vs(e){let t=zt(e);return[jn(e),t,jn(t)]}function jn(e){return e.includes("start")?e.replace("start","end"):e.replace("end","start")}var ms=["left","right"],hs=["right","left"],Cl=["top","bottom"],Il=["bottom","top"];function Ml(e,t,n){switch(e){case"top":case"bottom":return n?t?hs:ms:t?ms:hs;case"left":case"right":return t?Cl:Il;default:return[]}}function bs(e,t,n,r){let o=st(e),a=Ml(Le(e),n==="start",r);return o&&(a=a.map(s=>s+"-"+o),t&&(a=a.concat(a.map(jn)))),a}function zt(e){let t=Le(e);return Rl[t]+e.slice(t.length)}function Vl(e){var t,n,r,o;return{top:(t=e.top)!=null?t:0,right:(n=e.right)!=null?n:0,bottom:(r=e.bottom)!=null?r:0,left:(o=e.left)!=null?o:0}}function ho(e){return typeof e!="number"?Vl(e):{top:e,right:e,bottom:e,left:e}}function it(e){let{x:t,y:n,width:r,height:o}=e;return{width:r,height:o,top:n,left:t,right:t+r,bottom:n+o,x:t,y:n}}function ws(e,t,n){let{reference:r,floating:o}=e,a=xe(t),s=Zn(t),i=qn(s),c=Le(t),u=a==="y",f=r.x+r.width/2-o.width/2,h=r.y+r.height/2-o.height/2,p=r[i]/2-o[i]/2,g;switch(c){case"top":g={x:f,y:r.y-o.height};break;case"bottom":g={x:f,y:r.y+r.height};break;case"right":g={x:r.x+r.width,y:h};break;case"left":g={x:r.x-o.width,y:h};break;default:g={x:r.x,y:r.y}}let d=st(t);return d&&(g[s]+=p*(d==="end"?1:-1)*(n&&u?-1:1)),g}async function Es(e,t){var n;t===void 0&&(t={});let{x:r,y:o,platform:a,rects:s,elements:i,strategy:c}=e,{boundary:u="clippingAncestors",rootBoundary:f="viewport",elementContext:h="floating",altBoundary:p=!1,padding:g=0}=Oe(t,e),d=ho(g),b=i[p?h==="floating"?"reference":"floating":h],y=it(await a.getClippingRect({element:(n=await(a.isElement==null?void 0:a.isElement(b)))==null||n?b:b.contextElement||await(a.getDocumentElement==null?void 0:a.getDocumentElement(i.floating)),boundary:u,rootBoundary:f,strategy:c})),A=h==="floating"?{x:r,y:o,width:s.floating.width,height:s.floating.height}:s.reference,D=await(a.getOffsetParent==null?void 0:a.getOffsetParent(i.floating)),$=await(a.isElement==null?void 0:a.isElement(D))&&await(a.getScale==null?void 0:a.getScale(D))||{x:1,y:1},E=it(a.convertOffsetParentRelativeRectToViewportRelativeRect?await a.convertOffsetParentRelativeRectToViewportRelativeRect({elements:i,rect:A,offsetParent:D,strategy:c}):A);return{top:(y.top-E.top+d.top)/$.y,bottom:(E.bottom-y.bottom+d.bottom)/$.y,left:(y.left-E.left+d.left)/$.x,right:(E.right-y.right+d.right)/$.x}}var kl=50,Ts=async(e,t,n)=>{let{placement:r="bottom",strategy:o="absolute",middleware:a=[],platform:s}=n,i=s.detectOverflow?s:I(R({},s),{detectOverflow:Es}),c=await(s.isRTL==null?void 0:s.isRTL(t)),u=await s.getElementRects({reference:e,floating:t,strategy:o}),{x:f,y:h}=ws(u,r,c),p=r,g=0,d={};for(let l=0;l<a.length;l++){let b=a[l];if(!b)continue;let{name:y,fn:A}=b,{x:D,y:$,data:E,reset:P}=await A({x:f,y:h,initialPlacement:r,placement:p,strategy:o,middlewareData:d,rects:u,platform:i,elements:{reference:e,floating:t}});f=D!=null?D:f,h=$!=null?$:h,d[y]=R(R({},d[y]),E),P&&g<kl&&(g++,typeof P=="object"&&(P.placement&&(p=P.placement),P.rects&&(u=P.rects===!0?await s.getElementRects({reference:e,floating:t,strategy:o}):P.rects),{x:f,y:h}=ws(u,p,c)),l=-1)}return{x:f,y:h,placement:p,strategy:o,middlewareData:d}},Ss=e=>({name:"arrow",options:e,async fn(t){let{x:n,y:r,placement:o,rects:a,platform:s,elements:i,middlewareData:c}=t,{element:u,padding:f=0}=Oe(e,t)||{};if(u==null)return{};let h=ho(f),p={x:n,y:r},g=Zn(o),d=qn(g),l=await s.getDimensions(u),b=g==="y",y=b?"top":"left",A=b?"bottom":"right",D=b?"clientHeight":"clientWidth",$=a.reference[d]+a.reference[g]-p[g]-a.floating[d],E=p[g]-a.reference[g],P=await(s.getOffsetParent==null?void 0:s.getOffsetParent(u)),O=P?P[D]:0;(!O||!await(s.isElement==null?void 0:s.isElement(P)))&&(O=i.floating[D]||a.floating[d]);let C=$/2-E/2,T=O/2-l[d]/2-1,S=De(h[y],T),V=De(h[A],T),L=O-l[d]-V,F=O/2-l[d]/2+C,q=mo(S,F,L),H=!c.arrow&&st(o)!=null&&F!==q&&a.reference[d]/2-(F<S?S:V)-l[d]/2<0,oe=H?F<S?F-S:F-L:0;return{[g]:p[g]+oe,data:R({[g]:q,centerOffset:F-q-oe},H&&{alignmentOffset:oe}),reset:H}}});var Ds=function(e){return e===void 0&&(e={}),{name:"flip",options:e,async fn(t){var n,r;let{placement:o,middlewareData:a,rects:s,initialPlacement:i,platform:c,elements:u}=t,q=Oe(e,t),{mainAxis:f=!0,crossAxis:h=!0,fallbackPlacements:p,fallbackStrategy:g="bestFit",fallbackAxisSideDirection:d="none",flipAlignment:l=!0}=q,b=Se(q,["mainAxis","crossAxis","fallbackPlacements","fallbackStrategy","fallbackAxisSideDirection","flipAlignment"]);if((n=a.arrow)!=null&&n.alignmentOffset)return{};let y=Le(o),A=xe(i),D=Le(i)===i,$=await(c.isRTL==null?void 0:c.isRTL(u.floating)),E=p||(D||!l?[zt(i)]:vs(i)),P=d!=="none";!p&&P&&E.push(...bs(i,l,d,$));let O=[i,...E],C=await c.detectOverflow(t,b),T=[],S=((r=a.flip)==null?void 0:r.overflows)||[];if(f&&T.push(C[y]),h){let H=ys(o,s,$);T.push(C[H[0]],C[H[1]])}if(S=[...S,{placement:o,overflows:T}],!T.every(H=>H<=0)){var V,L;let H=(((V=a.flip)==null?void 0:V.index)||0)+1,oe=O[H];if(oe&&(!(h==="alignment"?A!==xe(oe):!1)||S.every(W=>xe(W.placement)===A?W.overflows[0]>0:!0)))return{data:{index:H,overflows:S},reset:{placement:oe}};let Q=(L=S.filter(de=>de.overflows[0]<=0).sort((de,W)=>de.overflows[1]-W.overflows[1])[0])==null?void 0:L.placement;if(!Q)switch(g){case"bestFit":{var F;let de=(F=S.filter(W=>{if(P){let k=xe(W.placement);return k===A||k==="y"}return!0}).map(W=>[W.placement,W.overflows.filter(k=>k>0).reduce((k,B)=>k+B,0)]).sort((W,k)=>W[1]-k[1])[0])==null?void 0:F[0];de&&(Q=de);break}case"initialPlacement":Q=i;break}if(o!==Q)return{reset:{placement:Q}}}return{}}}};function $s(e,t){return{top:e.top-t.height,right:e.right-t.width,bottom:e.bottom-t.height,left:e.left-t.width}}function xs(e){return ps.some(t=>e[t]>=0)}var As=function(e){return e===void 0&&(e={}),{name:"hide",options:e,async fn(t){let{rects:n,platform:r}=t,s=Oe(e,t),{strategy:o="referenceHidden"}=s,a=Se(s,["strategy"]);switch(o){case"referenceHidden":{let i=await r.detectOverflow(t,I(R({},a),{elementContext:"reference"})),c=$s(i,n.reference);return{data:{referenceHiddenOffsets:c,referenceHidden:xs(c)}}}case"escaped":{let i=await r.detectOverflow(t,I(R({},a),{altBoundary:!0})),c=$s(i,n.floating);return{data:{escapedOffsets:c,escaped:xs(c)}}}default:return{}}}}};var Os=new Set(["left","top"]);async function Ll(e,t){let{placement:n,platform:r,elements:o}=e,a=await(r.isRTL==null?void 0:r.isRTL(o.floating)),s=Le(n),i=st(n),c=xe(n)==="y",u=Os.has(s)?-1:1,f=a&&c?-1:1,h=Oe(t,e),{mainAxis:p,crossAxis:g,alignmentAxis:d}=typeof h=="number"?{mainAxis:h,crossAxis:0,alignmentAxis:null}:{mainAxis:h.mainAxis||0,crossAxis:h.crossAxis||0,alignmentAxis:h.alignmentAxis};return i&&typeof d=="number"&&(g=i==="end"?d*-1:d),c?{x:g*f,y:p*u}:{x:p*u,y:g*f}}var Ps=function(e){return e===void 0&&(e=0),{name:"offset",options:e,async fn(t){var n,r;let{x:o,y:a,placement:s,middlewareData:i}=t,c=await Ll(t,e);return s===((n=i.offset)==null?void 0:n.placement)&&(r=i.arrow)!=null&&r.alignmentOffset?{}:{x:o+c.x,y:a+c.y,data:I(R({},c),{placement:s})}}}},Rs=function(e){return e===void 0&&(e={}),{name:"shift",options:e,async fn(t){let{x:n,y:r,placement:o,platform:a}=t,A=Oe(e,t),{mainAxis:s=!0,crossAxis:i=!1,limiter:c={fn:D=>{let{x:$,y:E}=D;return{x:$,y:E}}}}=A,u=Se(A,["mainAxis","crossAxis","limiter"]),f={x:n,y:r},h=await a.detectOverflow(t,u),p=xe(o),g=Kn(p),d=f[g],l=f[p],b=(D,$)=>mo($+h[D==="y"?"top":"left"],$,$-h[D==="y"?"bottom":"right"]);s&&(d=b(g,d)),i&&(l=b(p,l));let y=c.fn(I(R({},t),{[g]:d,[p]:l}));return I(R({},y),{data:{x:y.x-n,y:y.y-r,enabled:{[g]:s,[p]:i}}})}}},Cs=function(e){return e===void 0&&(e={}),{options:e,fn(t){var n,r;let{x:o,y:a,placement:s,rects:i,middlewareData:c}=t,{offset:u=0,mainAxis:f=!0,crossAxis:h=!0}=Oe(e,t),p={x:o,y:a},g=xe(s),d=Kn(g),l=p[d],b=p[g],y=Oe(u,t),A=typeof y=="number"?{mainAxis:y,crossAxis:0}:{mainAxis:(n=y.mainAxis)!=null?n:0,crossAxis:(r=y.crossAxis)!=null?r:0};if(f){let E=d==="y"?"height":"width",P=i.reference[d]-i.floating[E]+A.mainAxis,O=i.reference[d]+i.reference[E]-A.mainAxis;l<P?l=P:l>O&&(l=O)}if(h){var D,$;let E=d==="y"?"width":"height",P=Os.has(Le(s)),O=i.reference[g]-i.floating[E]+(P&&((D=c.offset)==null?void 0:D[g])||0)+(P?0:A.crossAxis),C=i.reference[g]+i.reference[E]+(P?0:(($=c.offset)==null?void 0:$[g])||0)-(P?A.crossAxis:0);b<O?b=O:b>C&&(b=C)}return{[d]:l,[g]:b}}}},Is=function(e){return e===void 0&&(e={}),{name:"size",options:e,async fn(t){let{placement:n,rects:r,platform:o,elements:a}=t,T=Oe(e,t),{apply:s=()=>{}}=T,i=Se(T,["apply"]),c=await o.detectOverflow(t,i),u=Le(n),f=st(n),h=xe(n)==="y",{width:p,height:g}=r.floating,d,l;u==="top"||u==="bottom"?(d=u,l=f===(await(o.isRTL==null?void 0:o.isRTL(a.floating))?"start":"end")?"left":"right"):(l=u,d=f==="end"?"top":"bottom");let b=g-c.top-c.bottom,y=p-c.left-c.right,A=De(g-c[d],b),D=De(p-c[l],y),$=t.middlewareData.shift,E=!$,P=A,O=D;$!=null&&$.enabled.x&&(O=y),$!=null&&$.enabled.y&&(P=b),E&&!f&&(h?O=p-2*$e(c.left,c.right):P=g-2*$e(c.top,c.bottom)),await s(I(R({},t),{availableWidth:O,availableHeight:P}));let C=await o.getDimensions(a.floating);return p!==C.width||g!==C.height?{reset:{rects:!0}}:{}}}};function Gn(){return typeof window!="undefined"}function lt(e){return Vs(e)?(e.nodeName||"").toLowerCase():"#document"}function ce(e){var t;return(e==null||(t=e.ownerDocument)==null?void 0:t.defaultView)||window}function Pe(e){var t;return(t=(Vs(e)?e.ownerDocument:e.document)||window.document)==null?void 0:t.documentElement}function Vs(e){return Gn()?e instanceof Node||e instanceof ce(e).Node:!1}function Ee(e){return Gn()?e instanceof Element||e instanceof ce(e).Element:!1}function Ne(e){return Gn()?e instanceof HTMLElement||e instanceof ce(e).HTMLElement:!1}function Ms(e){return!Gn()||typeof ShadowRoot=="undefined"?!1:e instanceof ShadowRoot||e instanceof ce(e).ShadowRoot}function Qt(e){let{overflow:t,overflowX:n,overflowY:r,display:o}=Te(e);return/auto|scroll|overlay|hidden|clip/.test(t+r+n)&&o!=="inline"&&o!=="contents"}function ks(e){return/^(table|td|th)$/.test(lt(e))}function en(e){try{if(e.matches(":popover-open"))return!0}catch(t){}try{return e.matches(":modal")}catch(t){return!1}}var Nl=/transform|translate|scale|rotate|perspective|filter/,Fl=/paint|layout|strict|content/,ct=e=>!!e&&e!=="none",po;function zn(e){let t=Ee(e)?Te(e):e;return ct(t.transform)||ct(t.translate)||ct(t.scale)||ct(t.rotate)||ct(t.perspective)||!Xn()&&(ct(t.backdropFilter)||ct(t.filter))||Nl.test(t.willChange||"")||Fl.test(t.contain||"")}function Ls(e){let t=qe(e);for(;Ne(t)&&!Ot(t);){if(zn(t))return t;if(en(t))return null;t=qe(t)}return null}function Xn(){return po==null&&(po=typeof CSS!="undefined"&&CSS.supports&&CSS.supports("-webkit-backdrop-filter","none")),po}function Ot(e){return/^(html|body|#document)$/.test(lt(e))}function Te(e){return ce(e).getComputedStyle(e)}function tn(e){return Ee(e)?{scrollLeft:e.scrollLeft,scrollTop:e.scrollTop}:{scrollLeft:e.scrollX,scrollTop:e.scrollY}}function qe(e){if(lt(e)==="html")return e;let t=e.assignedSlot||e.parentNode||Ms(e)&&e.host||Pe(e);return Ms(t)?t.host:t}function Ns(e){let t=qe(e);return Ot(t)?(e.ownerDocument||e).body:Ne(t)&&Qt(t)?t:Ns(t)}function At(e,t,n){var r;t===void 0&&(t=[]),n===void 0&&(n=!0);let o=Ns(e),a=o===((r=e.ownerDocument)==null?void 0:r.body),s=ce(o);if(a){let i=Jn(s);return t.concat(s,s.visualViewport||[],Qt(o)?o:[],i&&n?At(i):[])}else return t.concat(o,At(o,[],n))}function Jn(e){return e.parent&&Object.getPrototypeOf(e.parent)?e.frameElement:null}function _s(e){let t=Te(e),n=parseFloat(t.width)||0,r=parseFloat(t.height)||0,o=Ne(e),a=o?e.offsetWidth:n,s=o?e.offsetHeight:r,i=Xt(n)!==a||Xt(r)!==s;return i&&(n=a,r=s),{width:n,height:r,$:i}}function vo(e){return Ee(e)?e:e.contextElement}function Pt(e){let t=vo(e);if(!Ne(t))return Ae(1);let n=t.getBoundingClientRect(),{width:r,height:o,$:a}=_s(t),s=(a?Xt(n.width):n.width)/r,i=(a?Xt(n.height):n.height)/o;return(!s||!Number.isFinite(s))&&(s=1),(!i||!Number.isFinite(i))&&(i=1),{x:s,y:i}}var Bl=Ae(0);function Ws(e){let t=ce(e);return!Xn()||!t.visualViewport?Bl:{x:t.visualViewport.offsetLeft,y:t.visualViewport.offsetTop}}function _l(e,t,n){return t===void 0&&(t=!1),!!n&&t&&n===ce(e)}function ut(e,t,n,r){t===void 0&&(t=!1),n===void 0&&(n=!1);let o=e.getBoundingClientRect(),a=vo(e),s=Ae(1);t&&(r?Ee(r)&&(s=Pt(r)):s=Pt(e));let i=_l(a,n,r)?Ws(a):Ae(0),c=(o.left+i.x)/s.x,u=(o.top+i.y)/s.y,f=o.width/s.x,h=o.height/s.y;if(a&&r){let p=ce(a),g=Ee(r)?ce(r):r,d=p,l=Jn(d);for(;l&&g!==d;){let b=Pt(l),y=l.getBoundingClientRect(),A=Te(l),D=y.left+(l.clientLeft+parseFloat(A.paddingLeft))*b.x,$=y.top+(l.clientTop+parseFloat(A.paddingTop))*b.y;c*=b.x,u*=b.y,f*=b.x,h*=b.y,c+=D,u+=$,d=ce(l),l=Jn(d)}}return it({width:f,height:h,x:c,y:u})}function Qn(e,t){let n=tn(e).scrollLeft;return t?t.left+n:ut(Pe(e)).left+n}function Ys(e,t){let n=e.getBoundingClientRect(),r=n.left+t.scrollLeft-Qn(e,n),o=n.top+t.scrollTop;return{x:r,y:o}}function Wl(e){let{elements:t,rect:n,offsetParent:r,strategy:o}=e,a=o==="fixed",s=Pe(r),i=t?en(t.floating):!1;if(r===s||i&&a)return n;let c={scrollLeft:0,scrollTop:0},u=Ae(1),f=Ae(0),h=Ne(r);if((h||!a)&&((lt(r)!=="body"||Qt(s))&&(c=tn(r)),h)){let g=ut(r);u=Pt(r),f.x=g.x+r.clientLeft,f.y=g.y+r.clientTop}let p=s&&!h&&!a?Ys(s,c):Ae(0);return{width:n.width*u.x,height:n.height*u.y,x:n.x*u.x-c.scrollLeft*u.x+f.x+p.x,y:n.y*u.y-c.scrollTop*u.y+f.y+p.y}}function Yl(e){return e.getClientRects?Array.from(e.getClientRects()):[]}function Hl(e){let t=tn(e),n=e.ownerDocument.body,r=$e(e.scrollWidth,e.clientWidth,n.scrollWidth,n.clientWidth),o=$e(e.scrollHeight,e.clientHeight,n.scrollHeight,n.clientHeight),a=-t.scrollLeft+Qn(e),s=-t.scrollTop;return Te(n).direction==="rtl"&&(a+=$e(e.clientWidth,n.clientWidth)-r),{width:r,height:o,x:a,y:s}}var Ul=25;function jl(e,t,n){n===void 0&&(n="viewport");let r=n==="layoutViewport",o=ce(e),a=Pe(e),s=o.visualViewport,i=a.clientWidth,c=a.clientHeight,u=0,f=0;if(s){let p=!Xn()||t==="fixed";r?p||(u=-s.offsetLeft,f=-s.offsetTop):(i=s.width,c=s.height,p&&(u=s.offsetLeft,f=s.offsetTop))}if(Qn(a)<=0){let p=a.ownerDocument,g=p.body,d=getComputedStyle(g),l=p.compatMode==="CSS1Compat"&&parseFloat(d.marginLeft)+parseFloat(d.marginRight)||0,b=Math.abs(a.clientWidth-g.clientWidth-l),y=getComputedStyle(a).scrollbarGutter==="stable both-edges"?b/2:b;y<=Ul&&(i-=y)}return{width:i,height:c,x:u,y:f}}function Kl(e,t){let n=ut(e,!0,t==="fixed"),r=n.top+e.clientTop,o=n.left+e.clientLeft,a=Pt(e),s=e.clientWidth*a.x,i=e.clientHeight*a.y,c=o*a.x,u=r*a.y;return{width:s,height:i,x:c,y:u}}function Fs(e,t,n){let r;if(t==="viewport"||t==="layoutViewport")r=jl(e,n,t);else if(t==="document")r=Hl(Pe(e));else if(Ee(t))r=Kl(t,n);else{let o=Ws(e);r={x:t.x-o.x,y:t.y-o.y,width:t.width,height:t.height}}return it(r)}function ql(e,t){let n=t.get(e);if(n)return n;let r=At(e,[],!1).filter(i=>Ee(i)&&lt(i)!=="body"),o=null,a=Te(e).position==="fixed",s=a?qe(e):e;for(;Ee(s)&&!Ot(s);){let i=Te(s),c=zn(s),u=o?o.position:a?"fixed":"";!c&&(u==="fixed"||u==="absolute"&&i.position==="static")?r=r.filter(h=>h!==s):o=i,s=qe(s)}return t.set(e,r),r}function Zl(e){let{element:t,boundary:n,rootBoundary:r,strategy:o}=e,s=[...n==="clippingAncestors"?en(t)?[]:ql(t,this._c):[].concat(n),r],i=Fs(t,s[0],o),c=i.top,u=i.right,f=i.bottom,h=i.left;for(let p=1;p<s.length;p++){let g=Fs(t,s[p],o);c=$e(g.top,c),u=De(g.right,u),f=De(g.bottom,f),h=$e(g.left,h)}return{width:u-h,height:f-c,x:h,y:c}}function Gl(e){let{width:t,height:n}=_s(e);return{width:t,height:n}}function zl(e,t,n){let r=Ne(t),o=Pe(t),a=n==="fixed",s=ut(e,!0,a,t),i={scrollLeft:0,scrollTop:0},c=Ae(0);if((r||!a)&&((lt(t)!=="body"||Qt(o))&&(i=tn(t)),r)){let p=ut(t,!0,a,t);c.x=p.x+t.clientLeft,c.y=p.y+t.clientTop}!r&&o&&(c.x=Qn(o));let u=o&&!r&&!a?Ys(o,i):Ae(0),f=s.left+i.scrollLeft-c.x-u.x,h=s.top+i.scrollTop-c.y-u.y;return{x:f,y:h,width:s.width,height:s.height}}function yo(e){return Te(e).position==="static"}function Bs(e,t){if(!Ne(e)||Te(e).position==="fixed")return null;if(t)return t(e);let n=e.offsetParent;return Pe(e)===n&&(n=n.ownerDocument.body),n}function Hs(e,t){let n=ce(e);if(en(e))return n;if(!Ne(e)){let o=qe(e);for(;o&&!Ot(o);){if(Ee(o)&&!yo(o))return o;o=qe(o)}return n}let r=Bs(e,t);for(;r&&ks(r)&&yo(r);)r=Bs(r,t);return r&&Ot(r)&&yo(r)&&!zn(r)?n:r||Ls(e)||n}var Xl=async function(e){let t=this.getOffsetParent||Hs,n=this.getDimensions,r=await n(e.floating);return{reference:zl(e.reference,await t(e.floating),e.strategy),floating:{x:0,y:0,width:r.width,height:r.height}}};function Jl(e){return Te(e).direction==="rtl"}var Ql={convertOffsetParentRelativeRectToViewportRelativeRect:Wl,getDocumentElement:Pe,getClippingRect:Zl,getOffsetParent:Hs,getElementRects:Xl,getClientRects:Yl,getDimensions:Gl,getScale:Pt,isElement:Ee,isRTL:Jl};function Us(e,t){return e.x===t.x&&e.y===t.y&&e.width===t.width&&e.height===t.height}function eu(e,t,n){let r=null,o,a=Pe(e);function s(){var f;clearTimeout(o),(f=r)==null||f.disconnect(),r=null}function i(f,h){f===void 0&&(f=!1),h===void 0&&(h=1),s();let p=e.getBoundingClientRect(),{left:g,top:d,width:l,height:b}=p;if(f||t(),!l||!b)return;let y=Jt(d),A=Jt(a.clientWidth-(g+l)),D=Jt(a.clientHeight-(d+b)),$=Jt(g),P={rootMargin:-y+"px "+-A+"px "+-D+"px "+-$+"px",threshold:$e(0,De(1,h))||1},O=!0;function C(T){let S=T[0].intersectionRatio;if(!Us(p,e.getBoundingClientRect()))return i();if(S!==h){if(!O)return i();S?i(!1,S):o=setTimeout(()=>{i(!1,1e-7)},1e3)}O=!1}try{r=new IntersectionObserver(C,I(R({},P),{root:a.ownerDocument}))}catch(T){r=new IntersectionObserver(C,P)}r.observe(e)}let c=ce(e),u=()=>i(n);return c.addEventListener("resize",u),i(!0),()=>{c.removeEventListener("resize",u),s()}}function js(e,t,n,r){r===void 0&&(r={});let{ancestorScroll:o=!0,ancestorResize:a=!0,elementResize:s=typeof ResizeObserver=="function",layoutShift:i=typeof IntersectionObserver=="function",animationFrame:c=!1}=r,u=vo(e),f=o||a?[...u?At(u):[],...t?At(t):[]]:[];f.forEach(y=>{o&&y.addEventListener("scroll",n),a&&y.addEventListener("resize",n)});let h=u&&i?eu(u,n,a):null,p=-1,g=null;s&&(g=new ResizeObserver(y=>{let[A]=y;A&&A.target===u&&g&&t&&(g.unobserve(t),cancelAnimationFrame(p),p=requestAnimationFrame(()=>{var D;(D=g)==null||D.observe(t)})),n()}),u&&!c&&g.observe(u),t&&g.observe(t));let d,l=c?ut(e):null;c&&b();function b(){let y=ut(e);l&&!Us(l,y)&&n(),l=y,d=requestAnimationFrame(b)}return n(),()=>{var y;f.forEach(A=>{o&&A.removeEventListener("scroll",n),a&&A.removeEventListener("resize",n)}),h==null||h(),(y=g)==null||y.disconnect(),g=null,c&&cancelAnimationFrame(d)}}var Ks=Ps;var qs=Rs,Zs=Ds,Gs=Is,zs=As,Xs=Ss;var Js=Cs,Qs=(e,t,n)=>{let r=new Map,o=n!=null?n:{},a=I(R(R({},Ql),o.platform),{_c:r});return Ts(e,t,I(R({},o),{platform:a}))};function ei(e){return e==null?[]:Array.isArray(e)?e:[e]}var tu=e=>e[e.length-1];function bo(e,t){return e.reduce((n,r,o)=>{var a;return o%t===0?n.push([r]):(a=tu(n))==null||a.push(r),n},[])}var ti=e=>(e==null?void 0:e.constructor.name)==="Array",nu=(e,t)=>{if(e.length!==t.length)return!1;for(let n=0;n<e.length;n++)if(!Rt(e[n],t[n]))return!1;return!0},Rt=(e,t)=>{if(Object.is(e,t))return!0;if(e==null&&t!=null||e!=null&&t==null)return!1;if(typeof(e==null?void 0:e.isEqual)=="function"&&typeof(t==null?void 0:t.isEqual)=="function")return e.isEqual(t);if(typeof e=="function"&&typeof t=="function")return e.toString()===t.toString();if(ti(e)&&ti(t))return nu(Array.from(e),Array.from(t));if(typeof e!="object"||typeof t!="object")return!1;let n=Object.keys(t!=null?t:Object.create(null)),r=n.length;if(Object.keys(e).length!==r)return!1;for(let o=0;o<r;o++)if(!Reflect.has(e,n[o]))return!1;for(let o=0;o<r;o++){let a=n[o];if(!Rt(e[a],t[a]))return!1}return!0};var ru=e=>e!=null&&typeof e=="object";var ni=e=>typeof e=="string",Fe=e=>typeof e=="function",ri=e=>e==null,ou=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),au=e=>Object.prototype.toString.call(e),oi=Function.prototype.toString,su=oi.call(Object),dt=e=>{if(!ru(e)||au(e)!="[object Object]"||lu(e))return!1;let t=Object.getPrototypeOf(e);if(t===null)return!0;let n=ou(t,"constructor")&&t.constructor;return typeof n=="function"&&n instanceof n&&oi.call(n)==su},iu=e=>typeof e=="object"&&e!==null&&"$$typeof"in e&&"props"in e,cu=e=>typeof e=="object"&&e!==null&&"__v_isVNode"in e,lu=e=>iu(e)||cu(e);var nn=(e,...t)=>{let n=typeof e=="function"?e(...t):e;return n!=null?n:void 0};var ai=e=>e(),wo=()=>{},Ct=(...e)=>(...t)=>{e.forEach(function(n){n==null||n(...t)})};function er(e,t,...n){var o;if(e in t){let a=t[e];return Fe(a)?a(...n):a}let r=new Error(`No matching key: ${JSON.stringify(e)} in ${JSON.stringify(Object.keys(t))}`);throw(o=Error.captureStackTrace)==null||o.call(Error,r,er),r}var{floor:Nm,abs:Fm,round:Bm,min:uu,max:du,pow:_m,sign:Wm}=Math,fu=e=>Number.isNaN(e),si=e=>fu(e)?0:e;var tr=(e,t,n)=>{let r=si(e),o=t==null||r>=t,a=n==null||r<=n;return o&&a};var ii=(e,t,n)=>uu(du(si(e),t),n);function rn(e){if(!dt(e)||e===void 0)return e;let t=Reflect.ownKeys(e).filter(r=>typeof r=="string"),n={};for(let r of t){let o=e[r];o!==void 0&&(n[r]=rn(o))}return n}function ci(e,t){if(!t)return e;let n=R({},e),r=t;for(let o in r){let a=r[o];a!==void 0&&(n[o]=a)}return n}function It(...e){let t=e.length===1?e[0]:e[1],n=e.length===2?e[0]:!0}function $o(...e){let t=e.length===1?e[0]:e[1],n=e.length===2?e[0]:!0}function on(e,t){if(e==null)throw new Error(t())}function li(e=0,t=0,n=0,r=0){if(typeof DOMRect=="function")return new DOMRect(e,t,n,r);let o={x:e,y:t,width:n,height:r,top:t,right:e+n,bottom:t+r,left:e};return I(R({},o),{toJSON:()=>o})}function gu(e){if(!e)return li();let{x:t,y:n,width:r,height:o}=e;return li(t,n,r,o)}function ui(e,t){return{contextElement:J(e)?e:e==null?void 0:e.contextElement,getBoundingClientRect:()=>{let n=e,r=t==null?void 0:t(n);return r||!n?gu(r):n.getBoundingClientRect()}}}var an=e=>({variable:e,reference:`var(${e})`}),Re={arrowSize:an("--arrow-size"),arrowSizeHalf:an("--arrow-size-half"),arrowBg:an("--arrow-background"),transformOrigin:an("--transform-origin"),arrowOffset:an("--arrow-offset")},mu=e=>e==="top"||e==="bottom"?"y":"x";function di(e,t){return{name:"transformOrigin",fn(n){var T,S,V,L,F;let{elements:r,middlewareData:o,placement:a,rects:s,y:i}=n,c=a.split("-")[0],u=mu(c),f=((T=o.arrow)==null?void 0:T.x)||0,h=((S=o.arrow)==null?void 0:S.y)||0,p=(t==null?void 0:t.clientWidth)||0,g=(t==null?void 0:t.clientHeight)||0,d=f+p/2,l=h+g/2,b=Math.abs(((V=o.shift)==null?void 0:V.y)||0),y=s.reference.height/2,A=g/2,D=(F=(L=e.offset)==null?void 0:L.mainAxis)!=null?F:e.gutter,$=typeof D=="number"?D+A:D!=null?D:A,E=b>$,P={top:`${d}px calc(100% + ${$}px)`,bottom:`${d}px ${-$}px`,left:`calc(100% + ${$}px) ${l}px`,right:`${-$}px ${l}px`}[c],O=`${d}px ${s.reference.y+y-i}px`,C=!!e.overlap&&u==="y"&&E;return r.floating.style.setProperty(Re.transformOrigin.variable,C?O:P),{data:{transformOrigin:C?O:P}}}}}var fi={name:"rects",fn({rects:e}){return{data:e}}},gi=e=>{if(e)return{name:"shiftArrow",fn({placement:t,middlewareData:n}){if(!n.arrow)return{};let{x:r,y:o}=n.arrow,a=t.split("-")[0];return Object.assign(e.style,{left:r!=null?`${r}px`:"",top:o!=null?`${o}px`:"",[a]:`calc(100% + ${Re.arrowOffset.reference})`}),{}}}};function mi(e){let[t,n]=e.split("-");return{side:t,align:n,hasAlign:n!=null}}function xo(e){return e.split("-")[0]}var hu={strategy:"absolute",placement:"bottom",listeners:!0,restoreStyles:!1,applyStyles:!0,gutter:8,flip:!0,slide:!0,overlap:!1,sameWidth:!1,fitViewport:!1,overflowPadding:8,arrowPadding:4};function hi(e,t){let n=e.devicePixelRatio||1;return Math.round(t*n)/n}function Mt(e,t){return e!=null&&Math.abs(e-t)<.5}function nr(e){return typeof e=="function"?e():e==="clipping-ancestors"?"clippingAncestors":e}function pu(e,t,n){let r=e||t.createElement("div");return Xs({element:r,padding:n.arrowPadding})}function yu(e,t){var n;if(!ri((n=t.offset)!=null?n:t.gutter))return Ks(({placement:r})=>{var f,h,p,g;let o=((e==null?void 0:e.clientHeight)||0)/2,a=(h=(f=t.offset)==null?void 0:f.mainAxis)!=null?h:t.gutter,s=typeof a=="number"?a+o:a!=null?a:o,{hasAlign:i}=mi(r),c=i?void 0:t.shift,u=(g=(p=t.offset)==null?void 0:p.crossAxis)!=null?g:c;return rn({crossAxis:u,mainAxis:s,alignmentAxis:t.shift})})}function vu(e){if(e.flip)return Zs(()=>{let t=nr(e.boundary);return I(R({},t?{boundary:t}:void 0),{padding:e.overflowPadding,fallbackPlacements:e.flip===!0?void 0:e.flip})})}function bu(e){if(!(!e.slide&&!e.overlap))return qs(()=>{let t=nr(e.boundary);return I(R({},t?{boundary:t}:void 0),{mainAxis:e.slide,crossAxis:e.overlap,padding:e.overflowPadding,limiter:Js()})})}function wu(e){if(e.sizeMiddleware===!1&&!e.sameWidth&&!e.fitViewport)return;let t,n,r,o;return Gs(()=>{let a=nr(e.boundary);return I(R({padding:e.overflowPadding},a?{boundary:a}:void 0),{apply({elements:s,rects:i,availableHeight:c,availableWidth:u}){let f=s.floating,h=Math.round(i.reference.width),p=Math.round(i.reference.height);u=Math.floor(u),c=Math.floor(c),Mt(t,h)||(f.style.setProperty("--reference-width",`${h}px`),t=h),Mt(n,p)||(f.style.setProperty("--reference-height",`${p}px`),n=p),Mt(r,u)||(f.style.setProperty("--available-width",`${u}px`),r=u),Mt(o,c)||(f.style.setProperty("--available-height",`${c}px`),o=c)}})})}function $u(e){if(e.hideWhenDetached)return zs(()=>{var t;return{strategy:"referenceHidden",boundary:(t=nr(e.boundary))!=null?t:"clippingAncestors"}})}function xu(e){return e?e===!0?{ancestorResize:!0,ancestorScroll:!0,elementResize:!0,layoutShift:!0}:e:{}}var Eu=["transform","visibility","pointer-events","--x","--y","--z-index","z-index","--reference-width","--reference-height","--available-width","--available-height","--transform-origin"],Tu=["top","right","bottom","left"],sn=new WeakSet;function Su(e,t){let n=e.style.getPropertyValue("z-index"),r=sn.has(e),o=r&&n==="var(--z-index)";r&&!o&&sn.delete(e);let a=Wn(t).zIndex;if(a==="auto"){o&&(e.style.removeProperty("z-index"),sn.delete(e));return}n&&!o||(e.style.setProperty("--z-index",a),e.style.setProperty("z-index","var(--z-index)"),sn.add(e))}function pi(e,t){if(!e)return wo;let n=new Map(t.map(r=>[r,e.style.getPropertyValue(r)]));return()=>{n.forEach((r,o)=>{r?e.style.setProperty(o,r):e.style.removeProperty(o)}),e.style.length===0&&e.removeAttribute("style")}}function yi(e){return e==null?null:J(e)?e:typeof e=="object"&&e&&"contextElement"in e&&e.contextElement?e.contextElement:e}function Du(e,t,n={}){let r=()=>{let S=typeof t=="function"?t():t;return S!=null?S:null},o=()=>{var V,L;let S=typeof e=="function"?e():e;return(L=(V=n.getAnchorElement)==null?void 0:V.call(n))!=null?L:S},a=()=>{let S=o();return!S&&!n.getAnchorRect?null:ui(S,n.getAnchorRect)},s=Object.assign({},hu,n),i=[],c=null,u,f;function h(S){if(u==null||u(),f==null||f(),c=S,s.restoreStyles){let L=pi(S,Eu);u=()=>{L(),sn.delete(S)}}else u=void 0;let V=S.querySelector("[data-part=arrow]");f=s.restoreStyles?pi(V,Tu):void 0,i=[yu(V,s),vu(s),bu(s),pu(V,S.ownerDocument,s),gi(V),di({gutter:s.gutter,offset:s.offset,overlap:s.overlap},V),wu(s),$u(s),fi]}let{placement:p,strategy:g,onComplete:d,onPositioned:l}=s,b,y,A=!1,D,$,E=wo,P=xu(s.listeners);function O(){if(!s.listeners)return;let S=o(),V=a(),L=r();if(!V||!L)return;(yi(S)!==yi(D)||L!==$)&&(E(),D=S,$=L,E=js(V,L,T,P))}async function C(){var oe;O();let S=r();if(!S)return;S!==c&&(h(S),A=!1);let V=a();if(!V)return;let L=await Qs(V,S,{placement:p,middleware:i,strategy:g}),F=ie(S),q=hi(F,L.x),H=hi(F,L.y);if(d==null||d(I(R({},L),{x:q,y:H})),s.applyStyles!==!1&&(Mt(b,q)||(S.style.setProperty("--x",`${q}px`),b=q),Mt(y,H)||(S.style.setProperty("--y",`${H}px`),y=H),s.hideWhenDetached&&(((oe=L.middlewareData.hide)==null?void 0:oe.referenceHidden)?(S.style.setProperty("visibility","hidden"),S.style.setProperty("pointer-events","none")):(S.style.removeProperty("visibility"),S.style.removeProperty("pointer-events"))),!A)){let Q=S.firstElementChild;Q&&(Su(S,Q),A=!0)}}async function T(){n.updatePosition?(await n.updatePosition({updatePosition:C,floatingElement:r()}),l==null||l({placed:!0})):await C()}return T(),()=>{E(),f==null||f(),u==null||u(),l==null||l({placed:!1})}}function Eo(e,t,n={}){let i=n,{defer:r}=i,o=Se(i,["defer"]),a=r?re:c=>c(),s=[];return s.push(a(()=>{s.push(Du(e,t,o))})),()=>{s.forEach(c=>c==null?void 0:c())}}var Au={bottom:"rotate(45deg)",left:"rotate(135deg)",top:"rotate(225deg)",right:"rotate(315deg)"};function To(e={}){let{placement:t,sameWidth:n,fitViewport:r,strategy:o="absolute",applyStyles:a=!0}=e;return{arrow:{position:"absolute",width:Re.arrowSize.reference,height:Re.arrowSize.reference,[Re.arrowSizeHalf.variable]:`calc(${Re.arrowSize.reference} / 2)`,[Re.arrowOffset.variable]:`calc(${Re.arrowSizeHalf.reference} * -1)`},arrowTip:{transform:t?Au[t.split("-")[0]]:void 0,background:Re.arrowBg.reference,top:"0",left:"0",width:"100%",height:"100%",position:"absolute",zIndex:"inherit"},floating:{position:o,isolation:"isolate",minWidth:n?void 0:"max-content",width:n?"var(--reference-width)":void 0,maxWidth:r?"var(--available-width)":void 0,maxHeight:r?"var(--available-height)":void 0,pointerEvents:t?void 0:"none",top:"0px",left:"0px",transform:t?"translate3d(var(--x), var(--y), 0)":"translate3d(0, -100vh, 0)",zIndex:a===!1?"var(--z-index)":void 0}}}var vi=(e,t)=>{var n,r,o;return(o=(r=(n=e.ids)==null?void 0:n.label)==null?void 0:r.call(n,t))!=null?o:`datepicker:${e.id}:label:${t}`},bi=e=>{var t,n;return(n=(t=e.ids)==null?void 0:t.root)!=null?n:`datepicker:${e.id}`},wi=(e,t)=>{var n,r,o;return(o=(r=(n=e.ids)==null?void 0:n.table)==null?void 0:r.call(n,t))!=null?o:`datepicker:${e.id}:table:${t}`};var rr=e=>{var t,n;return(n=(t=e.ids)==null?void 0:t.content)!=null?n:`datepicker:${e.id}:content`},or=(e,t)=>{var n,r,o;return(o=(r=(n=e.ids)==null?void 0:n.cellTrigger)==null?void 0:r.call(n,t))!=null?o:`datepicker:${e.id}:cell-trigger:${t}`},$i=(e,t)=>{var n,r,o;return(o=(r=(n=e.ids)==null?void 0:n.prevTrigger)==null?void 0:r.call(n,t))!=null?o:`datepicker:${e.id}:prev:${t}`},xi=(e,t)=>{var n,r,o;return(o=(r=(n=e.ids)==null?void 0:n.nextTrigger)==null?void 0:r.call(n,t))!=null?o:`datepicker:${e.id}:next:${t}`},Ei=(e,t)=>{var n,r,o;return(o=(r=(n=e.ids)==null?void 0:n.viewTrigger)==null?void 0:r.call(n,t))!=null?o:`datepicker:${e.id}:view:${t}`},So=e=>{var t,n;return(n=(t=e.ids)==null?void 0:t.clearTrigger)!=null?n:`datepicker:${e.id}:clear`},Do=e=>{var t,n;return(n=(t=e.ids)==null?void 0:t.control)!=null?n:`datepicker:${e.id}:control`},Ao=(e,t)=>{var n,r,o;return(o=(r=(n=e.ids)==null?void 0:n.input)==null?void 0:r.call(n,t))!=null?o:`datepicker:${e.id}:input:${t}`},Oo=e=>{var t,n;return(n=(t=e.ids)==null?void 0:t.trigger)!=null?n:`datepicker:${e.id}:trigger`},Po=e=>{var t,n;return(n=(t=e.ids)==null?void 0:t.positioner)!=null?n:`datepicker:${e.id}:positioner`},Ro=e=>{var t,n;return(n=(t=e.ids)==null?void 0:t.monthSelect)!=null?n:`datepicker:${e.id}:month-select`},Co=e=>{var t,n;return(n=(t=e.ids)==null?void 0:t.yearSelect)!=null?n:`datepicker:${e.id}:year-select`},Io=(e,t)=>us(ln(e),`[data-part=table-cell-trigger][data-view=${t}][data-focus]:not([data-outside-range])`),cn=e=>e.getById(Oo(e)),ln=e=>e.getById(rr(e)),Vt=e=>ls(Vo(e),"[data-part=input]"),Ti=e=>e.getById(Co(e)),Si=e=>e.getById(Ro(e)),Di=e=>e.getById(So(e)),Mo=e=>e.getById(Po(e)),Vo=e=>e.getById(Do(e));function Oi(e,t,n){let r=[],o;return a=>{var c;let s=e(a);return(s.length!==r.length||s.some((u,f)=>!Rt(r[f],u)))&&(r=s,o=t(s,a),(c=n==null?void 0:n.onChange)==null||c.call(n,o)),o}}function Pi(){let e=new Map;return{claim(t){let n=Symbol(t);return e.set(t,n),n},isReplaced(t,n){return e.get(t)!==n}}}var Ze=".",Ii="#",Ri=new WeakMap,Mi=new WeakMap;function ko(e){return e.join(Ze)}function Ou(e){return e.includes(Ze)}function Vi(e){return e.startsWith(Ii)}function Pu(e){return e.startsWith(Ze)}function Ru(e){return Vi(e)?e.slice(Ii.length):e}function Lo(e,t){return e?`${e}${Ze}${t}`:t}function Cu(e){let t=new Map,n=new Map,r=(o,a)=>{t.set(o,a);let s=a.id;s&&(n.has(s)&&$o(`[zag-js] Duplicate state id: "${s}"`),n.set(s,o));let i=a.states;if(i){on(a.initial,()=>`[zag-js] Compound state "${o}" has child states but no "initial" property`),a.initial in i||$o(`[zag-js] Compound state "${o}" has initial "${String(a.initial)}" which is not a child state`);for(let[c,u]of Object.entries(i)){if(!u)continue;let f=Lo(o,c);r(f,u)}}};for(let[o,a]of Object.entries(e.states))a&&r(o,a);return{index:t,idIndex:n}}function kt(e){let t=Ri.get(e);if(t)return t;let{index:n,idIndex:r}=Cu(e);return Ri.set(e,n),Mi.set(e,r),n}function Iu(e,t){var n;return kt(e),(n=Mi.get(e))==null?void 0:n.get(t)}function No(e){return e?String(e).split(Ze).filter(Boolean):[]}function ar(e,t){if(!t)return[];let n=kt(e),r=No(t),o=[],a=[];for(let s of r){a.push(s);let i=ko(a),c=n.get(i);if(!c)break;o.push({path:i,state:c})}return o}function un(e,t){let n=kt(e),r=No(t);if(!r.length)return t;let o=[];for(let i of r){o.push(i);let c=ko(o);if(!n.has(c))return t}let a=ko(o),s=n.get(a);for(;s!=null&&s.initial;){let i=`${a}${Ze}${s.initial}`,c=n.get(i);if(!c)break;a=i,s=c}return a}function Ci(e,t){return kt(e).has(t)}function Fo(e,t,n){let r=String(t);if(Vi(r)){let o=Ru(r),a=Iu(e,o);return on(a,()=>`[zag-js] Unknown state id: "${o}"`),un(e,a)}if(Pu(r)&&n){let o=Lo(n,r.slice(1));return un(e,o)}if(!Ou(r)&&n){let o=No(n);for(let a=o.length-1;a>=1;a--){let s=o.slice(0,a).join(Ze),i=Lo(s,r);if(Ci(e,i))return un(e,i)}if(Ci(e,r))return un(e,r)}return un(e,r)}function ki(e,t,n){var a,s;let r=ar(e,t);for(let i=r.length-1;i>=0;i--){let c=(a=r[i])==null?void 0:a.state.on,u=c==null?void 0:c[n];if(u)return{transitions:u,source:(s=r[i])==null?void 0:s.path}}let o=e.on;return{transitions:o==null?void 0:o[n],source:void 0}}function Li(e,t,n,r){var f,h,p,g;let o=t?ar(e,t):[],a=ar(e,n),s=0;for(;s<o.length&&s<a.length&&((f=o[s])==null?void 0:f.path)===((h=a[s])==null?void 0:h.path);)s+=1;let i=o.slice(s).reverse(),c=a.slice(s),u=((p=o[o.length-1])==null?void 0:p.path)===((g=a[a.length-1])==null?void 0:g.path);return r&&u&&(i=o.slice().reverse(),c=a),{exiting:i,entering:c}}function Ni(e,t){return e?e===t||e.startsWith(`${t}${Ze}`):!1}function Fi(e,t,n){return ar(e,t).some(r=>{var o;return(o=r.state.tags)==null?void 0:o.includes(n)})}function Bi(){return{and:(...e)=>function(n){return e.every(r=>n.guard(r))},or:(...e)=>function(n){return e.some(r=>n.guard(r))},not:e=>function(n){return!n.guard(e)}}}function _i(e){return kt(e),e}var Lt=(e=>(e.NotStarted="Not Started",e.Started="Started",e.Stopped="Stopped",e))(Lt||{}),dn="__init__";function Wi(e){let t=()=>{var s,i;return(i=(s=e.getRootNode)==null?void 0:s.call(e))!=null?i:document},n=()=>pe(t()),r=()=>{var s;return(s=n().defaultView)!=null?s:window},o=()=>_n(t()),a=s=>t().getElementById(s);return I(R({},e),{getRootNode:t,getDoc:n,getWin:r,getActiveElement:o,isActiveElement:Ja,getById:a})}function Nt(e){let[t,n]=e,r;return!t||!n?r=e:r=t.compare(n)<=0?e:[n,t],r}function ft(e,t){let[n,r]=t;return!n||!r?!1:n.compare(e)<=0&&r.compare(e)>=0}function fn(e){return e.slice().filter(t=>t!=null).sort((t,n)=>t.compare(n))}function Yi(e,t){return new z(e).formatToParts(new Date).map(n=>{var r;return(r=t[n.type])!=null?r:n.value}).join("")}var Bo=e=>!Number.isNaN(e.day)&&!Number.isNaN(e.month)&&!Number.isNaN(e.year),Hi={dayCell(e){return e.unavailable?`Not available. ${e.valueText}`:e.firstInRange?`Starting range from ${e.valueText}`:e.lastInRange?`Range ending at ${e.valueText}`:e.inRange?`In range. ${e.valueText}`:e.selected?`Selected date. ${e.valueText}`:`Choose ${e.valueText}`},trigger(e){return e?"Close calendar":"Open calendar"},viewTrigger(e,t){return t?`Switch to ${t} view`:`${e} view`},presetTrigger(e){let[t="",n=""]=e;return`select ${t} to ${n}`},prevTrigger(e){return er(e,{year:"Switch to previous decade",month:"Switch to previous year",day:"Switch to previous month"})},nextTrigger(e){return er(e,{year:"Switch to next decade",month:"Switch to next year",day:"Switch to next month"})},placeholder(){return{day:"dd",month:"mm",year:"yyyy"}},content:"calendar",monthSelect:"Select month",yearSelect:"Select year",clearTrigger:"Clear selected dates",weekColumnHeader:"Wk",weekNumberCell(e){return`Week ${e}`}};function Be(e,t){return e?e==="day"?0:e==="month"?1:2:t||0}function _o(e){return e===0?"day":e===1?"month":"year"}function sr(e,t,n){return _o(ii(Be(e,0),Be(t,0),Be(n,2)))}function Ui(e,t){return Be(e,0)>Be(t,0)}function ji(e,t){return Be(e,0)<Be(t,0)}function ir(e,t,n){let r=Be(e,0)+1;return sr(_o(r),t,n)}function Ki(e,t,n){let r=Be(e,0)-1;return sr(_o(r),t,n)}var Mu=["day","month","year"];function qi(e){Mu.forEach(t=>e(t))}var Zi=Oi(e=>[e.view,e.startValue.toString(),e.endValue.toString(),e.locale,e.timeZone,e.selectionMode],([e],t)=>{let{startValue:n,endValue:r,locale:o,timeZone:a,selectionMode:s}=t;if(e==="year"){let h=ke(n.year),p=h.at(0).toString(),g=h.at(-1).toString();return{start:p,end:g,formatted:`${p} - ${g}`}}if(e==="month"){let h=new z(o,{year:"numeric",timeZone:a,calendar:n.calendar.identifier}),p=h.format(n.toDate(a)),g=h.format(r.toDate(a)),d=s==="range"?`${p} - ${g}`:p;return{start:p,end:g,formatted:d}}let i=new z(o,{month:"long",year:"numeric",timeZone:a,calendar:n.calendar.identifier}),c=i.format(n.toDate(a)),u=i.format(r.toDate(a)),f=s==="range"?`${c} - ${u}`:c;return{start:c,end:u,formatted:f}});function Wo(e,t){let{state:n,context:r,prop:o,send:a,computed:s,scope:i}=e,c=r.get("startValue"),u=s("endValue"),f=r.get("value"),h=r.get("focusedValue"),p=r.get("hoveredValue"),g=p?Nt([f[0],p]):[],d=!!o("disabled"),l=!!o("readOnly"),b=!!o("invalid"),y=s("isInteractive"),A=f.length===0,D=o("min"),$=o("max"),E=o("locale"),P=o("timeZone"),O=o("startOfWeek"),C=n.matches("focused"),T=n.matches("open"),S=o("selectionMode")==="range",V=o("selectionMode")==="multiple",L=o("isDateUnavailable"),F=o("maxSelectedDates"),q=V&&F!=null&&f.length>=F,H=r.get("currentPlacement"),oe=H?xo(H):void 0,Q=To(I(R({},o("positioning")),{placement:H})),de=ja(E),W=ci(Hi,o("translations"));function k(w=c){let m=o("fixedWeeks")?6:void 0;return Va(w,E,m,O)}function B(w={}){let{format:m}=w;return La(E,m,h).map((v,x)=>{let N=x+1,X=h.set({month:N}),Z=he(X,D,$);return{label:v,value:N,disabled:Z}})}function j(){let w=Fa(h,D,$);return Na(w).map(v=>({label:v.toString(),value:v,disabled:!tr(v,D==null?void 0:D.year,$==null?void 0:$.year)}))}function fe(w){return Zr(w,L,E,D,$)}function mt(w){let m=c!=null?c:rt(P,h.calendar);a({type:"FOCUS.SET",value:m.set({month:w})})}function yn(w){let m=c!=null?c:rt(P,h.calendar);a({type:"FOCUS.SET",value:m.set({year:w})})}function _e(w){let{value:m,disabled:v}=w,x=h.set({year:m}),X=!ke(c.year).includes(m),Z=tr(m,D==null?void 0:D.year,$==null?void 0:$.year),ue=S&&ft(x,f),Ye=S&&f[0]&&et(x,f[0]),ht=S&&f[1]&&et(x,f[1]),Xe=S&&g.length>0,pt=Xe&&ft(x,g),He=Xe&&g[0]&&et(x,g[0]),Ue=Xe&&g[1]&&et(x,g[1]),vn={focused:h.year===w.value,selectable:Z,outsideRange:X,selected:!!f.find(bn=>bn&&bn.year===m),valueText:m.toString(),inRange:ue||pt,firstInRange:!!Ye,lastInRange:!!ht,inHoveredRange:!!pt,firstInHoveredRange:!!He,lastInHoveredRange:!!Ue,value:x,get disabled(){return v||!vn.selectable}};return vn}function We(w){let{value:m,disabled:v}=w,x=h.set({month:m}),N=Fn(E,P,h),X=S&&ft(x,f),Z=S&&f[0]&&Qe(x,f[0]),ue=S&&f[1]&&Qe(x,f[1]),Ye=S&&g.length>0,ht=Ye&&ft(x,g),Xe=Ye&&g[0]&&Qe(x,g[0]),pt=Ye&&g[1]&&Qe(x,g[1]),He={focused:h.month===w.value,selectable:!he(x,D,$),selected:!!f.find(Ue=>Ue&&Ue.month===m&&Ue.year===h.year),valueText:N.format(x.toDate(P)),inRange:X||ht,firstInRange:!!Z,lastInRange:!!ue,inHoveredRange:!!ht,firstInHoveredRange:!!Xe,lastInHoveredRange:!!pt,outsideRange:!1,value:x,get disabled(){return v||!He.selectable}};return He}function ze(w){let{value:m,disabled:v,visibleRange:x=s("visibleRange")}=w,N=Nn(E,P,h),X=Kt(s("visibleDuration")),Z=o("outsideDaySelectable"),ue=x.start.add(X).subtract({days:1}),Ye=he(m,x.start,ue),ht=S&&ft(m,f),Xe=S&&f[0]&&ee(m,f[0]),pt=S&&f[1]&&ee(m,f[1]),He=S&&g.length>0,Ue=He&&ft(m,g),vn=He&&g[0]&&ee(m,g[0]),bn=He&&g[1]&&ee(m,g[1]),ta=f.some(na=>na!=null&&ee(m,na)),wn={invalid:he(m,D,$),disabled:v||!Z&&Ye||he(m,D,$)||q&&!ta,selected:ta,unavailable:Zr(m,L,E,D,$)&&!v,outsideRange:Ye,today:$r(m,P),weekend:Ar(m,E),value:m,valueText:N.format(m.toDate(P)),get focused(){return h!=null&&ee(m,h)&&(!wn.outsideRange||Z)},get selectable(){return!wn.disabled&&!wn.unavailable},inRange:ht||Ue,firstInRange:Xe,lastInRange:pt,inHoveredRange:Ue,firstInHoveredRange:vn,lastInHoveredRange:bn};return wn}function Bt(w){let{view:m="day",id:v}=w;return[m,v].filter(Boolean).join(" ")}return{focused:C,open:T,disabled:d,invalid:b,readOnly:l,inline:!!o("inline"),numOfMonths:o("numOfMonths"),showWeekNumbers:!!o("showWeekNumbers"),selectionMode:o("selectionMode"),maxSelectedDates:F,isMaxSelected:q,view:r.get("view"),getRangePresetValue(w){return to(w,E,P)},getWeekNumber(w){let m=w[0];return m?Xr(m,E):0},getDaysInWeek(w,m=c){return zr(w,m,E,O)},getOffset(w){let m=c.add(w),v=u.add(w),x=Fn(E,P,h);return{visibleRange:{start:m,end:v},weeks:k(m),visibleRangeText:{start:x.format(m.toDate(P)),end:x.format(v.toDate(P))}}},getMonthWeeks:k,isUnavailable:fe,weeks:k(),weekDays:ka(c,O,P,E),visibleRangeText:s("visibleRangeText"),value:f,valueAsDate:f.filter(w=>w!=null).map(w=>w.toDate(P)),valueAsString:s("valueAsString"),focusedValue:h,focusedValueAsDate:h==null?void 0:h.toDate(P),focusedValueAsString:o("format")(h,{locale:E,timeZone:P}),visibleRange:s("visibleRange"),selectToday(){let w=se(rt(P,h.calendar),D,$);a({type:"VALUE.SET",value:[w]})},setValue(w){let m=w.map(v=>se(v,D,$));a({type:"VALUE.SET",value:m})},setTime(w,m=0){var N,X,Z,ue;let v=Array.from(f),x=v[m];x&&("hour"in x||(x=G(x)),x=x.set({hour:(N=w.hour)!=null?N:"hour"in x?x.hour:0,minute:(X=w.minute)!=null?X:"minute"in x?x.minute:0,second:(Z=w.second)!=null?Z:"second"in x?x.second:0,millisecond:(ue=w.millisecond)!=null?ue:"millisecond"in x?x.millisecond:0}),v[m]=se(x,D,$),a({type:"VALUE.SET",value:v}))},clearValue(w={}){let{focus:m=!0}=w;a({type:"VALUE.CLEAR",focus:m})},setFocusedValue(w){a({type:"FOCUS.SET",value:w})},setOpen(w){o("inline")||a({type:w?"OPEN":"CLOSE",replaces:"open"})},focusMonth:mt,focusYear:yn,getYears:j,getMonths:B,getYearsGrid(w={}){let{columns:m=1}=w,v=ke(c.year).map(x=>({label:x.toString(),value:x,disabled:!tr(x,D==null?void 0:D.year,$==null?void 0:$.year)}));return bo(v,m)},getDecade(){let w=ke(c.year);return{start:w.at(0),end:w.at(-1)}},getMonthsGrid(w={}){let{columns:m=1,format:v}=w;return bo(B({format:v}),m)},format(w,m={month:"long",year:"numeric"}){return new z(E,I(R({},m),{calendar:w.calendar.identifier})).format(w.toDate(P))},setView(w){a({type:"VIEW.SET",view:w})},goToNext(){a({type:"GOTO.NEXT",view:r.get("view")})},goToPrev(){a({type:"GOTO.PREV",view:r.get("view")})},getRootProps(){return t.element(I(R({},Y.root.attrs),{dir:o("dir"),id:bi(i),"data-state":T?"open":"closed","data-disabled":M(d),"data-readonly":M(l),"data-empty":M(A)}))},getLabelProps(w={}){let{index:m=0}=w;return t.label(I(R({},Y.label.attrs),{id:vi(i,m),dir:o("dir"),htmlFor:Ao(i,m),"data-state":T?"open":"closed","data-index":m,"data-disabled":M(d),"data-readonly":M(l),"data-invalid":M(b)}))},getControlProps(){return t.element(I(R({},Y.control.attrs),{dir:o("dir"),id:Do(i),"data-disabled":M(d),"data-placeholder-shown":M(A),"data-invalid":M(b)}))},getRangeTextProps(){return t.element(I(R({},Y.rangeText.attrs),{dir:o("dir")}))},getContentProps(){return t.element(I(R({},Y.content.attrs),{hidden:!T,dir:o("dir"),"data-state":T?"open":"closed","data-placement":H,"data-side":oe,"data-inline":M(o("inline")),id:rr(i),tabIndex:-1,role:"application","aria-label":W.content}))},getTableProps(w={}){let{view:m="day",columns:v=m==="day"?7:4}=w,x=Bt(w);return t.element(I(R({},Y.table.attrs),{role:"grid","data-columns":v,"aria-label":s("visibleRangeText").formatted,id:wi(i,x),"aria-readonly":ne(l),"aria-disabled":ne(d),"aria-multiselectable":ne(o("selectionMode")!=="single"),"data-view":m,dir:o("dir"),tabIndex:-1,onKeyDown(N){if(N.defaultPrevented||d)return;let Z={Enter(){y&&(m==="day"&&fe(h)||m==="month"&&!We({value:h.month}).selectable||m==="year"&&!_e({value:h.year}).selectable||a({type:"TABLE.ENTER",view:m,columns:v,focus:!0}))},ArrowLeft(){a({type:"TABLE.ARROW_LEFT",view:m,columns:v,focus:!0})},ArrowRight(){a({type:"TABLE.ARROW_RIGHT",view:m,columns:v,focus:!0})},ArrowUp(){a({type:"TABLE.ARROW_UP",view:m,columns:v,focus:!0})},ArrowDown(){a({type:"TABLE.ARROW_DOWN",view:m,columns:v,focus:!0})},PageUp(ue){a({type:"TABLE.PAGE_UP",larger:ue.shiftKey,view:m,columns:v,focus:!0})},PageDown(ue){a({type:"TABLE.PAGE_DOWN",larger:ue.shiftKey,view:m,columns:v,focus:!0})},Home(){a({type:"TABLE.HOME",view:m,columns:v,focus:!0})},End(){a({type:"TABLE.END",view:m,columns:v,focus:!0})}}[ss(N,{dir:o("dir")})];Z&&(Z(N),N.preventDefault(),N.stopPropagation())},onPointerLeave(){a({type:"TABLE.POINTER_LEAVE"})},onPointerDown(){a({type:"TABLE.POINTER_DOWN",view:m})},onPointerUp(){a({type:"TABLE.POINTER_UP",view:m})}}))},getTableHeadProps(w={}){let{view:m="day"}=w;return t.element(I(R({},Y.tableHead.attrs),{"aria-hidden":!0,dir:o("dir"),"data-view":m,"data-disabled":M(d)}))},getTableHeaderProps(w={}){let{view:m="day"}=w;return t.element(I(R({},Y.tableHeader.attrs),{dir:o("dir"),"data-view":m,"data-disabled":M(d)}))},getTableBodyProps(w={}){let{view:m="day"}=w;return t.element(I(R({},Y.tableBody.attrs),{"data-view":m,"data-disabled":M(d)}))},getTableRowProps(w={}){let{view:m="day"}=w;return t.element(I(R({},Y.tableRow.attrs),{"aria-disabled":ne(d),"data-disabled":M(d),"data-view":m}))},getWeekNumberHeaderCellProps(w={}){let{view:m="day"}=w;return t.element(I(R({},Y.tableCell.attrs),{scope:"col","aria-label":W.weekColumnHeader,"data-view":m,"data-type":"week-number","data-disabled":M(d)}))},getWeekNumberCellProps(w){var N;let{weekIndex:m,week:v}=w,x=v[0]?Xr(v[0],E):0;return t.element(I(R({},Y.tableCell.attrs),{role:"rowheader","aria-label":(N=W.weekNumberCell)==null?void 0:N.call(W,x),"data-view":"day","data-week-index":m,"data-type":"week-number","data-disabled":M(d)}))},getDayTableCellState:ze,getDayTableCellProps(w){let{value:m}=w,v=ze(w);return t.element(I(R({},Y.tableCell.attrs),{role:"gridcell","aria-disabled":ne(!v.selectable),"aria-selected":v.selected||v.inRange,"aria-invalid":ne(v.invalid),"aria-current":v.today?"date":void 0,"data-value":m.toString()}))},getDayTableCellTriggerProps(w){let{value:m}=w,v=ze(w);return t.element(I(R({},Y.tableCellTrigger.attrs),{id:or(i,m.toString()),role:"button",dir:o("dir"),tabIndex:d?-1:v.focused?0:-1,"aria-label":W.dayCell(v),"aria-disabled":ne(!v.selectable),"aria-invalid":ne(v.invalid),"data-disabled":M(!v.selectable),"data-selectable":M(v.selectable),"data-selected":M(v.selected),"data-value":m.toString(),"data-view":"day","data-today":M(v.today),"data-focus":M(v.focused),"data-unavailable":M(v.unavailable),"data-range-start":M(v.firstInRange),"data-range-end":M(v.lastInRange),"data-in-range":M(v.inRange),"data-outside-range":M(v.outsideRange),"data-weekend":M(v.weekend),"data-in-hover-range":M(v.inHoveredRange),"data-hover-range-start":M(v.firstInHoveredRange),"data-hover-range-end":M(v.lastInHoveredRange),onClick(x){x.defaultPrevented||y&&v.selectable&&a({type:"CELL.CLICK",cell:"day",value:m})},onPointerMove:S?x=>{if(x.pointerType==="touch"||!v.selectable)return;let N=!i.isActiveElement(x.currentTarget);p&&wr(m,p)||a({type:"CELL.POINTER_MOVE",cell:"day",value:m,focus:N,outsideRange:v.outsideRange})}:void 0}))},getMonthTableCellState:We,getMonthTableCellProps(w){let{value:m,columns:v}=w,x=We(w);return t.element(I(R({},Y.tableCell.attrs),{dir:o("dir"),colSpan:v,role:"gridcell","aria-selected":ne(x.selected||x.inRange),"data-selected":M(x.selected),"aria-disabled":ne(!x.selectable),"data-value":m}))},getMonthTableCellTriggerProps(w){let{value:m}=w,v=We(w);return t.element(I(R({},Y.tableCellTrigger.attrs),{id:or(i,m.toString()),role:"button",dir:o("dir"),tabIndex:d?-1:v.focused?0:-1,"aria-label":v.valueText,"aria-disabled":ne(!v.selectable),"data-disabled":M(!v.selectable),"data-selectable":M(v.selectable),"data-selected":M(v.selected),"data-value":m,"data-view":"month","data-focus":M(v.focused),"data-outside-range":M(v.outsideRange),"data-range-start":M(v.firstInRange),"data-range-end":M(v.lastInRange),"data-in-range":M(v.inRange),"data-in-hover-range":M(v.inHoveredRange),"data-hover-range-start":M(v.firstInHoveredRange),"data-hover-range-end":M(v.lastInHoveredRange),onClick(x){x.defaultPrevented||y&&v.selectable&&a({type:"CELL.CLICK",cell:"month",value:m})},onPointerMove:S?x=>{if(x.pointerType==="touch"||!v.selectable)return;let N=!i.isActiveElement(x.currentTarget);p&&v.value&&Qe(v.value,p)||a({type:"CELL.POINTER_MOVE",cell:"month",value:v.value,focus:N})}:void 0}))},getYearTableCellState:_e,getYearTableCellProps(w){let{value:m,columns:v}=w,x=_e(w);return t.element(I(R({},Y.tableCell.attrs),{dir:o("dir"),colSpan:v,role:"gridcell","aria-selected":ne(x.selected||x.inRange),"data-selected":M(x.selected),"aria-disabled":ne(!x.selectable),"data-value":m}))},getYearTableCellTriggerProps(w){let{value:m}=w,v=_e(w);return t.element(I(R({},Y.tableCellTrigger.attrs),{id:or(i,m.toString()),role:"button",dir:o("dir"),tabIndex:d?-1:v.focused?0:-1,"aria-label":v.valueText,"aria-disabled":ne(!v.selectable),"data-disabled":M(!v.selectable),"data-selectable":M(v.selectable),"data-selected":M(v.selected),"data-value":m,"data-view":"year","data-focus":M(v.focused),"data-outside-range":M(v.outsideRange),"data-range-start":M(v.firstInRange),"data-range-end":M(v.lastInRange),"data-in-range":M(v.inRange),"data-in-hover-range":M(v.inHoveredRange),"data-hover-range-start":M(v.firstInHoveredRange),"data-hover-range-end":M(v.lastInHoveredRange),onClick(x){x.defaultPrevented||y&&v.selectable&&a({type:"CELL.CLICK",cell:"year",value:m})},onPointerMove:S?x=>{if(x.pointerType==="touch"||!v.selectable||v.outsideRange)return;let N=!i.isActiveElement(x.currentTarget);p&&v.value&&et(v.value,p)||a({type:"CELL.POINTER_MOVE",cell:"year",value:v.value,focus:N})}:void 0}))},getNextTriggerProps(w={}){let{view:m="day"}=w,v=d||!s("isNextVisibleRangeValid");return t.button(I(R({},Y.nextTrigger.attrs),{dir:o("dir"),id:xi(i,m),type:"button","aria-label":W.nextTrigger(m),disabled:v,"data-disabled":M(v),onClick(x){x.defaultPrevented||a({type:"GOTO.NEXT",view:m})}}))},getPrevTriggerProps(w={}){let{view:m="day"}=w,v=d||!s("isPrevVisibleRangeValid");return t.button(I(R({},Y.prevTrigger.attrs),{dir:o("dir"),id:$i(i,m),type:"button","aria-label":W.prevTrigger(m),disabled:v,"data-disabled":M(v),onClick(x){x.defaultPrevented||a({type:"GOTO.PREV",view:m})}}))},getClearTriggerProps(){return t.button(I(R({},Y.clearTrigger.attrs),{id:So(i),dir:o("dir"),type:"button","aria-label":W.clearTrigger,hidden:!f.length,onClick(w){w.defaultPrevented||y&&a({type:"VALUE.CLEAR"})}}))},getTriggerProps(){return t.button(I(R({},Y.trigger.attrs),{id:Oo(i),dir:o("dir"),type:"button","data-placement":H,"data-side":oe,"aria-label":W.trigger(T),"aria-controls":rr(i),"aria-expanded":T,"data-state":T?"open":"closed","data-placeholder-shown":M(A),"aria-haspopup":"grid",disabled:d,onClick(w){w.defaultPrevented||y&&a({type:"TRIGGER.CLICK"})}}))},getViewProps(w={}){let{view:m="day"}=w;return t.element(I(R({},Y.view.attrs),{"data-view":m,hidden:r.get("view")!==m}))},getViewTriggerProps(w={}){let{view:m="day"}=w,v=ir(m,o("minView"),o("maxView")),x=v!==m,N=d||!x;return t.button(I(R({},Y.viewTrigger.attrs),{"data-view":m,dir:o("dir"),id:Ei(i,m),type:"button",disabled:N,"data-disabled":M(N),"aria-label":W.viewTrigger(m,x?v:void 0),onClick(X){X.defaultPrevented||y&&a({type:"VIEW.TOGGLE",src:"viewTrigger"})}}))},getViewControlProps(w={}){let{view:m="day"}=w;return t.element(I(R({},Y.viewControl.attrs),{"data-view":m,dir:o("dir")}))},getInputProps(w={}){let{index:m=0,fixOnBlur:v=!0}=w;return t.input(I(R({},Y.input.attrs),{id:Ao(i,m),autoComplete:"off",autoCorrect:"off",spellCheck:"false",dir:o("dir"),name:o("name"),"data-index":m,"data-state":T?"open":"closed","data-placeholder-shown":M(A),readOnly:l,disabled:d,required:o("required"),"aria-invalid":ne(b),"data-invalid":M(b),placeholder:o("placeholder")||Yi(E,W.placeholder(E)),defaultValue:s("valueAsString")[m],onBeforeInput(x){let{data:N}=lo(x);eo(N,de,E)||x.preventDefault()},onClick(x){x.defaultPrevented||o("openOnClick")&&y&&a({type:"OPEN",src:"input.click"})},onFocus(){a({type:"INPUT.FOCUS",index:m})},onBlur(x){let N=x.currentTarget.value.trim();a({type:"INPUT.BLUR",value:N,index:m,fixOnBlur:v})},onKeyDown(x){if(x.defaultPrevented||!y)return;let X={Enter(Z){os(Z)||fe(h)||Z.currentTarget.value.trim()!==""&&a({type:"INPUT.ENTER",value:Z.currentTarget.value,index:m})}}[x.key];X&&(X(x),x.preventDefault())},onInput(x){let N=x.currentTarget.value;a({type:"INPUT.CHANGE",value:Ua(N,de,E),index:m})}}))},getMonthSelectProps(){return t.select(I(R({},Y.monthSelect.attrs),{id:Ro(i),"aria-label":W.monthSelect,disabled:d,dir:o("dir"),defaultValue:c.month,onChange(w){mt(Number(w.currentTarget.value))}}))},getYearSelectProps(){return t.select(I(R({},Y.yearSelect.attrs),{id:Co(i),disabled:d,"aria-label":W.yearSelect,dir:o("dir"),defaultValue:c.year,onChange(w){yn(Number(w.currentTarget.value))}}))},getPositionerProps(){return t.element(I(R({id:Po(i)},Y.positioner.attrs),{dir:o("dir"),style:Q.floating}))},getPresetTriggerProps(w){let m=Array.isArray(w.value)?w.value:to(w.value,E,P),v=m.filter(x=>x!=null).map(x=>x.toDate(P).toDateString());return t.button(I(R({},Y.presetTrigger.attrs),{"aria-label":W.presetTrigger(v),type:"button",onClick(x){x.defaultPrevented||y&&a({type:"PRESET.CLICK",value:m})}}))}}}function Gi(e){let t={each(n){var r;for(let o=0;o<((r=e.frames)==null?void 0:r.length);o+=1){let a=e.frames[o];a&&n(a)}},addEventListener(n,r,o){return t.each(a=>{try{a.document.addEventListener(n,r,o)}catch(s){}}),()=>{try{t.removeEventListener(n,r,o)}catch(a){}}},removeEventListener(n,r,o){t.each(a=>{try{a.document.removeEventListener(n,r,o)}catch(s){}})}};return t}function zi(e){let t=e.frameElement!=null?e.parent:null;return{addEventListener:(n,r,o)=>{try{t==null||t.addEventListener(n,r,o)}catch(a){}return()=>{try{t==null||t.removeEventListener(n,r,o)}catch(a){}}},removeEventListener:(n,r,o)=>{try{t==null||t.removeEventListener(n,r,o)}catch(a){}}}}var Xi="pointerdown.outside",Ji="focus.outside";function Vu(e){for(let t of e)if(J(t)&&uo(t))return!0;return!1}var tc=e=>"clientY"in e;function ku(e,t){if(!tc(t)||!e)return!1;let n=e.getBoundingClientRect();return n.width===0||n.height===0?!1:n.top<=t.clientY&&t.clientY<=n.top+n.height&&n.left<=t.clientX&&t.clientX<=n.left+n.width}function Lu(e,t){return e.y<=t.y&&t.y<=e.y+e.height&&e.x<=t.x&&t.x<=e.x+e.width}function Qi(e,t){if(!t||!tc(e))return!1;let n=t.scrollHeight>t.clientHeight,r=n&&e.clientX>t.offsetLeft+t.clientWidth,o=t.scrollWidth>t.clientWidth,a=o&&e.clientY>t.offsetTop+t.clientHeight,s={x:t.offsetLeft,y:t.offsetTop,width:t.clientWidth+(n?16:0),height:t.clientHeight+(o?16:0)},i={x:e.clientX,y:e.clientY};return Lu(s,i)?r||a:!1}function Nu(e,t){let{exclude:n,onFocusOutside:r,onPointerDownOutside:o,onInteractOutside:a,defer:s,followControlledElements:i=!0}=t;if(!e)return;let c=pe(e),u=ie(e),f=Gi(u),h=zi(u);function p($,E){if(!J(E)||!E.isConnected||at(e,E)||ku(e,$)||i&&ns(e,E))return!1;let P=c.querySelector(`[aria-controls="${e.id}"]`);if(P){let C=Hn(P);if(Qi($,C))return!1}let O=Hn(e);return Qi($,O)?!1:!(n!=null&&n(E))}let g=new Set,d=ot(e==null?void 0:e.getRootNode()),l=!1;function b($){l=!0;let E=()=>{l=!1};c.addEventListener("pointerup",E,{once:!0}),u.addEventListener("pointerup",E,{once:!0});function P(O){var V,L;let C=s&&!so()?re:F=>F(),T=O!=null?O:$,S=(L=(V=T==null?void 0:T.composedPath)==null?void 0:V.call(T))!=null?L:[T==null?void 0:T.target];C(()=>{let F=d?S[0]:Tt($);if(!(!e||!p($,F))){if(o||a){let q=Ct(o,a);e.addEventListener(Xi,q,{once:!0})}ec(e,Xi,{bubbles:!1,cancelable:!0,detail:{originalEvent:T,contextmenu:as(T),focusable:Vu(S),target:F}})}})}$.pointerType==="touch"?(g.forEach(O=>O()),g.add(St(c,"click",P,{once:!0})),g.add(h.addEventListener("click",P,{once:!0})),g.add(f.addEventListener("click",P,{once:!0}))):P()}let y=new Set,A=setTimeout(()=>{y.add(St(c,"pointerdown",b,!0)),y.add(h.addEventListener("pointerdown",b,!0)),y.add(f.addEventListener("pointerdown",b,!0))},0);function D($){if(l)return;(s?re:P=>P())(()=>{var C,T;let P=(T=(C=$==null?void 0:$.composedPath)==null?void 0:C.call($))!=null?T:[$==null?void 0:$.target],O=d?P[0]:Tt($);if(!(!e||!p($,O))){if(r||a){let S=Ct(r,a);e.addEventListener(Ji,S,{once:!0})}ec(e,Ji,{bubbles:!1,cancelable:!0,detail:{originalEvent:$,contextmenu:!1,focusable:uo(O),target:O}})}})}return so()||(y.add(St(c,"focusin",D,!0)),y.add(h.addEventListener("focusin",D,!0)),y.add(f.addEventListener("focusin",D,!0))),()=>{clearTimeout(A),g.forEach($=>$()),y.forEach($=>$())}}function nc(e,t){let{defer:n}=t,r=n?re:a=>a(),o=[];return o.push(r(()=>{let a=typeof e=="function"?e():e;o.push(Nu(a,t))})),()=>{o.forEach(a=>a==null?void 0:a())}}function ec(e,t,n){let r=e.ownerDocument.defaultView||window,o=new r.CustomEvent(t,n);return e.dispatchEvent(o)}function rc(e,t){let n=r=>{r.key==="Escape"&&(r.isComposing||t==null||t(r))};return St(pe(e),"keydown",n,{capture:!0})}var oc="layer:request-dismiss",ae={layers:[],branches:[],recentlyRemoved:new Set,count(){return this.layers.length},pointerBlockingLayers(){return this.layers.filter(e=>e.pointerBlocking)},topMostPointerBlockingLayer(){return[...this.pointerBlockingLayers()].slice(-1)[0]},hasPointerBlockingLayer(){return this.pointerBlockingLayers().length>0},isBelowPointerBlockingLayer(e){var r;let t=this.indexOf(e),n=this.topMostPointerBlockingLayer()?this.indexOf((r=this.topMostPointerBlockingLayer())==null?void 0:r.node):-1;return t<n},isTopMost(e){let t=this.layers[this.count()-1];return(t==null?void 0:t.node)===e},getNestedLayers(e){return Array.from(this.layers).slice(this.indexOf(e)+1)},getLayersByType(e){return this.layers.filter(t=>t.type===e)},getNestedLayersByType(e,t){let n=this.indexOf(e);return n===-1?[]:this.layers.slice(n+1).filter(r=>r.type===t)},getParentLayerOfType(e,t){let n=this.indexOf(e);if(!(n<=0))return this.layers.slice(0,n).reverse().find(r=>r.type===t)},countNestedLayersOfType(e,t){return this.getNestedLayersByType(e,t).length},isInNestedLayer(e,t){return!!(this.getNestedLayers(e).some(r=>at(r.node,t))||this.recentlyRemoved.size>0)},isInBranch(e){return Array.from(this.branches).some(t=>at(t,e))},add(e){let t=this.indexOf(e.node);t!==-1&&this.layers.splice(t,1),this.layers.push(e),this.syncLayers()},addBranch(e){this.branches.push(e)},remove(e){var r;let t=this.indexOf(e);if(t<0)return;(r=this.layers[t].styleTargets)==null||r.forEach(o=>{let a=o();a&&Fu(a)}),this.recentlyRemoved.add(e),Yn(()=>this.recentlyRemoved.delete(e)),t<this.count()-1&&this.getNestedLayers(e).forEach(a=>ae.dismiss(a.node,e)),this.layers.splice(t,1),this.syncLayers()},removeBranch(e){let t=this.branches.indexOf(e);t>=0&&this.branches.splice(t,1)},syncLayers(){this.layers.forEach((e,t)=>{var n;ac(e,t,e.node),(n=e.styleTargets)==null||n.forEach(r=>{let o=r();if(!o||o===e.node)return;ac(e,t,o);let{zIndex:a}=Wn(e.node);o.style.setProperty("--z-index",a)})})},indexOf(e){return this.layers.findIndex(t=>t.node===e)},dismiss(e,t){let n=this.indexOf(e);if(n===-1)return;let r=this.layers[n];_u(e,oc,o=>{var a;(a=r.requestDismiss)==null||a.call(r,o),o.defaultPrevented||r==null||r.dismiss()}),Bu(e,oc,{originalLayer:e,targetLayer:t,originalIndex:n,targetIndex:t?this.indexOf(t):-1}),this.syncLayers()},clear(){this.remove(this.layers[0].node)}};function ac(e,t,n){n.style.setProperty("--layer-index",`${t}`),n.removeAttribute("data-nested"),n.removeAttribute("data-has-nested"),ae.getParentLayerOfType(e.node,e.type)&&n.setAttribute("data-nested",e.type);let o=ae.countNestedLayersOfType(e.node,e.type);o>0&&n.setAttribute("data-has-nested",e.type),n.style.setProperty("--nested-layer-count",`${o}`)}function Fu(e){e.style.removeProperty("--layer-index"),e.style.removeProperty("--nested-layer-count"),e.removeAttribute("data-nested"),e.removeAttribute("data-has-nested")}function Bu(e,t,n){let r=e.ownerDocument.defaultView||window,o=new r.CustomEvent(t,{cancelable:!0,bubbles:!0,detail:n});return e.dispatchEvent(o)}function _u(e,t,n){e.addEventListener(t,n,{once:!0})}var Yo=new WeakMap,gn=new WeakMap;function Wu(e){return ae.isBelowPointerBlockingLayer(e)?"none":"auto"}function sc(e){let t=Wu(e);e.style.pointerEvents!==t&&(e.style.pointerEvents=t)}function Yu(e){if(gn.has(e))return;let t=ie(e);if(typeof t.MutationObserver=="undefined")return;let n=new t.MutationObserver(()=>{gn.has(e)&&sc(e)});n.observe(e,{attributes:!0,attributeFilter:["style"]}),gn.set(e,n)}function Ho(){ae.layers.forEach(({node:e})=>{sc(e),Yu(e)})}function ic(e){let t=gn.get(e);t&&(t.disconnect(),gn.delete(e)),e.style.pointerEvents=""}function cc(e,t){let n=pe(e),r=[];return ae.hasPointerBlockingLayer()&&!n.body.hasAttribute("data-inert")&&(Yo.set(n.body,n.body.style.pointerEvents),queueMicrotask(()=>{let o=n.body;o&&(o.style.pointerEvents="none",o.setAttribute("data-inert",""))})),t==null||t.forEach(o=>{let[a,s]=fs(()=>{let i=o();return J(i)?i:null},{timeout:1e3});a.then(i=>r.push(ds(i,{pointerEvents:"auto"}))),r.push(s)}),()=>{ae.hasPointerBlockingLayer()||(queueMicrotask(()=>{let o=n.body;if(!o)return;let a=Yo.get(o);a!==void 0&&(o.style.pointerEvents=a,Yo.delete(o)),o.removeAttribute("data-inert"),o.style.length===0&&o.removeAttribute("style")}),r.forEach(o=>o()))}}function Hu(e,t){let{onDismiss:n,onRequestDismiss:r,pointerBlocking:o,exclude:a,debug:s,type:i="dialog",layerStyleTargets:c}=t,u={dismiss:n,node:e,type:i,pointerBlocking:o,requestDismiss:r,styleTargets:c};ae.add(u),Ho();function f(l){var y,A;let b=Tt(l.detail.originalEvent);ae.isBelowPointerBlockingLayer(e)||ae.isInBranch(b)||((y=t.onPointerDownOutside)==null||y.call(t,l),(A=t.onInteractOutside)==null||A.call(t,l),!l.defaultPrevented&&(s&&console.log("onPointerDownOutside:",l.detail.originalEvent),n==null||n()))}function h(l){var y,A;let b=Tt(l.detail.originalEvent);ae.isInBranch(b)||((y=t.onFocusOutside)==null||y.call(t,l),(A=t.onInteractOutside)==null||A.call(t,l),!l.defaultPrevented&&(s&&console.log("onFocusOutside:",l.detail.originalEvent),n==null||n()))}function p(l){var b;ae.isTopMost(e)&&((b=t.onEscapeKeyDown)==null||b.call(t,l),!l.defaultPrevented&&n&&(l.preventDefault(),n()))}function g(l){var D;let b=typeof a=="function"?a():a,y=Array.isArray(b)?b:[b],A=(D=t.persistentElements)==null?void 0:D.map($=>$()).filter(J);return A&&y.push(...A),y.some($=>at($,l))||ae.isInNestedLayer(e,l)}let d=[o?cc(e,t.persistentElements):void 0,rc(e,p),nc(e,{exclude:g,onFocusOutside:h,onPointerDownOutside:f,defer:t.defer})];return()=>{ae.remove(e),Ho(),ic(e),d.forEach(l=>l==null?void 0:l())}}function lc(e,t){let{warnOnMissingNode:n=!0}=t;return gs(e,r=>Hu(r,t),{defer:t.defer,onMissing:n?()=>It("[@zag-js/dismissable] node is `null` or `undefined`"):void 0})}var cr="__live-region__",Uo="__live-region-debug__",Uu="position:fixed;inset-inline:0;bottom:0;z-index:2147483647;padding:12px 16px;background:black;color:white;font-size:14px;line-height:20px;text-align:center;pointer-events:none;";function uc(e={}){var h;let{level:t="polite",document:n=document,root:r,delay:o=0,debug:a=!1}=e,s=(h=n.defaultView)!=null?h:window,i=r!=null?r:n.body;function c(){if(!a)return;let p=n.getElementById(Uo);return p||(p=n.createElement("div"),p.id=Uo,p.dataset.liveAnnouncerDebug="true",p.setAttribute("aria-hidden","true"),p.style.cssText=Uu,i.appendChild(p),p)}function u(p,g){let d=n.getElementById(cr);d==null||d.remove(),g=g!=null?g:o;let l=n.createElement("span");l.id=cr,l.dataset.liveAnnouncer="true";let b=t!=="assertive"?"status":"alert";l.setAttribute("aria-live",t),l.setAttribute("role",b),Object.assign(l.style,{border:"0",clip:"rect(0 0 0 0)",height:"1px",margin:"-1px",overflow:"hidden",padding:"0",position:"absolute",width:"1px",whiteSpace:"nowrap",wordWrap:"normal"}),i.appendChild(l),s.setTimeout(()=>{if(!l.isConnected)return;l.textContent=p;let y=c();y&&(y.textContent=p)},g)}function f(){let p=n.getElementById(cr);p==null||p.remove();let g=n.getElementById(Uo);g==null||g.remove()}return{announce:u,destroy:f,toJSON(){return cr}}}var{and:le}=Bi();function ju(e,t){if((e==null?void 0:e.length)!==(t==null?void 0:t.length))return!1;let n=Math.max(e.length,t.length);for(let r=0;r<n;r++)if(!Ve(e[r],t[r]))return!1;return!0}function lr(e,t){return e.map(n=>n==null?"":t("format")(n,{locale:t("locale"),timeZone:t("timeZone")}))}var jo=_i({props({props:e}){let t=e.locale||"en-US",n=e.timeZone||"UTC",r=e.selectionMode||"single",o=e.numOfMonths||1,a;if(e.createCalendar){let d=new Intl.DateTimeFormat(t).resolvedOptions().calendar;d!=="gregory"&&d!=="iso8601"&&(a=e.createCalendar(d))}let s=g=>!a||g.calendar.identifier===a.identifier?g:K(g,a),i=e.defaultValue?fn(e.defaultValue).map(g=>se(s(g),e.min,e.max)):void 0,c=e.value?fn(e.value).map(g=>se(s(g),e.min,e.max)):void 0,u=e.focusedValue||e.defaultFocusedValue||(c==null?void 0:c[0])||(i==null?void 0:i[0])||rt(n,a);u=se(s(u),e.min,e.max);let f=e.minView||"day",h=e.maxView||"year",p=sr(e.defaultView||e.view||f,f,h);return I(R({locale:t,numOfMonths:o,timeZone:n,selectionMode:r,minView:f,maxView:h,outsideDaySelectable:!1,closeOnSelect:!0,format(g,{locale:d,timeZone:l}){return new z(d,{timeZone:l,day:"2-digit",month:"2-digit",year:"numeric",calendar:a==null?void 0:a.identifier}).format(g.toDate(l))},parse(g,{locale:d,timeZone:l}){return qa(g,d,l)}},e),{focusedValue:typeof e.focusedValue=="undefined"?void 0:u,defaultFocusedValue:u,value:c,defaultValue:i!=null?i:[],defaultView:p,positioning:R({placement:"bottom"},e.positioning)})},initialState({prop:e}){var n;return e("inline")||((n=e("open"))!=null?n:e("defaultOpen"))?"open":"idle"},refs(){return{announcer:void 0}},context({prop:e,bindable:t,getContext:n}){return{focusedValue:t(()=>({defaultValue:e("defaultFocusedValue"),value:e("focusedValue"),isEqual:Ve,hash:r=>r.toString(),sync:!0,onChange(r){var c;let o=n(),a=o.get("view"),s=o.get("value"),i=lr(s,e);(c=e("onFocusChange"))==null||c({value:s,valueAsString:i,view:a,focusedValue:r})}})),value:t(()=>({defaultValue:e("defaultValue"),value:e("value"),isEqual:ju,hash:r=>r.map(o=>{var a;return(a=o==null?void 0:o.toString())!=null?a:""}).join(","),onChange(r){var s;let o=n(),a=lr(r,e);(s=e("onValueChange"))==null||s({value:r,valueAsString:a,view:o.get("view")})}})),inputValue:t(()=>({defaultValue:""})),activeIndex:t(()=>({defaultValue:0,sync:!0})),hoveredValue:t(()=>({defaultValue:null,isEqual:Ve})),view:t(()=>({defaultValue:e("defaultView"),value:e("view"),onChange(r){var o;(o=e("onViewChange"))==null||o({view:r})}})),startValue:t(()=>{let r=e("focusedValue")||e("defaultFocusedValue");return{defaultValue:qr(r,"start",{months:e("numOfMonths")},e("locale")),isEqual:Ve,hash:o=>o.toString()}}),currentPlacement:t(()=>({defaultValue:void 0})),restoreFocus:t(()=>({defaultValue:!1}))}},computed:{isInteractive:({prop:e})=>!e("disabled")&&!e("readOnly"),visibleDuration:({prop:e})=>({months:e("numOfMonths")}),endValue:({context:e,computed:t})=>Ln(e.get("startValue"),t("visibleDuration")),visibleRange:({context:e,computed:t})=>({start:e.get("startValue"),end:t("endValue")}),visibleRangeText:({context:e,prop:t,computed:n})=>Zi({view:e.get("view"),startValue:e.get("startValue"),endValue:n("endValue"),locale:t("locale"),timeZone:t("timeZone"),selectionMode:t("selectionMode")}),isPrevVisibleRangeValid:({context:e,prop:t})=>!Ra(e.get("startValue"),t("min"),t("max")),isNextVisibleRangeValid:({prop:e,computed:t})=>!Ca(t("endValue"),e("min"),e("max")),valueAsString:({context:e,prop:t})=>lr(e.get("value"),t)},effects:["setupLiveRegion"],watch({track:e,prop:t,context:n,action:r,computed:o}){e([()=>t("locale")],()=>{r(["setStartValue","syncInputElement"])}),e([()=>n.hash("focusedValue")],()=>{r(["setStartValue","focusActiveCellIfNeeded","setHoveredValueIfKeyboard"])}),e([()=>n.hash("startValue")],()=>{r(["syncMonthSelectElement","syncYearSelectElement","invokeOnVisibleRangeChange"])}),e([()=>n.get("inputValue")],()=>{r(["syncInputValue"])}),e([()=>n.hash("value")],()=>{r(["syncInputElement"])}),e([()=>o("valueAsString").toString()],()=>{r(["announceValueText"])}),e([()=>n.get("view")],()=>{r(["focusActiveCell"])}),e([()=>t("open")],()=>{r(["toggleVisibility"])})},on:{"VALUE.SET":{actions:["setDateValue","setFocusedDate"]},"VIEW.SET":{actions:["setView"]},"FOCUS.SET":{actions:["setFocusedDate"]},"VALUE.CLEAR":{actions:["clearDateValue","clearFocusedDate","setActiveIndexToStart","clearHoveredDate","focusFirstInputElement"]},"INPUT.CHANGE":[{guard:"isInputValueEmpty",actions:["setInputValue","clearDateValue","clearFocusedDate"]},{actions:["setInputValue","focusParsedDate"]}],"INPUT.ENTER":{actions:["focusParsedDate","selectFocusedDate"]},"INPUT.FOCUS":{actions:["setActiveIndex"]},"INPUT.BLUR":[{guard:"shouldFixOnBlur",actions:["setActiveIndexToStart","selectParsedDate"]},{actions:["setActiveIndexToStart"]}],"PRESET.CLICK":[{guard:"isOpenControlled",actions:["setDateValue","setFocusedDate","invokeOnClose"]},{target:"focused",actions:["setDateValue","setFocusedDate","focusInputElement"]}],"GOTO.NEXT":[{guard:"isYearView",actions:["focusNextDecade","announceVisibleRange"]},{guard:"isMonthView",actions:["focusNextYear","announceVisibleRange"]},{actions:["focusNextPage"]}],"GOTO.PREV":[{guard:"isYearView",actions:["focusPreviousDecade","announceVisibleRange"]},{guard:"isMonthView",actions:["focusPreviousYear","announceVisibleRange"]},{actions:["focusPreviousPage"]}]},states:{idle:{tags:["closed"],on:{"CONTROLLED.OPEN":{target:"open",actions:["resetView","focusFirstSelectedDate","focusActiveCell"]},"TRIGGER.CLICK":[{guard:"isOpenControlled",actions:["invokeOnOpen"]},{target:"open",actions:["resetView","focusFirstSelectedDate","focusActiveCell","invokeOnOpen"]}],OPEN:[{guard:"isOpenControlled",actions:["invokeOnOpen"]},{target:"open",actions:["resetView","focusFirstSelectedDate","focusActiveCell","invokeOnOpen"]}]}},focused:{tags:["closed"],on:{"CONTROLLED.OPEN":{target:"open",actions:["resetView","focusFirstSelectedDate","focusActiveCell"]},"TRIGGER.CLICK":[{guard:"isOpenControlled",actions:["invokeOnOpen"]},{target:"open",actions:["resetView","focusFirstSelectedDate","focusActiveCell","invokeOnOpen"]}],OPEN:[{guard:"isOpenControlled",actions:["invokeOnOpen"]},{target:"open",actions:["resetView","focusFirstSelectedDate","focusActiveCell","invokeOnOpen"]}]}},open:{tags:["open"],entry:["resumeRangeSelection"],effects:["trackDismissableElement","trackPositioning"],exit:["clearHoveredDate"],on:{"CONTROLLED.CLOSE":[{guard:le("shouldRestoreFocus","isInteractOutsideEvent"),target:"focused",actions:["focusTriggerElement"]},{guard:"shouldRestoreFocus",target:"focused",actions:["focusInputElement"]},{target:"idle"}],"CELL.CLICK":[{guard:"isAboveMinView",actions:["setFocusedValueForView","setPreviousView"]},{guard:le("isRangePicker","hasSelectedRange"),actions:["setActiveIndexToStart","resetSelection","setActiveIndexToEnd"]},{guard:le("isRangePicker","isSelectingEndDate","closeOnSelect","isOpenControlled"),actions:["setFocusedDate","setSelectedDate","setActiveIndexToStart","clearHoveredDate","invokeOnClose","setRestoreFocus"]},{guard:le("isRangePicker","isSelectingEndDate","closeOnSelect"),target:"focused",actions:["setFocusedDate","setSelectedDate","setActiveIndexToStart","clearHoveredDate","invokeOnClose","focusInputElement"]},{guard:le("isRangePicker","isSelectingEndDate"),actions:["setFocusedDate","setSelectedDate","setActiveIndexToStart","clearHoveredDate"]},{guard:"isRangePicker",actions:["setFocusedDate","setSelectedDate","setActiveIndexToEnd"]},{guard:le("isMultiPicker","canSelectDate"),actions:["setFocusedDate","toggleSelectedDate"]},{guard:"isMultiPicker",actions:["setFocusedDate"]},{guard:le("closeOnSelect","isOpenControlled"),actions:["setFocusedDate","setSelectedDate","invokeOnClose"]},{guard:"closeOnSelect",target:"focused",actions:["setFocusedDate","setSelectedDate","invokeOnClose","focusInputElement"]},{actions:["setFocusedDate","setSelectedDate"]}],"CELL.POINTER_MOVE":[{guard:le("isRangePicker","isSelectingEndDate","isDayPointerMoveOutsideVisibleMonth"),actions:["setHoveredDate"]},{guard:le("isRangePicker","isSelectingEndDate"),actions:["setHoveredDate","setFocusedDate"]}],"TABLE.POINTER_LEAVE":{guard:"isRangePicker",actions:["clearHoveredDate"]},"TABLE.POINTER_DOWN":{actions:["disableTextSelection"]},"TABLE.POINTER_UP":{actions:["enableTextSelection"]},"TABLE.ESCAPE":[{guard:"isOpenControlled",actions:["focusFirstSelectedDate","invokeOnClose"]},{target:"focused",actions:["focusFirstSelectedDate","invokeOnClose","focusTriggerElement"]}],"TABLE.ENTER":[{guard:"isAboveMinView",actions:["setPreviousView"]},{guard:le("isRangePicker","hasSelectedRange"),actions:["setActiveIndexToStart","resetSelection","setActiveIndexToEnd","focusNextDay"]},{guard:le("isRangePicker","isSelectingEndDate","closeOnSelect","isOpenControlled"),actions:["setSelectedDate","setActiveIndexToStart","clearHoveredDate","invokeOnClose"]},{guard:le("isRangePicker","isSelectingEndDate","closeOnSelect"),target:"focused",actions:["setSelectedDate","setActiveIndexToStart","clearHoveredDate","invokeOnClose","focusInputElement"]},{guard:le("isRangePicker","isSelectingEndDate"),actions:["setSelectedDate","setActiveIndexToStart","clearHoveredDate"]},{guard:"isRangePicker",actions:["setSelectedDate","setActiveIndexToEnd","focusNextDay"]},{guard:le("isMultiPicker","canSelectDate"),actions:["toggleSelectedDate"]},{guard:"isMultiPicker"},{guard:le("closeOnSelect","isOpenControlled"),actions:["selectFocusedDate","invokeOnClose"]},{guard:"closeOnSelect",target:"focused",actions:["selectFocusedDate","invokeOnClose","focusInputElement"]},{actions:["selectFocusedDate"]}],"TABLE.ARROW_RIGHT":[{guard:"isMonthView",actions:["focusNextMonth"]},{guard:"isYearView",actions:["focusNextYear"]},{actions:["focusNextDay","setHoveredDate"]}],"TABLE.ARROW_LEFT":[{guard:"isMonthView",actions:["focusPreviousMonth"]},{guard:"isYearView",actions:["focusPreviousYear"]},{actions:["focusPreviousDay"]}],"TABLE.ARROW_UP":[{guard:"isMonthView",actions:["focusPreviousMonthColumn"]},{guard:"isYearView",actions:["focusPreviousYearColumn"]},{actions:["focusPreviousWeek"]}],"TABLE.ARROW_DOWN":[{guard:"isMonthView",actions:["focusNextMonthColumn"]},{guard:"isYearView",actions:["focusNextYearColumn"]},{actions:["focusNextWeek"]}],"TABLE.PAGE_UP":{actions:["focusPreviousSection"]},"TABLE.PAGE_DOWN":{actions:["focusNextSection"]},"TABLE.HOME":[{guard:"isMonthView",actions:["focusFirstMonth"]},{guard:"isYearView",actions:["focusFirstYear"]},{actions:["focusSectionStart"]}],"TABLE.END":[{guard:"isMonthView",actions:["focusLastMonth"]},{guard:"isYearView",actions:["focusLastYear"]},{actions:["focusSectionEnd"]}],"TRIGGER.CLICK":[{guard:"isOpenControlled",actions:["invokeOnClose"]},{target:"focused",actions:["invokeOnClose"]}],"VIEW.TOGGLE":{actions:["setNextView"]},INTERACT_OUTSIDE:[{guard:"isOpenControlled",actions:["setActiveIndexToStart","invokeOnClose"]},{guard:"shouldRestoreFocus",target:"focused",actions:["setActiveIndexToStart","invokeOnClose","focusTriggerElement"]},{target:"idle",actions:["setActiveIndexToStart","invokeOnClose"]}],CLOSE:[{guard:"isOpenControlled",actions:["setActiveIndexToStart","invokeOnClose"]},{target:"idle",actions:["setActiveIndexToStart","invokeOnClose"]}]}}},implementations:{guards:{isAboveMinView:({context:e,prop:t})=>Ui(e.get("view"),t("minView")),isDayView:({context:e,event:t})=>(t.view||e.get("view"))==="day",isMonthView:({context:e,event:t})=>(t.view||e.get("view"))==="month",isYearView:({context:e,event:t})=>(t.view||e.get("view"))==="year",isRangePicker:({prop:e})=>e("selectionMode")==="range",hasSelectedRange:({context:e})=>e.get("value").length===2,isMultiPicker:({prop:e})=>e("selectionMode")==="multiple",canSelectDate:e=>{var c;let{context:t,prop:n,event:r}=e,o=n("maxSelectedDates");if(o==null)return!0;let a=t.get("value"),s=mn(e,(c=r.value)!=null?c:t.get("focusedValue"));return a.some(u=>Ve(u,s))?!0:a.length<o},shouldRestoreFocus:({context:e})=>!!e.get("restoreFocus"),isSelectingEndDate:({context:e})=>e.get("activeIndex")===1,closeOnSelect:({prop:e})=>!!e("closeOnSelect"),isOpenControlled:({prop:e})=>e("open")!=null||!!e("inline"),isInteractOutsideEvent:({event:e})=>{var t;return((t=e.previousEvent)==null?void 0:t.type)==="INTERACT_OUTSIDE"},isInputValueEmpty:({event:e})=>e.value.trim()==="",shouldFixOnBlur:({event:e})=>!!e.fixOnBlur,isDayPointerMoveOutsideVisibleMonth:({event:e})=>e.cell==="day"&&e.outsideRange===!0},effects:{trackPositioning({context:e,prop:t,scope:n}){if(t("inline"))return;e.get("currentPlacement")||e.set("currentPlacement",t("positioning").placement);let r=Vo(n);return Eo(r,()=>Mo(n),I(R({},t("positioning")),{defer:!0,onComplete(a){e.set("currentPlacement",a.placement)}}))},setupLiveRegion({scope:e,refs:t}){let n=e.getDoc();return t.set("announcer",uc({level:"assertive",document:n})),()=>{var r,o;return(o=(r=t.get("announcer"))==null?void 0:r.destroy)==null?void 0:o.call(r)}},trackDismissableElement({scope:e,send:t,context:n,prop:r}){return r("inline")?void 0:lc(()=>ln(e),{type:"popover",defer:!0,layerStyleTargets:[()=>Mo(e)],exclude:[...Vt(e),cn(e),Di(e)],onInteractOutside(a){n.set("restoreFocus",!a.detail.focusable)},onDismiss(){t({type:"INTERACT_OUTSIDE"})},onEscapeKeyDown(a){a.preventDefault(),t({type:"TABLE.ESCAPE",src:"dismissable"})}})}},actions:{setNextView({context:e,prop:t}){let n=ir(e.get("view"),t("minView"),t("maxView"));e.set("view",n)},setPreviousView({context:e,prop:t}){let n=Ki(e.get("view"),t("minView"),t("maxView"));e.set("view",n)},setView({context:e,event:t}){e.set("view",t.view)},setRestoreFocus({context:e}){e.set("restoreFocus",!0)},announceValueText({context:e,prop:t,refs:n}){var i;let r=e.get("value"),o=t("locale"),a=t("timeZone"),s;if(t("selectionMode")==="range"){let[c,u]=r;c&&u?s=qt(c,u,o,a):c?s=qt(c,null,o,a):u?s=qt(u,null,o,a):s=""}else s=r.map(c=>qt(c,null,o,a)).filter(Boolean).join(",");(i=n.get("announcer"))==null||i.announce(s,3e3)},announceVisibleRange({computed:e,refs:t}){var r;let{formatted:n}=e("visibleRangeText");(r=t.get("announcer"))==null||r.announce(n)},disableTextSelection({scope:e}){cs({target:ln(e),doc:e.getDoc()})},enableTextSelection({scope:e}){go({doc:e.getDoc(),target:ln(e)})},focusFirstSelectedDate(e){let{context:t}=e;t.get("value").length&&U(e,t.get("value")[0])},syncInputElement({scope:e,computed:t}){re(()=>{Vt(e).forEach((r,o)=>{Gt(r,t("valueAsString")[o]||"")})})},setFocusedDate(e){let{event:t}=e,n=Array.isArray(t.value)?t.value[0]:t.value;U(e,n)},setFocusedValueForView(e){let{context:t,event:n}=e;U(e,t.get("focusedValue").set({[t.get("view")]:n.value}))},focusNextMonth(e){let{context:t}=e;U(e,t.get("focusedValue").add({months:1}))},focusPreviousMonth(e){let{context:t}=e;U(e,t.get("focusedValue").subtract({months:1}))},setDateValue({context:e,event:t,prop:n}){if(!Array.isArray(t.value))return;let r=t.value.map(o=>se(o,n("min"),n("max")));e.set("value",r)},clearDateValue({context:e}){e.set("value",[])},setSelectedDate(e){var i;let{context:t,event:n}=e,r=Array.from(t.get("value")),o=t.get("activeIndex"),a=r[o],s=mn(e,(i=n.value)!=null?i:t.get("focusedValue"));r[o]=ur(a,s),t.set("value",Nt(r))},resetSelection(e){var a;let{context:t,event:n}=e,r=t.get("value")[0],o=mn(e,(a=n.value)!=null?a:t.get("focusedValue"));t.set("value",[ur(r,o)])},toggleSelectedDate(e){var s;let{context:t,event:n}=e,r=mn(e,(s=n.value)!=null?s:t.get("focusedValue")),o=t.get("value"),a=o.findIndex(i=>Ve(i,r));if(a===-1){let i=[...o,r];t.set("value",fn(i))}else{let i=Array.from(o);i.splice(a,1),t.set("value",fn(i))}},setHoveredDate({context:e,event:t}){e.set("hoveredValue",t.value)},clearHoveredDate({context:e}){e.set("hoveredValue",null)},selectFocusedDate({context:e,computed:t}){let n=Array.from(e.get("value")),r=e.get("activeIndex"),o=n[r],a=e.get("focusedValue").copy();n[r]=ur(o,a),e.set("value",Nt(n));let s=t("valueAsString");e.set("inputValue",s[r])},focusPreviousDay(e){let{context:t}=e,n=t.get("focusedValue").subtract({days:1});U(e,n)},focusNextDay(e){let{context:t}=e,n=t.get("focusedValue").add({days:1});U(e,n)},focusPreviousWeek(e){let{context:t}=e,n=t.get("focusedValue").subtract({weeks:1});U(e,n)},focusNextWeek(e){let{context:t}=e,n=t.get("focusedValue").add({weeks:1});U(e,n)},focusNextPage(e){let{context:t,computed:n,prop:r}=e,o=Jr(t.get("focusedValue"),t.get("startValue"),n("visibleDuration"),r("locale"),r("min"),r("max"));dr(e,o)},focusPreviousPage(e){let{context:t,computed:n,prop:r}=e,o=Qr(t.get("focusedValue"),t.get("startValue"),n("visibleDuration"),r("locale"),r("min"),r("max"));dr(e,o)},focusSectionStart(e){let{context:t}=e;U(e,t.get("startValue").copy())},focusSectionEnd(e){let{computed:t}=e;U(e,t("endValue").copy())},focusNextSection(e){let{context:t,event:n,computed:r,prop:o}=e,a=_a(t.get("focusedValue"),t.get("startValue"),n.larger,r("visibleDuration"),o("locale"),o("min"),o("max"));a&&dr(e,a)},focusPreviousSection(e){let{context:t,event:n,computed:r,prop:o}=e,a=Wa(t.get("focusedValue"),t.get("startValue"),n.larger,r("visibleDuration"),o("locale"),o("min"),o("max"));a&&dr(e,a)},focusNextYear(e){let{context:t}=e,n=t.get("focusedValue").add({years:1});U(e,n)},focusPreviousYear(e){let{context:t}=e,n=t.get("focusedValue").subtract({years:1});U(e,n)},focusNextDecade(e){let{context:t}=e,n=t.get("focusedValue").add({years:10});U(e,n)},focusPreviousDecade(e){let{context:t}=e,n=t.get("focusedValue").subtract({years:10});U(e,n)},clearFocusedDate(e){let{context:t,prop:n}=e,r=t.get("focusedValue").calendar;U(e,rt(n("timeZone"),r))},focusPreviousMonthColumn(e){let{context:t,event:n}=e,r=t.get("focusedValue").subtract({months:n.columns});U(e,r)},focusNextMonthColumn(e){let{context:t,event:n}=e,r=t.get("focusedValue").add({months:n.columns});U(e,r)},focusPreviousYearColumn(e){let{context:t,event:n}=e,r=t.get("focusedValue").subtract({years:n.columns});U(e,r)},focusNextYearColumn(e){let{context:t,event:n}=e,r=t.get("focusedValue").add({years:n.columns});U(e,r)},focusFirstMonth(e){var o,a,s;let{context:t}=e,n=t.get("focusedValue"),r=(s=(a=(o=n.calendar).getMinimumMonthInYear)==null?void 0:a.call(o,n))!=null?s:1;U(e,n.set({month:r}))},focusLastMonth(e){let{context:t}=e,n=t.get("focusedValue"),r=n.calendar.getMonthsInYear(n);U(e,n.set({month:r}))},focusFirstYear(e){let{context:t}=e,n=ke(t.get("focusedValue").year),r=t.get("focusedValue").set({year:n[0]});U(e,r)},focusLastYear(e){let{context:t}=e,n=ke(t.get("focusedValue").year),r=t.get("focusedValue").set({year:n[n.length-1]});U(e,r)},setActiveIndex({context:e,event:t}){e.set("activeIndex",t.index)},setActiveIndexToEnd({context:e}){e.set("activeIndex",1)},setActiveIndexToStart({context:e}){e.set("activeIndex",0)},resumeRangeSelection({context:e,prop:t}){t("selectionMode")==="range"&&e.get("value").length===1&&e.set("activeIndex",1)},focusActiveCell({scope:e,context:t,event:n}){n.src!=="input.click"&&re(()=>{var o;let r=t.get("view");(o=Io(e,r))==null||o.focus({preventScroll:!0})})},focusActiveCellIfNeeded({scope:e,context:t,event:n}){n.focus&&re(()=>{var o;let r=t.get("view");(o=Io(e,r))==null||o.focus({preventScroll:!0})})},setHoveredValueIfKeyboard({context:e,event:t,prop:n}){!(t.type.startsWith("TABLE.ARROW")||["TABLE.ENTER","TABLE.HOME","TABLE.END","TABLE.PAGE_UP","TABLE.PAGE_DOWN"].includes(t.type))||n("selectionMode")!=="range"||e.get("activeIndex")===0||e.set("hoveredValue",e.get("focusedValue").copy())},focusTriggerElement({scope:e}){re(()=>{var t;(t=cn(e))==null||t.focus({preventScroll:!0})})},focusFirstInputElement({scope:e,event:t}){t.focus!==!1&&re(()=>{let[n]=Vt(e),r=n!=null?n:cn(e);r==null||r.focus({preventScroll:!0})})},focusInputElement({scope:e}){re(()=>{var a;let t=Vt(e);if(t.length===0){(a=cn(e))==null||a.focus({preventScroll:!0});return}let n=t.findLastIndex(s=>s.value!==""),r=Math.max(n,0),o=t[r];o==null||o.focus({preventScroll:!0}),o==null||o.setSelectionRange(o.value.length,o.value.length)})},syncMonthSelectElement({scope:e,context:t}){let n=Si(e);Gt(n,t.get("startValue").month.toString())},syncYearSelectElement({scope:e,context:t}){let n=Ti(e);Gt(n,t.get("startValue").year.toString())},setInputValue({context:e,event:t}){e.get("activeIndex")===t.index&&e.set("inputValue",t.value)},syncInputValue({scope:e,context:t,event:n}){queueMicrotask(()=>{var a;let r=Vt(e),o=(a=n.index)!=null?a:t.get("activeIndex");Gt(r[o],t.get("inputValue"))})},focusParsedDate(e){let{event:t,prop:n}=e;if(t.index==null)return;let o=n("parse")(t.value,{locale:n("locale"),timeZone:n("timeZone")});!o||!Bo(o)||U(e,o)},selectParsedDate({context:e,event:t,prop:n}){if(t.index==null)return;let o=n("parse")(t.value,{locale:n("locale"),timeZone:n("timeZone")});if((!o||!Bo(o))&&t.value&&(o=e.get("focusedValue").copy()),!o)return;o=se(o,n("min"),n("max"));let a=Array.from(e.get("value"));a[t.index]=ur(a[t.index],o);let s=Nt(a);e.set("value",s);let i=lr(s,n);e.set("inputValue",i[t.index])},resetView({context:e}){e.set("view",e.initial("view"))},setStartValue({context:e,computed:t,prop:n}){let r=e.get("focusedValue");if(!he(r,e.get("startValue"),t("endValue")))return;let a=qr(r,"start",{months:n("numOfMonths")},n("locale"));e.set("startValue",a)},invokeOnOpen({prop:e,context:t}){var n;e("inline")||(n=e("onOpenChange"))==null||n({open:!0,value:t.get("value")})},invokeOnClose({prop:e,context:t}){var n;e("inline")||(n=e("onOpenChange"))==null||n({open:!1,value:t.get("value")})},invokeOnVisibleRangeChange({prop:e,context:t,computed:n}){var r;(r=e("onVisibleRangeChange"))==null||r({view:t.get("view"),visibleRange:n("visibleRange")})},toggleVisibility({event:e,send:t,prop:n}){t({type:n("open")?"CONTROLLED.OPEN":"CONTROLLED.CLOSE",previousEvent:e})}}}}),mn=(e,t)=>{let{context:n,prop:r}=e,o=n.get("view"),a=typeof t=="number"?n.get("focusedValue").set({[o]:t}):t;return qi(s=>{ji(s,r("minView"))&&(a=a.set({[s]:s==="day"?1:0}))}),a},ur=(e,t)=>{if(!e||!("hour"in e))return t;let n="timeZone"in e,r=t;return"hour"in t||(n?r=Wt(G(t),e.timeZone):r=G(t)),r.set({hour:e.hour,minute:e.minute,second:e.second,millisecond:e.millisecond})};function U(e,t){let{context:n,prop:r,computed:o}=e;if(!t)return;let a=mn(e,t);if(Ve(n.get("focusedValue"),a))return;let i=Et(o("visibleDuration"),r("locale"),r("min"),r("max"))({focusedDate:a,startDate:n.get("startValue")});n.set("startValue",i.startDate),n.set("focusedValue",i.focusedDate)}function dr(e,t){let{context:n}=e;n.set("startValue",t.startDate);let r=n.get("focusedValue");Ve(r,t.focusedDate)||n.set("focusedValue",t.focusedDate)}function fr(e){return Array.isArray(e)?e.map(t=>fr(t)):e instanceof Date?new te(e.getFullYear(),e.getMonth()+1,e.getDate()):Nr(e)}function dc(e){return new Proxy({},{get(t,n){return n==="style"?r=>e({style:r}).style:e}})}var qu=Object.defineProperty,Zu=(e,t,n)=>t in e?qu(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n,_=(e,t,n)=>Zu(e,typeof t!="symbol"?t+"":t,n);var fc={onFocus:"onFocusin",onBlur:"onFocusout",onChange:"onInput",onDoubleClick:"onDblclick",htmlFor:"for",className:"class",defaultValue:"value",defaultChecked:"checked"},Gu=new Set(["viewBox","preserveAspectRatio"]);var Ko=dc(e=>Object.entries(e).reduce((t,[n,r])=>{if(r===void 0)return t;n in fc&&(n=fc[n]);let o=Gu.has(n)?n:n.toLowerCase();return t[o]=r,t},{}));var gr=new WeakMap,gc=new Set(["value","checked","selected"]),zu=new Set(["viewBox","preserveAspectRatio","clipPath","clipRule","fillRule","strokeWidth","strokeLinecap","strokeLinejoin","strokeDasharray","strokeDashoffset","strokeMiterlimit"]),Xu=e=>e.tagName==="svg"||e.namespaceURI==="http://www.w3.org/2000/svg",mr=(e,t)=>Xu(e)&&zu.has(t)?t:t.toLowerCase(),qo=e=>e.startsWith("--")?e:e.replace(/[A-Z]/g,t=>`-${t.toLowerCase()}`),mc=(e,t,n)=>{if(typeof n=="string"){e.setAttribute("style",n);return}if(n==null&&typeof t=="string"){e.removeAttribute("style");return}let r=e.style;if(r!=null){for(let o in t)(n==null?void 0:n[o])==null&&r.removeProperty(qo(o));for(let o in n){let a=n[o];a==null?r.removeProperty(qo(o)):r.setProperty(qo(o),String(a))}}};function Zo(e,t,n){let r=n||"default",o=gr.get(e);o||(o=new Map,gr.set(e,o));let a=o.get(r)||{},s=Object.keys(t),i=(l,b)=>{e.addEventListener(l.toLowerCase(),b)},c=(l,b)=>{e.removeEventListener(l.toLowerCase(),b)},u=l=>l.startsWith("on"),f=l=>!l.startsWith("on"),h=l=>i(l.substring(2),t[l]),p=l=>c(l.substring(2),t[l]),g=l=>{let b=t[l],y=a[l];if(b!==y){if(l==="class"){e.className=b!=null?b:"";return}if(l==="style"){mc(e,y,b);return}if(gc.has(l)){e[l]=b!=null?b:"";return}if(typeof b=="boolean"&&!l.includes("aria-")){e.toggleAttribute(mr(e,l),b);return}if(l==="children"){e.innerHTML=b;return}if(b!=null){e.setAttribute(mr(e,l),b);return}e.removeAttribute(mr(e,l))}};for(let l in a)t[l]==null&&(l==="class"?e.className="":l==="style"?mc(e,a[l],void 0):gc.has(l)?e[l]="":e.removeAttribute(mr(e,l)));return Object.keys(a).filter(u).forEach(l=>{c(l.substring(2),a[l])}),s.filter(u).forEach(h),s.filter(f).forEach(g),o.set(r,t),function(){s.filter(u).forEach(p);let b=gr.get(e);b&&(b.delete(r),b.size===0&&gr.delete(e))}}function Ju(){if(typeof globalThis!="undefined")return globalThis;if(typeof self!="undefined")return self;if(typeof window!="undefined")return window;if(typeof global!="undefined")return global}function Go(e,t){let n=Ju();return n?(n[e]||(n[e]=t()),n[e]):t()}var Ft=Go("__zag__refSet",()=>new WeakSet);var Qu=e=>typeof e=="object"&&e!==null&&"$$typeof"in e&&"props"in e,ed=e=>typeof e=="object"&&e!==null&&"__v_isVNode"in e,td=e=>typeof e=="object"&&e!==null&&"nodeType"in e&&typeof e.nodeName=="string",nd=e=>Qu(e)||ed(e)||td(e),hr=e=>e!==null&&typeof e=="object",zo=e=>hr(e)&&!Ft.has(e)&&(Array.isArray(e)||!(Symbol.iterator in e))&&!nd(e)&&!(e instanceof WeakMap)&&!(e instanceof WeakSet)&&!(e instanceof Error)&&!(e instanceof Number)&&!(e instanceof Date)&&!(e instanceof String)&&!(e instanceof RegExp)&&!(e instanceof ArrayBuffer)&&!(e instanceof Promise)&&!(e instanceof File)&&!(e instanceof Blob)&&!(e instanceof AbortController),hn=()=>!1;var rd=Symbol();var hc=Object.getPrototypeOf,Xo=new WeakMap,od=e=>e&&(Xo.has(e)?Xo.get(e):hc(e)===Object.prototype||hc(e)===Array.prototype);var pc=e=>od(e)&&e[rd]||null,Jo=(e,t=!0)=>{Xo.set(e,t)};var gt=Go("__zag__proxyStateMap",()=>new WeakMap),ad=(e=Object.is,t=(i,c)=>new Proxy(i,c),n=new WeakMap,r=(i,c)=>{let u=n.get(i);if((u==null?void 0:u[0])===c)return u[1];let f=Array.isArray(i)?[]:Object.create(Object.getPrototypeOf(i));return Jo(f,!0),n.set(i,[c,f]),Reflect.ownKeys(i).forEach(h=>{let p=Reflect.get(i,h);Ft.has(p)?(Jo(p,!1),f[h]=p):gt.has(p)?f[h]=yc(p):f[h]=p}),Object.freeze(f)},o=new WeakMap,a=[1,1],s=i=>{if(!hr(i))throw new Error("object required");let c=o.get(i);if(c)return c;let u=a[0],f=new Set,h=(O,C=++a[0])=>{u!==C&&(u=C,f.forEach(T=>T(O,C)))},p=a[1],g=(O=++a[1])=>(p!==O&&!f.size&&(p=O,l.forEach(([C])=>{let T=C[1](O);T>u&&(u=T)})),u),d=O=>(C,T)=>{let S=[...C];S[1]=[O,...S[1]],h(S,T)},l=new Map,b=(O,C)=>{if(hn()&&l.has(O))throw new Error("prop listener already exists");if(f.size){let T=C[3](d(O));l.set(O,[C,T])}else l.set(O,[C])},y=O=>{var T;let C=l.get(O);C&&(l.delete(O),(T=C[1])==null||T.call(C))},A=O=>(f.add(O),f.size===1&&l.forEach(([T,S],V)=>{if(hn()&&S)throw new Error("remove already exists");let L=T[3](d(V));l.set(V,[T,L])}),()=>{f.delete(O),f.size===0&&l.forEach(([T,S],V)=>{S&&(S(),l.set(V,[T]))})}),D=Array.isArray(i)?[]:Object.create(Object.getPrototypeOf(i)),E=t(D,{deleteProperty(O,C){let T=Reflect.get(O,C);y(C);let S=Reflect.deleteProperty(O,C);return S&&h(["delete",[C],T]),S},set(O,C,T,S){var q;let V=Reflect.has(O,C),L=Reflect.get(O,C,S);if(V&&(e(L,T)||o.has(T)&&e(L,o.get(T))))return!0;y(C),hr(T)&&(T=pc(T)||T);let F=T;if(!((q=Object.getOwnPropertyDescriptor(O,C))!=null&&q.set)){!gt.has(T)&&zo(T)&&(F=pr(T));let H=!Ft.has(F)&&gt.get(F);H&&b(C,H)}return Reflect.set(O,C,F,S),h(["set",[C],T,L]),!0}});o.set(i,E);let P=[D,g,r,A];return gt.set(E,P),Reflect.ownKeys(i).forEach(O=>{let C=Object.getOwnPropertyDescriptor(i,O);C.get||C.set?Object.defineProperty(D,O,C):E[O]=i[O]}),E})=>[s,gt,Ft,e,t,zo,n,r,o,a],[sd]=ad();function pr(e={}){return sd(e)}function yr(e,t,n){let r=gt.get(e);hn()&&!r&&console.warn("Please use proxy object");let o,a=[],s=r[3],i=!1,u=s(f=>{if(a.push(f),n){t(a.splice(0));return}o||(o=Promise.resolve().then(()=>{o=void 0,i&&t(a.splice(0))}))});return i=!0,()=>{i=!1,u()}}function yc(e){let t=gt.get(e);hn()&&!t&&console.warn("Please use proxy object");let[n,r,o]=t;return o(n,r())}function pn(e){var a,s;let t=(a=e().value)!=null?a:e().defaultValue;e().debug&&console.log(`[bindable > ${e().debug}] initial`,t);let n=(s=e().isEqual)!=null?s:Object.is,r=pr({value:t}),o=()=>e().value!==void 0;return{initial:t,ref:r,get(){return o()?e().value:r.value},set(i){var f,h;let c=o()?e().value:r.value,u=Fe(i)?i(c):i;e().debug&&console.log(`[bindable > ${e().debug}] setValue`,{next:u,prev:c}),o()||(r.value=u),n(u,c)||(h=(f=e()).onChange)==null||h.call(f,u,c)},invoke(i,c){var u,f;(f=(u=e()).onChange)==null||f.call(u,i,c)},hash(i){var c,u,f;return(f=(u=(c=e()).hash)==null?void 0:u.call(c,i))!=null?f:String(i)}}}pn.cleanup=e=>{};pn.ref=e=>{let t=e;return{get:()=>t,set:n=>{t=n}}};function vc(e){let t={current:e};return{get(n){return t.current[n]},set(n,r){t.current[n]=r}}}function Qo(e,t){if(!dt(e)||!dt(t))return t===void 0?e:t;let n=R({},e);for(let r of Object.keys(t)){let o=t[r],a=e[r];o!==void 0&&(dt(a)&&dt(o)?n[r]=Qo(a,o):n[r]=o)}return n}var ea=class{constructor(e,t={}){var h,p,g;_(this,"machine",e),_(this,"scope"),_(this,"context"),_(this,"prop"),_(this,"state"),_(this,"refs"),_(this,"computed"),_(this,"event",{type:""}),_(this,"previousEvent",{type:""}),_(this,"effects",new Map),_(this,"replaceTracker",Pi()),_(this,"transition",null),_(this,"cleanups",[]),_(this,"subscriptions",[]),_(this,"userPropsRef"),_(this,"getEvent",()=>I(R({},this.event),{current:()=>this.event,previous:()=>this.previousEvent})),_(this,"getState",()=>I(R({},this.state),{matches:(...d)=>d.some(l=>Ni(this.state.get(),l)),hasTag:d=>Fi(this.machine,this.state.get(),d)})),_(this,"debug",(...d)=>{this.machine.debug&&console.log(...d)}),_(this,"notify",()=>{this.publish()}),_(this,"send",d=>{if(this.status!==Lt.Started)return;let l=d==null?void 0:d.replaces,b=l?this.replaceTracker.claim(l):void 0;queueMicrotask(()=>{var C;if(!d||l&&b&&this.replaceTracker.isReplaced(l,b))return;this.previousEvent=this.event,this.event=d,this.debug("send",d);let y=this.state.get(),A=d.type,{transitions:D,source:$}=ki(this.machine,y,A),E=this.choose(D);if(!E)return;this.transition=E;let P=Fo(this.machine,(C=E.target)!=null?C:y,$);this.debug("transition",E),P!==y?this.state.set(P):E.reenter?this.state.invoke(y,y):this.action(E.actions)})}),_(this,"action",d=>{let l=Fe(d)?d(this.getParams()):d;if(!l)return;let b=l.map(y=>{var D,$;let A=($=(D=this.machine.implementations)==null?void 0:D.actions)==null?void 0:$[y];return A||It(`[zag-js] No implementation found for action "${JSON.stringify(y)}"`),A});for(let y of b)y==null||y(this.getParams())}),_(this,"guard",d=>{var b,y;if(Fe(d))return d(this.getParams());let l=(y=(b=this.machine.implementations)==null?void 0:b.guards)==null?void 0:y[d];return l||It(`[zag-js] No implementation found for guard "${JSON.stringify(d)}"`),l==null?void 0:l(this.getParams())}),_(this,"effect",d=>{let l=Fe(d)?d(this.getParams()):d;if(!l)return;let b=l.map(A=>{var $,E;let D=(E=($=this.machine.implementations)==null?void 0:$.effects)==null?void 0:E[A];return D||It(`[zag-js] No implementation found for effect "${JSON.stringify(A)}"`),D}),y=[];for(let A of b){let D=A==null?void 0:A(this.getParams());D&&y.push(D)}return()=>y.forEach(A=>A==null?void 0:A())}),_(this,"choose",d=>ei(d).find(l=>{let b=!l.guard;return ni(l.guard)?b=!!this.guard(l.guard):Fe(l.guard)&&(b=l.guard(this.getParams())),b})),_(this,"subscribe",d=>(this.subscriptions.push(d),()=>{let l=this.subscriptions.indexOf(d);l>-1&&this.subscriptions.splice(l,1)})),_(this,"status",Lt.NotStarted),_(this,"publish",()=>{this.callTrackers(),this.subscriptions.forEach(d=>d(this.service))}),_(this,"trackers",[]),_(this,"setupTrackers",()=>{var d,l;(l=(d=this.machine).watch)==null||l.call(d,this.getParams())}),_(this,"callTrackers",()=>{this.trackers.forEach(({deps:d,fn:l})=>{let b=d.map(y=>y());Rt(l.prev,b)||(l(),l.prev=b)})}),_(this,"getParams",()=>({state:this.getState(),context:this.context,event:this.getEvent(),prop:this.prop,send:this.send,action:this.action,guard:this.guard,track:(d,l)=>{l.prev=d.map(b=>b()),this.trackers.push({deps:d,fn:l})},refs:this.refs,computed:this.computed,flush:ai,scope:this.scope,choose:this.choose})),this.userPropsRef={current:t};let{id:n,ids:r,getRootNode:o}=nn(t);this.scope=Wi({id:n,ids:r,getRootNode:o});let a=d=>{var y,A;let l=nn(this.userPropsRef.current);return((A=(y=e.props)==null?void 0:y.call(e,{props:rn(l),scope:this.scope}))!=null?A:l)[d]};this.prop=a;let s=(h=e.context)==null?void 0:h.call(e,{prop:a,bindable:pn,scope:this.scope,flush(d){queueMicrotask(d)},getContext(){return i},getComputed(){return c},getRefs(){return u},getEvent:this.getEvent.bind(this)});s&&Object.values(s).forEach(d=>{let l=yr(d.ref,()=>this.notify());this.cleanups.push(l)});let i={get(d){return s==null?void 0:s[d].get()},set(d,l){s==null||s[d].set(l)},initial(d){return s==null?void 0:s[d].initial},hash(d){let l=s==null?void 0:s[d].get();return s==null?void 0:s[d].hash(l)}};this.context=i;let c=d=>(on(e.computed,()=>"[zag-js] No computed object found on machine"),e.computed[d]({context:i,event:this.getEvent(),prop:a,refs:this.refs,scope:this.scope,computed:c}));this.computed=c;let u=vc((g=(p=e.refs)==null?void 0:p.call(e,{prop:a,context:i}))!=null?g:{});this.refs=u;let f=pn(()=>({defaultValue:Fo(e,e.initialState({prop:a})),onChange:(d,l)=>{var A,D;let{exiting:b,entering:y}=Li(this.machine,l,d,(A=this.transition)==null?void 0:A.reenter);if(b.forEach($=>{let E=this.effects.get($.path);E==null||E(),this.effects.delete($.path)}),b.forEach($=>{var E;this.action((E=$.state)==null?void 0:E.exit)}),this.action((D=this.transition)==null?void 0:D.actions),y.forEach($=>{var P;let E=this.effect((P=$.state)==null?void 0:P.effects);if(E){let O=this.effects.get($.path);this.effects.set($.path,O?Ct(O,E):E)}}),l===dn){this.action(e.entry);let $=this.effect(e.effects);if($){let E=this.effects.get(dn);this.effects.set(dn,E?Ct(E,$):$)}}y.forEach($=>{var E;this.action((E=$.state)==null?void 0:E.entry)})}}));this.state=f,this.cleanups.push(yr(this.state.ref,()=>this.notify()))}updateProps(e){let t=this.userPropsRef.current;this.userPropsRef.current=()=>{let n=nn(t),r=nn(e);return Qo(n,r)},this.notify()}start(){this.status=Lt.Started,this.debug("initializing..."),this.state.invoke(this.state.initial,dn),this.setupTrackers()}stop(){this.effects.forEach(e=>e==null?void 0:e()),this.effects.clear(),this.transition=null,this.action(this.machine.exit),this.cleanups.forEach(e=>e()),this.cleanups=[],this.subscriptions=[],this.status=Lt.Stopped,this.debug("unmounting...")}get service(){return{state:this.getState(),send:this.send,context:this.context,prop:this.prop,scope:this.scope,refs:this.refs,computed:this.computed,event:this.getEvent(),getStatus:()=>this.status}}};var id=".pagecraft-form[data-pagecraft-controls]",cd=\'<svg aria-hidden="true" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 2v3m8-3v3"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/></g></svg>\',ld=\'<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 18-6-6 6-6"/></svg>\',ud=\'<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 18 6-6-6-6"/></svg>\';function Ge(e){if(/^\\d{4}-\\d{2}-\\d{2}$/.test(e))try{let t=fr(e);return t.toString()===e?t:void 0}catch(t){return}}function dd(e,t){if(e.dataset.pagecraftEnhanced)return;e.dataset.pagecraftEnhanced="true";let n=e.value,r=e.defaultValue,o=Ge(n),a=Ge(e.getAttribute("min")||""),s=Ge(e.getAttribute("max")||""),i=new Set((e.dataset.pagecraftUnavailableDates||e.dataset.unavailableDates||"").split(",").map(k=>k.trim()).filter(k=>Ge(k))),c=`pagecraft-date-${e.id||t}`,u=e.id||`${c}-input`,f=e.name,h=e.getAttribute("placeholder")||"YYYY-MM-DD";e.type="text",e.id=u,e.pattern="\\\\d{4}-\\\\d{2}-\\\\d{2}",e.inputMode="text",e.classList.add("pc-date-input");let p=document.createElement("div");p.className="pc-date";let g=document.createElement("div");g.className="pc-date-control";let d=document.createElement("button");d.className="pc-date-trigger",d.innerHTML=cd;let l=document.createElement("div");l.className="pc-date-positioner",l.dataset.pagecraftDatePopover="";let b=document.createElement("div");b.className="pc-date-content",e.before(p),p.append(g),document.body.append(l),g.append(e,d),l.append(b);let y,A=[],D=n,$="",E=!1,P=!1,O=()=>{let k=e.value.trim(),B="",j=k?Ge(k):void 0;return k&&!j?B="Enter a date in YYYY-MM-DD format.":j&&a&&j.compare(a)<0?B=`Choose ${a.toString()} or later.`:j&&s&&j.compare(s)>0?B=`Choose ${s.toString()} or earlier.`:j&&i.has(j.toString())&&(B="That date is unavailable."),e.setCustomValidity(B),E?e.setAttribute("aria-invalid",String(!e.validity.valid)):e.removeAttribute("aria-invalid"),!B},C=new ea(jo,{id:c,ids:{root:`${c}-root`,control:`${c}-control`,input:()=>u,trigger:`${c}-trigger`,positioner:`${c}-positioner`,content:`${c}-content`},name:f,locale:document.documentElement.lang||"en-US",required:e.required,disabled:e.disabled,min:a,max:s,defaultValue:o?[o]:[],defaultFocusedValue:o,openOnClick:!0,placeholder:h,format:k=>k.toString(),parse:k=>Ge(k),isDateUnavailable:k=>i.has(k.toString()),positioning:{placement:"bottom-start",gutter:6,fitViewport:!0},onValueChange(k){let B=k.valueAsString[0]||"",j=B!==D;D=B,j&&($=""),e.value=B,O(),j&&queueMicrotask(()=>{P||(A.forEach(fe=>fe()),A=[],e.value=B,e.dispatchEvent(new Event("input",{bubbles:!0})),e.dispatchEvent(new Event("change",{bubbles:!0})),L())})}}),T=(k,B)=>A.push(Zo(k,B,c)),S=()=>{let k=getComputedStyle(e);for(let B of["--f-text","--f-bg","--f-border","--f-radius","--f-pad","--f-btn-bg","--f-btn-fg","--f-label"]){let j=k.getPropertyValue(B);j&&l.style.setProperty(B,j)}l.style.font=k.font},V=(k,B,j)=>{let fe=document.createElement(k);return B&&(fe.className=B),j!=null&&(fe.textContent=j),fe},L=()=>{if(P)return;let k=e.value,B=b.contains(document.activeElement)?document.activeElement.dataset.part:void 0;A.forEach(m=>m()),A=[],y=Wo(C.service,Ko),T(p,y.getRootProps()),T(g,y.getControlProps());let j=y.getInputProps({fixOnBlur:!1});delete j.onbeforeinput,delete j.oninput,delete j.onkeydown,delete j.value,T(e,j),e.value=k,e.classList.add("pc-date-input"),e.defaultValue=r,T(d,y.getTriggerProps()),d.classList.add("pc-date-trigger"),T(l,y.getPositionerProps()),l.classList.add("pc-date-positioner"),l.dataset.pagecraftDatePopover="",S(),T(b,y.getContentProps()),b.classList.add("pc-date-content");let fe=V("div","pc-date-head"),mt=V("button","pc-date-nav");mt.innerHTML=ld;let yn=V("div","pc-date-month",y.visibleRangeText.start),_e=V("button","pc-date-nav");_e.innerHTML=ud,T(fe,y.getViewControlProps({view:"day"})),T(mt,y.getPrevTriggerProps({view:"day"})),T(_e,y.getNextTriggerProps({view:"day"})),fe.append(mt,yn,_e);let We=V("table","pc-date-table"),ze=V("thead"),Bt=V("tr");T(We,y.getTableProps({view:"day"})),T(ze,y.getTableHeadProps({view:"day"})),T(Bt,y.getTableRowProps({view:"day"})),y.weekDays.forEach(m=>{let v=V("th",void 0,m.narrow);v.setAttribute("scope","col"),v.setAttribute("aria-label",m.long),Bt.append(v)}),ze.append(Bt);let w=V("tbody");T(w,y.getTableBodyProps({view:"day"})),y.weeks.forEach((m,v)=>{let x=V("tr");T(x,y.getTableRowProps({view:"day"})),m.forEach(N=>{let X=V("td"),Z=V("button","pc-date-day",String(N.day));T(X,y.getDayTableCellProps({value:N,visibleRange:y.visibleRange})),T(Z,y.getDayTableCellTriggerProps({value:N,visibleRange:y.visibleRange})),Z.classList.add("pc-date-day"),Z.type="button",X.append(Z),x.append(X)}),x.dataset.row=String(v),w.append(x)}),We.append(ze,w),b.replaceChildren(fe,We),(B==="prev-trigger"||B==="next-trigger")&&requestAnimationFrame(()=>requestAnimationFrame(()=>{if(P)return;let m=document.activeElement,v=b.querySelector(`[data-part="${B}"]`);v&&(!m||!m.isConnected||m===document.body)&&v.focus()}))},F=C.subscribe(L);C.start(),L();let q=()=>{$=O()?"":e.value},H=()=>{if(E=!0,!O())$=e.value;else{$="";let B=Ge(e.value.trim());B&&B.toString()!==D?y.setValue([B]):!e.value.trim()&&D&&y.clearValue()}window.setTimeout(()=>{P||$&&(e.value=$,O())})},oe=()=>{E=!0,$&&(e.value=$),O()},Q=e.form,de=()=>window.setTimeout(()=>{if(P)return;e.value=r;let k=Ge(r);D=r,$="",E=!1,y.setValue(k?[k]:[]),O()});e.addEventListener("input",q),e.addEventListener("blur",H),e.addEventListener("invalid",oe),Q==null||Q.addEventListener("reset",de);let W=window.__pagecraftRegisterPreviewDispose;W==null||W(()=>{P||(P=!0,F(),C.stop(),A.forEach(k=>k()),A=[],e.removeEventListener("input",q),e.removeEventListener("blur",H),e.removeEventListener("invalid",oe),Q==null||Q.removeEventListener("reset",de),l.remove())}),O()}document.querySelectorAll(id).forEach(e=>{e.querySelectorAll(\'input[type="date"][data-pagecraft-date]\').forEach(dd)});})();\n<\/script>';var na='.pagecraft-section[data-floating="1"]:not([data-floating-edit]){position:absolute;inset-inline:0;inset-block-start:0;z-index:40}:where(.pagecraft-section[data-floating="1"]:not([data-floating-edit])){background:transparent}',ia=`.pagecraft-audio{display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;background:var(--au-bg,#f6f6f3);color:var(--au-text,#18181b);border:1px solid var(--au-line,rgba(0,0,0,.12));border-radius:var(--au-radius,12px);box-sizing:border-box}
.pagecraft-audio-art{width:56px;height:56px;border-radius:calc(var(--au-radius,12px) * .65);object-fit:cover;flex:none;background:rgba(0,0,0,.06)}
.pagecraft-audio-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:8px}
.pagecraft-audio-head{min-width:0;display:flex;flex-direction:column;gap:2px}
.pagecraft-audio-title{font-weight:600;font-size:var(--au-title-size,15px);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pagecraft-audio-sub{font-size:13px;line-height:1.35;color:var(--au-muted,#666);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pagecraft-audio-bar{display:flex;align-items:center;gap:12px}
.pagecraft-audio-btn{width:40px;height:40px;border-radius:999px;border:0;background:var(--au-accent,#18181b);color:var(--au-accent-ink,#ffffff);display:inline-grid;place-items:center;flex:none;cursor:pointer;padding:0;transition:transform .15s ease,opacity .15s ease}
.pagecraft-audio-btn:hover:not([disabled]){transform:scale(1.04)}
.pagecraft-audio-btn[disabled]{opacity:.45;cursor:not-allowed}
.pagecraft-audio-ic-pause{display:none}
.pagecraft-audio[data-playing] .pagecraft-audio-ic-play{display:none}
.pagecraft-audio[data-playing] .pagecraft-audio-ic-pause{display:block}
.pagecraft-audio-track{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.pagecraft-audio-range{width:100%;margin:0;accent-color:var(--au-accent,#18181b);cursor:pointer}
.pagecraft-audio-range[disabled]{cursor:not-allowed;opacity:.45}
.pagecraft-audio-times{display:flex;justify-content:space-between;font-size:12px;line-height:1.2;font-variant-numeric:tabular-nums;color:var(--au-muted,#666)}
.pagecraft-audio-rate{min-height:32px;padding:4px 9px;border:1px solid var(--au-line,rgba(0,0,0,.16));border-radius:999px;background:transparent;color:inherit;font:600 12px/1 inherit;cursor:pointer;flex:none}
.pagecraft-audio-btn:focus-visible,.pagecraft-audio-range:focus-visible,.pagecraft-audio-rate:focus-visible{outline:2px solid var(--au-accent,currentColor);outline-offset:2px}
.pagecraft-audio-native{display:block;width:100%;margin-top:4px;height:36px}
.pagecraft-audio[data-audio-edit] .pagecraft-audio-native,.pagecraft-audio[data-pc-audio-ready] .pagecraft-audio-native{display:none}
.pagecraft-audio[data-audio-compact] .pagecraft-audio-track,.pagecraft-audio[data-audio-compact] .pagecraft-audio-rate{display:none}`,oa=`<script>
(function(){
  var players=[];
  function fmt(sec){
    if(!isFinite(sec)||sec<0)return '0:00';
    var total=Math.floor(sec);
    var h=Math.floor(total/3600);
    var m=Math.floor((total%3600)/60);
    var s=total%60;
    return (h>0?h+':'+(m<10?'0':'')+m:String(m))+':'+(s<10?'0':'')+s;
  }
  function pauseOthers(current){
    document.querySelectorAll('.pagecraft-audio audio').forEach(function(other){
      if(other!==current&&!other.paused)try{other.pause();}catch(e){}
    });
  }
  document.querySelectorAll('.pagecraft-audio[data-audio]').forEach(function(root){
    if(root.hasAttribute('data-pc-audio-ready'))return;
    var el=root.querySelector('audio.pagecraft-audio-native');
    var btn=root.querySelector('[data-audio-toggle]');
    var seek=root.querySelector('[data-audio-seek]');
    var cur=root.querySelector('[data-audio-cur]');
    var dur=root.querySelector('[data-audio-dur]');
    var rateBtn=root.querySelector('[data-audio-rate]');
    if(!el||!btn)return;
    root.setAttribute('data-pc-audio-ready','');
    var title=root.getAttribute('data-audio-title')||'audio';
    var rates=[1,1.25,1.5,2];
    var rateIndex=0;
    function syncTime(){
      var d=el.duration;
      var t=el.currentTime||0;
      if(cur)cur.textContent=fmt(t);
      if(dur&&isFinite(d)&&d>0)dur.textContent=fmt(d);
      if(seek&&isFinite(d)&&d>0)seek.value=String(Math.min(100,Math.max(0,(t/d)*100)));
    }
    function syncState(){
      var playing=!el.paused&&!el.ended;
      if(playing)root.setAttribute('data-playing','');
      else root.removeAttribute('data-playing');
      btn.setAttribute('aria-pressed',playing?'true':'false');
      btn.setAttribute('aria-label',(playing?'Pause ':'Play ')+title);
    }
    function onToggle(){
      if(btn.disabled)return;
      if(el.paused||el.ended){
        pauseOthers(el);
        try{
          var res=el.play();
          if(res&&typeof res.catch==='function')res.catch(function(){syncState();});
        }catch(e){syncState();}
      }else{
        try{el.pause();}catch(e){}
      }
      syncState();
    }
    function onSeek(){
      if(!seek)return;
      var d=el.duration;
      if(!isFinite(d)||d<=0)return;
      var pct=parseFloat(seek.value);
      if(isFinite(pct))el.currentTime=Math.max(0,Math.min(d,(pct/100)*d));
      syncTime();
    }
    function onRate(){
      if(!rateBtn)return;
      rateIndex=(rateIndex+1)%rates.length;
      var next=rates[rateIndex];
      el.playbackRate=next;
      rateBtn.textContent=next+'x';
      rateBtn.setAttribute('aria-label','Playback speed: '+next+'x');
    }
    btn.addEventListener('click',onToggle);
    if(seek)seek.addEventListener('input',onSeek);
    if(rateBtn)rateBtn.addEventListener('click',onRate);
    el.addEventListener('timeupdate',syncTime);
    el.addEventListener('loadedmetadata',syncTime);
    el.addEventListener('durationchange',syncTime);
    el.addEventListener('play',syncState);
    el.addEventListener('pause',syncState);
    el.addEventListener('ended',syncState);
    syncTime();syncState();
    players.push(function(){
      try{el.pause();}catch(e){}
      btn.removeEventListener('click',onToggle);
      if(seek)seek.removeEventListener('input',onSeek);
      if(rateBtn)rateBtn.removeEventListener('click',onRate);
      el.removeEventListener('timeupdate',syncTime);
      el.removeEventListener('loadedmetadata',syncTime);
      el.removeEventListener('durationchange',syncTime);
      el.removeEventListener('play',syncState);
      el.removeEventListener('pause',syncState);
      el.removeEventListener('ended',syncState);
      root.removeAttribute('data-pc-audio-ready');
      root.removeAttribute('data-playing');
    });
  });
  if(players.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      players.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,sa=`.pagecraft-countdown{width:100%;color:var(--cd2-text,inherit)}
.pagecraft-countdown-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,1fr));gap:var(--cd2-gap,12px)}
.pagecraft-countdown-grid[hidden],.pagecraft-countdown-done[hidden]{display:none}
.pagecraft-countdown-unit{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:16px 12px;background:var(--cd2-card,#f6f6f3);border:1px solid var(--cd2-line,rgba(0,0,0,.1));border-radius:var(--cd2-radius,10px);text-align:center}
.pagecraft-countdown-val{font-size:var(--cd2-num-size,clamp(1.75rem,4vw,2.75rem));font-weight:700;line-height:1;font-variant-numeric:tabular-nums;color:var(--cd2-num,inherit)}
.pagecraft-countdown-lbl{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--cd2-muted,#666)}
.pagecraft-countdown-inline .pagecraft-countdown-grid{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--cd2-gap,20px)}
.pagecraft-countdown-inline .pagecraft-countdown-unit{flex-direction:row;align-items:baseline;gap:6px;padding:0;background:transparent;border:0;border-radius:0}
.pagecraft-countdown-done{padding:14px 16px;border-radius:var(--cd2-radius,10px);background:var(--cd2-card,#f6f6f3);border:1px solid var(--cd2-line,rgba(0,0,0,.1));font-weight:600;text-align:center}`,la=`<script>
(function(){
  var disposers=[];
  function pad(n){return n<10?'0'+n:String(n);}
  document.querySelectorAll('.pagecraft-countdown[data-countdown]').forEach(function(root){
    if(root.hasAttribute('data-pc-cd-ready'))return;
    var raw=root.getAttribute('data-countdown')||'';
    var targetMs=Date.parse(raw);
    if(!isFinite(targetMs))return;
    root.setAttribute('data-pc-cd-ready','');
    var grid=root.querySelector('[data-cd-grid]');
    var ended=root.querySelector('[data-cd-ended]');
    var uD=root.querySelector('[data-cd-unit="d"]');
    var uH=root.querySelector('[data-cd-unit="h"]');
    var uM=root.querySelector('[data-cd-unit="m"]');
    var uS=root.querySelector('[data-cd-unit="s"]');
    var timer=0;
    function stop(){if(timer){clearInterval(timer);timer=0;}}
    function tick(){
      var diff=targetMs-Date.now();
      if(diff<=0){
        if(uD)uD.textContent='0';
        if(uH)uH.textContent='00';
        if(uM)uM.textContent='00';
        if(uS)uS.textContent='00';
        if(grid)grid.hidden=true;
        if(ended)ended.hidden=false;
        stop();
        return false;
      }
      var totalSec=Math.floor(diff/1000);
      var days=Math.floor(totalSec/86400);
      var hours=Math.floor((totalSec%86400)/3600);
      var mins=Math.floor((totalSec%3600)/60);
      var secs=totalSec%60;
      if(grid)grid.hidden=false;
      if(ended)ended.hidden=true;
      if(uD)uD.textContent=String(days);
      if(uH)uH.textContent=pad(hours);
      if(uM)uM.textContent=pad(mins);
      if(uS)uS.textContent=pad(secs);
      return true;
    }
    if(tick())timer=setInterval(tick,1000);
    disposers.push(function(){
      stop();
      root.removeAttribute('data-pc-cd-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,ca=`.pagecraft-marquee{display:flex;overflow:hidden;user-select:none;gap:var(--mq-gap,32px);width:100%}
.pagecraft-marquee[data-marquee-edit]{flex-wrap:wrap;overflow:visible}
.pagecraft-marquee-fade{-webkit-mask-image:linear-gradient(to right,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(to right,transparent,#000 8%,#000 92%,transparent)}
.pagecraft-marquee-track{display:flex;align-items:center;flex:none;min-width:100%;gap:var(--mq-gap,32px);animation:pagecraft-marquee var(--mq-speed,28s) linear infinite}
.pagecraft-marquee[data-marquee-edit] .pagecraft-marquee-track{animation:none;flex-wrap:wrap;width:100%;min-width:0}
.pagecraft-marquee[data-marquee-dir=right] .pagecraft-marquee-track{animation-direction:reverse}
.pagecraft-marquee[data-marquee-pause="1"]:hover .pagecraft-marquee-track,.pagecraft-marquee[data-marquee-pause="1"]:focus-within .pagecraft-marquee-track{animation-play-state:paused}
@keyframes pagecraft-marquee{from{transform:translateX(0)}to{transform:translateX(calc(-100% - var(--mq-gap,32px)))}}
@media (prefers-reduced-motion:reduce){.pagecraft-marquee{flex-wrap:wrap;overflow:visible;-webkit-mask-image:none;mask-image:none}.pagecraft-marquee-track{animation:none;flex-wrap:wrap;width:100%;min-width:0}.pagecraft-marquee-dup{display:none}}`,ua=`.pagecraft-filter{display:flex;flex-direction:column;gap:var(--fl-gap,24px);width:100%}
.pagecraft-filter-bar{position:relative;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.pagecraft-filter-pill{position:absolute;top:0;left:0;z-index:0;border-radius:var(--fl-pill-radius,999px);background:var(--fl-accent,#18181b);pointer-events:none;opacity:0;transition:transform .36s cubic-bezier(.22,1.18,.36,1),width .36s cubic-bezier(.22,1.18,.36,1),height .36s cubic-bezier(.22,1.18,.36,1),opacity .18s ease}
.pagecraft-filter-pill[data-pill-ready]{opacity:1}
.pagecraft-filter-pill[data-pill-init]{transition:none}
.pagecraft-filter-btn{position:relative;z-index:1;min-height:38px;padding:7px 15px;border-radius:var(--fl-pill-radius,999px);border:1px solid var(--fl-line,rgba(0,0,0,.16));background:var(--fl-btn-bg,transparent);color:var(--fl-btn-text,inherit);font:500 14px/1.2 inherit;cursor:pointer;transition:background-color .15s ease,color .18s ease,border-color .18s ease}
.pagecraft-filter-btn:hover{border-color:var(--fl-accent,currentColor)}
.pagecraft-filter-btn:focus-visible{outline:2px solid var(--fl-accent,currentColor);outline-offset:2px}
.pagecraft-filter-btn.is-active,.pagecraft-filter-btn[aria-selected=true]{background:var(--fl-accent,#18181b);color:var(--fl-accent-ink,#ffffff);border-color:var(--fl-accent,#18181b)}
.pagecraft-filter-bar[data-filter-spring] .pagecraft-filter-btn.is-active,.pagecraft-filter-bar[data-filter-spring] .pagecraft-filter-btn[aria-selected=true]{background:transparent;border-color:transparent}
.pagecraft-filter-grid{display:grid;grid-template-columns:var(--fl-cols,minmax(0,1fr));gap:var(--fl-gap,20px)}
.pagecraft-filter [data-filter-hidden]{display:none !important}
.pagecraft-filter-empty{margin:0;padding:20px;border:1px dashed var(--fl-line,rgba(0,0,0,.16));border-radius:10px;text-align:center;color:var(--fl-muted,#666)}
.pagecraft-filter-empty[hidden]{display:none}
@media (prefers-reduced-motion:reduce){.pagecraft-filter-pill{transition:none}}`,da=`<script>
(function(){
  var disposers=[];
  function splitTags(str){
    return String(str||'').split(',').map(function(s){return s.trim().toLowerCase();}).filter(Boolean);
  }
  document.querySelectorAll('.pagecraft-filter[data-filter-group]').forEach(function(root){
    if(root.hasAttribute('data-pc-filter-ready'))return;
    var bar=root.querySelector(':scope > .pagecraft-filter-bar');
    var btns=Array.from(root.querySelectorAll(':scope > .pagecraft-filter-bar [data-filter-btn]'));
    if(!btns.length)return;
    root.setAttribute('data-pc-filter-ready','');
    var items=Array.from(root.querySelectorAll('[data-filter-tags]'));
    var empty=root.querySelector(':scope > [data-filter-empty]');
    var pill=null;
    if(bar){
      pill=document.createElement('span');
      pill.className='pagecraft-filter-pill';
      pill.setAttribute('aria-hidden','true');
      pill.setAttribute('data-pill-init','1');
      bar.insertBefore(pill,bar.firstChild);
    }
    var activeBtn=btns[0];
    function movePill(instant){
      if(!pill||!bar||!activeBtn)return;
      var w=activeBtn.offsetWidth,h=activeBtn.offsetHeight;
      if(!w||!h)return;
      if(instant)pill.setAttribute('data-pill-init','1');
      else pill.removeAttribute('data-pill-init');
      bar.setAttribute('data-filter-spring','1');
      pill.style.width=w+'px';
      pill.style.height=h+'px';
      pill.style.transform='translate3d('+activeBtn.offsetLeft+'px,'+activeBtn.offsetTop+'px,0)';
      pill.setAttribute('data-pill-ready','1');
      if(instant&&typeof requestAnimationFrame==='function'){
        requestAnimationFrame(function(){if(pill)pill.removeAttribute('data-pill-init');});
      }
    }
    function selectTag(tag,focusBtn,instant){
      var want=String(tag||'*').trim().toLowerCase();
      var shown=0;
      btns.forEach(function(btn){
        var bTag=String(btn.getAttribute('data-filter-tag')||'*').trim().toLowerCase();
        var active=bTag===want;
        btn.classList.toggle('is-active',active);
        btn.setAttribute('aria-selected',active?'true':'false');
        btn.setAttribute('tabindex',active?'0':'-1');
        if(active){activeBtn=btn;if(focusBtn)try{btn.focus();}catch(e){}}
      });
      movePill(!!instant);
      items.forEach(function(item){
        var itemTags=splitTags(item.getAttribute('data-filter-tags'));
        var match=want==='*'||itemTags.indexOf(want)>=0;
        if(match){item.removeAttribute('data-filter-hidden');item.hidden=false;shown++;}
        else{item.setAttribute('data-filter-hidden','');item.hidden=true;}
      });
      if(empty)empty.hidden=!(want!=='*'&&items.length>0&&shown===0);
    }
    var onClicks=[];
    btns.forEach(function(btn,idx){
      function onClick(){selectTag(btn.getAttribute('data-filter-tag'),false,false);}
      function onKey(e){
        var next=-1;
        if(e.key==='ArrowRight')next=(idx+1)%btns.length;
        else if(e.key==='ArrowLeft')next=(idx-1+btns.length)%btns.length;
        else if(e.key==='Home')next=0;
        else if(e.key==='End')next=btns.length-1;
        if(next>=0){e.preventDefault();selectTag(btns[next].getAttribute('data-filter-tag'),true,false);}
      }
      btn.addEventListener('click',onClick);
      btn.addEventListener('keydown',onKey);
      onClicks.push(function(){btn.removeEventListener('click',onClick);btn.removeEventListener('keydown',onKey);});
    });
    function onResize(){movePill(true);}
    window.addEventListener('resize',onResize);
    selectTag('*',false,true);
    disposers.push(function(){
      window.removeEventListener('resize',onResize);
      onClicks.forEach(function(off){off();});
      if(pill&&pill.parentNode)pill.parentNode.removeChild(pill);
      if(bar)bar.removeAttribute('data-filter-spring');
      items.forEach(function(item){item.removeAttribute('data-filter-hidden');item.hidden=false;});
      if(empty)empty.hidden=true;
      root.removeAttribute('data-pc-filter-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,pa=`.pagecraft-compare{position:relative;width:100%;overflow:clip;border-radius:var(--cmp-radius,12px);aspect-ratio:var(--cmp-ratio,16 / 9);-webkit-user-select:none;user-select:none;touch-action:none;background:var(--c-surface,#14171d);--cmp-pos:50%}
.pagecraft-compare-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;-webkit-user-drag:none}
.pagecraft-compare-before{clip-path:inset(0 calc(100% - var(--cmp-pos,50%)) 0 0)}
.pagecraft-compare-tag{position:absolute;inset-block-end:14px;padding:5px 11px;border-radius:999px;background:rgba(15,18,22,.56);color:#fff;font:600 12px/1.2 inherit;letter-spacing:.05em;text-transform:uppercase;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);pointer-events:none;z-index:2;transition:opacity 120ms ease}
.pagecraft-compare-tag[data-side=before]{inset-inline-start:14px}
.pagecraft-compare-tag[data-side=after]{inset-inline-end:14px}
.pagecraft-compare-tag[data-off]{opacity:0}
.pagecraft-compare-line{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:3;opacity:0;filter:drop-shadow(0 0 6px rgba(255,255,255,.5))}
.pagecraft-compare-line path{fill:none;stroke:var(--cmp-accent,#fff);stroke-width:2}
.pagecraft-compare[data-bending] .pagecraft-compare-line{opacity:1}
.pagecraft-compare-handle{position:absolute;inset-block:0;inset-inline-start:var(--cmp-pos,50%);width:2px;background:var(--cmp-accent,#fff);transform:translateX(-50%);pointer-events:none;z-index:3;box-shadow:0 0 6px rgba(255,255,255,.5),0 0 0 1px rgba(0,0,0,.22)}
.pagecraft-compare[data-bending] .pagecraft-compare-handle{background:transparent;box-shadow:none}
.pagecraft-compare-knob{position:absolute;inset-block-start:50%;inset-inline-start:50%;transform:translate(-50%,-50%) scale(1);width:36px;height:36px;border-radius:999px;background:var(--cmp-accent,#fff);color:var(--cmp-ink,#111311);display:grid;place-items:center;box-shadow:0 2px 12px rgba(23,24,26,.28);transition:transform 220ms cubic-bezier(.24,1.34,.38,1)}
.pagecraft-compare:hover .pagecraft-compare-knob{transform:translate(-50%,-50%) scale(1.08)}
.pagecraft-compare[data-held] .pagecraft-compare-knob{transform:translate(-50%,-50%) scale(.9)}
.pagecraft-compare-range{appearance:none;-webkit-appearance:none;position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;background:transparent;cursor:ew-resize;z-index:4;outline:none}
.pagecraft-compare[data-compare-edit] .pagecraft-compare-range{pointer-events:none}
.pagecraft-compare-range::-webkit-slider-runnable-track{height:100%;background:transparent}
.pagecraft-compare-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:44px;height:100%;background:transparent;border:0}
.pagecraft-compare-range::-moz-range-track{height:100%;background:transparent}
.pagecraft-compare-range::-moz-range-thumb{width:44px;height:100%;background:transparent;border:0}
.pagecraft-compare-range:focus-visible{outline:3px solid var(--cmp-accent,#fff);outline-offset:-3px;box-shadow:inset 0 0 0 5px rgba(0,0,0,.45)}
@media (prefers-reduced-motion:reduce){.pagecraft-compare-knob,.pagecraft-compare-tag{transition:none}}`,fa=`<script>
(function(){
  var disposers=[];
  function clamp(v,lo,hi){return Math.min(hi,Math.max(lo,v));}
  document.querySelectorAll('.pagecraft-compare[data-compare]').forEach(function(root){
    if(root.hasAttribute('data-pc-cmp-ready')||root.hasAttribute('data-compare-edit'))return;
    var range=root.querySelector('[data-compare-range]');
    if(!range)return;
    root.setAttribute('data-pc-cmp-ready','');
    var beforeImg=root.querySelector('.pagecraft-compare-before');
    var lineSvg=root.querySelector('.pagecraft-compare-line');
    var linePath=lineSvg?lineSvg.querySelector('path'):null;
    var tagBefore=root.querySelector('.pagecraft-compare-tag[data-side="before"]');
    var tagAfter=root.querySelector('.pagecraft-compare-tag[data-side="after"]');
    function isReducedMotion(){
      return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    var rawInit=parseFloat(range.value);
    var cur=isFinite(rawInit)?clamp(rawInit,0,100)/100:0.5;
    var target=null;
    var ends={x:cur,v:0};
    var rafId=0;
    var drag=null;
    function syncTags(p){
      if(tagBefore){if(p<0.3)tagBefore.setAttribute('data-off','1');else tagBefore.removeAttribute('data-off');}
      if(tagAfter){if(p>0.7)tagAfter.setAttribute('data-off','1');else tagAfter.removeAttribute('data-off');}
    }
    function clearBend(){
      root.removeAttribute('data-bending');
      if(beforeImg)beforeImg.style.clipPath='';
      if(linePath)linePath.setAttribute('d','');
    }
    function paint(p,bend){
      var pct=Math.round(p*10000)/100;
      root.style.setProperty('--cmp-pos',pct+'%');
      range.value=String(Math.round(pct));
      range.setAttribute('aria-valuetext',Math.round(pct)+'%');
      syncTags(p);
      if(Math.abs(bend)>0.15&&lineSvg&&linePath&&beforeImg){
        var rect=root.getBoundingClientRect();
        var w=rect.width,h=rect.height;
        if(w>0&&h>0){
          var x=p*w;
          var top=(x-bend).toFixed(2);
          var ctrl=(x+bend).toFixed(2);
          var mid=(h/2).toFixed(2);
          var hh=h.toFixed(2);
          lineSvg.setAttribute('viewBox','0 0 '+w+' '+h);
          linePath.setAttribute('d','M '+top+' 0 Q '+ctrl+' '+mid+' '+top+' '+hh);
          beforeImg.style.clipPath='path("M 0 0 L '+top+' 0 Q '+ctrl+' '+mid+' '+top+' '+hh+' L 0 '+hh+' Z")';
          root.setAttribute('data-bending','1');
          return;
        }
      }
      clearBend();
    }
    function loop(){
      if(rafId)return;
      if(isReducedMotion()||typeof requestAnimationFrame!=='function'){
        if(target!==null){cur=target;target=null;}
        ends.x=cur;ends.v=0;
        paint(cur,0);
        return;
      }
      var prev=typeof performance!=='undefined'?performance.now():Date.now();
      function step(t){
        var dt=Math.min(0.033,Math.max(0.001,(t-prev)/1000));
        prev=t;
        if(target!==null){
          cur+=(target-cur)*(1-Math.pow(0.0004,dt));
          if(Math.abs(target-cur)<0.0005){cur=target;target=null;}
        }
        ends.v+=((cur-ends.x)*620-ends.v*44)*dt;
        ends.x+=ends.v*dt;
        var w=root.getBoundingClientRect().width;
        var bend=w>0?clamp((cur-ends.x)*w*0.5,-9,9):0;
        var still=target===null&&Math.abs(cur-ends.x)<0.0006&&Math.abs(ends.v)<0.002;
        if(still){
          ends.x=cur;ends.v=0;
          paint(cur,0);
          rafId=0;
          return;
        }
        paint(cur,bend);
        rafId=requestAnimationFrame(step);
      }
      rafId=requestAnimationFrame(step);
    }
    function glide(to){
      target=clamp(to,0,1);
      loop();
    }
    function place(v){
      target=null;
      cur=clamp(v,0,1);
      paint(cur,0);
      loop();
    }
    function atX(cx){
      var r=root.getBoundingClientRect();
      return r.width>0?clamp((cx-r.left)/r.width,0,1):cur;
    }
    function onInput(){
      var raw=parseFloat(range.value);
      var v=isFinite(raw)?clamp(raw,0,100)/100:0.5;
      target=null;cur=v;ends.x=v;ends.v=0;
      if(rafId){cancelAnimationFrame(rafId);rafId=0;}
      paint(cur,0);
    }
    function onPointerDown(e){
      if(e.button!==undefined&&e.button!==0)return;
      e.preventDefault();
      try{root.setPointerCapture(e.pointerId);}catch(_){}
      try{range.focus({preventScroll:true});}catch(_){}
      var v=atX(e.clientX);
      var now=typeof performance!=='undefined'?performance.now():Date.now();
      drag={v:0,t:now,last:v};
      root.setAttribute('data-held','1');
      glide(v);
    }
    function onPointerMove(e){
      if(!drag)return;
      var v=atX(e.clientX);
      var now=typeof performance!=='undefined'?performance.now():Date.now();
      drag.v=(v-drag.last)/Math.max(1,now-drag.t);
      drag.t=now;
      drag.last=v;
      place(v);
    }
    function onPointerUp(e){
      var d=drag;
      drag=null;
      root.removeAttribute('data-held');
      try{root.releasePointerCapture(e.pointerId);}catch(_){}
      if(d&&Math.abs(d.v)>0.0025){
        glide(d.v>0?1:0);
      }
    }
    function onPointerCancel(){
      drag=null;
      root.removeAttribute('data-held');
    }
    range.addEventListener('input',onInput);
    root.addEventListener('pointerdown',onPointerDown);
    root.addEventListener('pointermove',onPointerMove);
    root.addEventListener('pointerup',onPointerUp);
    root.addEventListener('pointercancel',onPointerCancel);
    paint(cur,0);
    disposers.push(function(){
      if(rafId){cancelAnimationFrame(rafId);rafId=0;}
      range.removeEventListener('input',onInput);
      root.removeEventListener('pointerdown',onPointerDown);
      root.removeEventListener('pointermove',onPointerMove);
      root.removeEventListener('pointerup',onPointerUp);
      root.removeEventListener('pointercancel',onPointerCancel);
      clearBend();
      root.removeAttribute('data-held');
      root.removeAttribute('data-pc-cmp-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,ga=`.pagecraft-timeline{position:relative;list-style:none;margin:0;padding:0;width:100%;counter-reset:pc-tl}
.pagecraft-timeline[data-orientation=vertical]{display:flex;flex-direction:column;gap:var(--tl-gap,22px);padding-inline-start:42px}
.pagecraft-timeline[data-orientation=vertical]::before{content:"";position:absolute;inset-inline-start:15px;inset-block:18px;inline-size:2px;background:var(--tl-line,rgba(0,0,0,.16))}
.pagecraft-timeline[data-orientation=horizontal]{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--tl-gap,20px)}
.pagecraft-timeline[data-orientation=horizontal]::before{content:"";position:absolute;inset-inline:24px;inset-block-start:15px;block-size:2px;background:var(--tl-line,rgba(0,0,0,.16))}
.pagecraft-timeline-item{position:relative;counter-increment:pc-tl;min-width:0}
.pagecraft-timeline-mark{width:30px;height:30px;border-radius:999px;background:var(--tl-accent,#18181b);color:var(--tl-accent-ink,#fff);display:inline-grid;place-items:center;font:700 12px/1 inherit;font-variant-numeric:tabular-nums;position:relative;z-index:1}
.pagecraft-timeline[data-orientation=vertical] .pagecraft-timeline-mark{position:absolute;inset-inline-start:-41px;inset-block-start:16px}
.pagecraft-timeline[data-orientation=horizontal] .pagecraft-timeline-mark{margin-block-end:14px}
.pagecraft-timeline[data-marker=numbers] .pagecraft-timeline-mark::after{content:counter(pc-tl)}
.pagecraft-timeline[data-marker=dots] .pagecraft-timeline-mark{width:14px;height:14px;border:3px solid var(--tl-card,#fff);box-sizing:border-box}
.pagecraft-timeline[data-orientation=vertical][data-marker=dots] .pagecraft-timeline-mark{inset-inline-start:-33px;inset-block-start:24px}
.pagecraft-timeline[data-orientation=horizontal][data-marker=dots] .pagecraft-timeline-mark{margin-block:8px 22px}
.pagecraft-timeline-card{background:var(--tl-card,transparent);border:1px solid var(--tl-line,rgba(0,0,0,.14));border-radius:var(--tl-radius,10px);padding:18px 20px;display:flex;flex-direction:column;gap:6px}
.pagecraft-timeline-tag{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--tl-accent,currentColor)}
.pagecraft-timeline-title{margin:0;font-size:var(--tl-title-size,18px);font-weight:700;line-height:1.3;color:var(--tl-ink,inherit)}
.pagecraft-timeline-detail{margin:0;font-size:var(--tl-body-size,15px);line-height:1.55;color:var(--tl-muted,inherit);opacity:.88}
@media (max-width:767px){
  .pagecraft-timeline[data-orientation=horizontal]{display:flex;flex-direction:column;gap:var(--tl-gap,22px);padding-inline-start:42px}
  .pagecraft-timeline[data-orientation=horizontal]::before{inset-inline:auto;inset-inline-start:15px;inset-block:18px;inline-size:2px;block-size:auto}
  .pagecraft-timeline[data-orientation=horizontal] .pagecraft-timeline-mark{position:absolute;inset-inline-start:-41px;inset-block-start:16px;margin-block:0}
  .pagecraft-timeline[data-orientation=horizontal][data-marker=dots] .pagecraft-timeline-mark{inset-inline-start:-33px;inset-block-start:24px;margin-block:0}
}`,ma=`.pagecraft-progress{display:flex;flex-direction:column;gap:var(--pg-gap,16px);width:100%}
.pagecraft-progress-item{display:flex;flex-direction:column;gap:7px}
.pagecraft-progress-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:14px;font-weight:600;color:var(--pg-text,inherit)}
.pagecraft-progress-label{margin:0;cursor:default}
.pagecraft-progress-val{font-variant-numeric:tabular-nums;font-size:13px;color:var(--pg-muted,inherit)}
progress.pagecraft-progress-bar{appearance:none;-webkit-appearance:none;border:0 solid;overflow:clip;display:block;width:100%;height:var(--pg-height,10px);border-radius:var(--pg-radius,999px);background:var(--pg-track,rgba(0,0,0,.12));color:var(--pg-fill,#18181b)}
progress.pagecraft-progress-bar::-webkit-progress-bar{background:transparent}
progress.pagecraft-progress-bar::-webkit-progress-value{background:var(--pg-fill,#18181b);border-radius:var(--pg-radius,999px);transition:inline-size .35s ease}
progress.pagecraft-progress-bar::-moz-progress-bar{background:var(--pg-fill,#18181b);border-radius:var(--pg-radius,999px);transition:inline-size .35s ease}
.pagecraft-progress[data-rounded="0"] progress.pagecraft-progress-bar{border-radius:2px}
.pagecraft-progress[data-rounded="0"] progress.pagecraft-progress-bar::-webkit-progress-value{border-radius:2px}
.pagecraft-progress[data-rounded="0"] progress.pagecraft-progress-bar::-moz-progress-bar{border-radius:2px}`,ha=`.pagecraft-hotspot{position:relative;width:100%}
.pagecraft-hotspot-stage{position:relative;width:100%;overflow:clip;border-radius:var(--hs-radius,12px);background:var(--c-surface,#f3f4f6)}
.pagecraft-hotspot-img{display:block;width:100%;height:auto;object-fit:cover}
.pagecraft-hotspot-stage[data-fixed-ratio] .pagecraft-hotspot-img{height:100%}
.pagecraft-hotspot-pin{position:absolute;transform:translate(-50%,-50%);min-width:28px;height:28px;padding:0 8px;border-radius:999px;border:2px solid var(--hs-ring,#fff);background:var(--hs-pin,#18181b);color:var(--hs-pin-ink,#fff);font:700 11px/1 inherit;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.34);z-index:2;transition:transform .16s ease,background-color .16s ease}
.pagecraft-hotspot-pin:hover,.pagecraft-hotspot-pin[aria-expanded="true"]{transform:translate(-50%,-50%) scale(1.12)}
.pagecraft-hotspot-pin:focus-visible{outline:3px solid var(--hs-pin,#18181b);outline-offset:3px}
.pagecraft-hotspot[data-hotspot-edit] .pagecraft-hotspot-pin{pointer-events:none}
.pagecraft-hotspot-card{position:fixed;inset:auto;margin:0;padding:14px 16px;inline-size:min(280px,calc(100dvw - 32px));border-radius:10px;border:1px solid var(--hs-line,rgba(0,0,0,.14));background:var(--hs-card,#fff);color:var(--hs-card-ink,#111311);box-shadow:0 16px 40px rgba(0,0,0,.24);z-index:60;opacity:0;translate:0 6px;transition:opacity .18s ease,translate .18s ease,display .18s ease,overlay .18s ease;transition-behavior:allow-discrete}
@supports (position-area:block-end){
  .pagecraft-hotspot-card{height:auto;margin-block:8px;position-area:block-end span-inline-end;position-try-fallbacks:flip-block,flip-inline}
}
.pagecraft-hotspot-card:not(:is(:popover-open,.:popover-open)){display:none}
.pagecraft-hotspot-card:is(:popover-open,.:popover-open){display:block;opacity:1;translate:0 0}
@starting-style{.pagecraft-hotspot-card:is(:popover-open,.:popover-open){opacity:0;translate:0 6px}}
.pagecraft-hotspot-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px}
.pagecraft-hotspot-card-head strong{font-size:14px;line-height:1.3;font-weight:700}
.pagecraft-hotspot-close{appearance:none;border:0;background:transparent;color:inherit;opacity:.65;cursor:pointer;padding:2px 6px;font:600 16px/1 inherit;border-radius:4px}
.pagecraft-hotspot-close:hover{opacity:1}
.pagecraft-hotspot-card-body{margin:0;font-size:13px;line-height:1.5;opacity:.86}
@media (prefers-reduced-motion:reduce){.pagecraft-hotspot-pin,.pagecraft-hotspot-card{transition:none}}`,ba=`<script>
(function(){
  var disposers=[];
  var nativePopover=Object.hasOwn(HTMLElement.prototype,'popover');
  var hasAnchor=typeof CSS!=='undefined'&&CSS.supports&&CSS.supports('position-area','block-end');
  function placeFallback(pin,card){
    var r=pin.getBoundingClientRect();
    var w=card.offsetWidth||260;
    var h=card.offsetHeight||120;
    var left=Math.max(12,Math.min(window.innerWidth-w-12,r.left+r.width/2-w/2));
    var top=r.bottom+8;
    if(top+h>window.innerHeight-12&&r.top-h-8>12)top=r.top-h-8;
    card.style.left=left+'px';
    card.style.top=Math.max(12,top)+'px';
  }
  document.querySelectorAll('.pagecraft-hotspot[data-hotspot]').forEach(function(root){
    if(root.hasAttribute('data-pc-hs-ready')||root.hasAttribute('data-hotspot-edit'))return;
    root.setAttribute('data-pc-hs-ready','');
    var offs=[];
    root.querySelectorAll('.pagecraft-hotspot-card[id]').forEach(function(card){
      var pin=root.querySelector('.pagecraft-hotspot-pin[popovertarget="'+card.id+'"]');
      if(!pin)return;
      if(nativePopover){
        function onToggle(e){
          var open=e.newState==='open';
          pin.setAttribute('aria-expanded',open?'true':'false');
          if(open&&!hasAnchor)placeFallback(pin,card);
        }
        card.addEventListener('toggle',onToggle);
        offs.push(function(){card.removeEventListener('toggle',onToggle);});
      }else{
        function close(){card.classList.remove(':popover-open');pin.setAttribute('aria-expanded','false');}
        function onPin(){
          var was=card.classList.contains(':popover-open');
          root.querySelectorAll('.pagecraft-hotspot-card').forEach(function(c){c.classList.remove(':popover-open');});
          root.querySelectorAll('.pagecraft-hotspot-pin').forEach(function(p){p.setAttribute('aria-expanded','false');});
          if(!was){card.classList.add(':popover-open');pin.setAttribute('aria-expanded','true');placeFallback(pin,card);}
        }
        var clsBtn=card.querySelector('.pagecraft-hotspot-close');
        pin.addEventListener('click',onPin);
        if(clsBtn)clsBtn.addEventListener('click',close);
        offs.push(function(){pin.removeEventListener('click',onPin);if(clsBtn)clsBtn.removeEventListener('click',close);close();});
      }
    });
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-hs-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,ya=`.pagecraft-strips{display:flex;gap:var(--st-gap,10px);height:var(--st-height,520px);width:100%;border-radius:var(--st-radius,14px);overflow:hidden;-webkit-user-select:none;user-select:none;touch-action:pan-y}
.pagecraft-strip{position:relative;flex:1 1 0;min-width:0;border:0;padding:0;margin:0;border-radius:var(--st-radius,14px);overflow:hidden;cursor:pointer;text-align:left;background:var(--st-bg,#16191d);color:var(--st-ink,#fff);font-family:inherit;display:block;transition:flex-grow .55s cubic-bezier(.22,1,.36,1)}
.pagecraft-strips[data-pc-st-spring] .pagecraft-strip{transition:none}
.pagecraft-strip[aria-expanded="true"]{flex-grow:4.6}
.pagecraft-strip:focus-visible{outline:3px solid var(--st-accent,#A84404);outline-offset:-3px}
.pagecraft-strips[data-strips-edit] .pagecraft-strip{pointer-events:none}
.pagecraft-strip-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;-webkit-user-drag:none;filter:brightness(.74);transition:transform .7s cubic-bezier(.22,1,.36,1),filter .45s ease}
.pagecraft-strip[aria-expanded="true"] .pagecraft-strip-img{filter:brightness(.94);transform:scale(1.02)}
.pagecraft-strips[data-captions="none"] .pagecraft-strip-img{filter:none;transform:none;transition:none}
.pagecraft-strip-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,16,20,.12) 0%,rgba(14,16,20,.36) 48%,rgba(14,16,20,.90) 100%);pointer-events:none}
.pagecraft-strip-rail{position:absolute;inset-block-end:24px;inset-inline-start:50%;transform:translateX(-50%) rotate(180deg);writing-mode:vertical-rl;white-space:nowrap;font-weight:600;font-size:17px;line-height:1.2;letter-spacing:.02em;color:var(--st-ink,#fff);z-index:2;pointer-events:none;opacity:.92;transition:opacity .22s ease .18s}
.pagecraft-strip[aria-expanded="true"] .pagecraft-strip-rail{opacity:0;transition:opacity .07s ease}
.pagecraft-strip-body{position:absolute;inset-inline-start:0;inset-block-end:0;width:min(320px,80vw);padding:24px 26px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;z-index:2;align-items:flex-start;opacity:0;pointer-events:none;transition:opacity .07s ease}
.pagecraft-strip[aria-expanded="true"] .pagecraft-strip-body{opacity:1;pointer-events:auto;transition:opacity .26s ease .16s}
.pagecraft-strip-title{display:block;font-weight:600;color:var(--st-ink,#fff);font-size:clamp(22px,2.3vw,30px);line-height:1.15;letter-spacing:-.01em}
.pagecraft-strip-detail{display:block;margin:0;color:var(--st-ink,#fff);opacity:.92;font-size:15px;line-height:1.55;max-width:48ch;font-weight:400}
.pagecraft-strip-tag{display:inline-block;margin-top:4px;font-size:12px;font-weight:600;letter-spacing:.05em;color:var(--st-tag,#F7B084)}
@media (max-width:768px){
  .pagecraft-strips{flex-direction:column;height:auto;gap:10px}
  .pagecraft-strip{flex:none !important;height:108px;width:100%;transition:height .4s cubic-bezier(.22,1,.36,1)}
  .pagecraft-strip[aria-expanded="true"]{height:340px}
  .pagecraft-strip-rail{display:none}
  .pagecraft-strip-body{width:100%;padding:18px 20px;opacity:1;transition:none}
  .pagecraft-strip[aria-expanded="false"] .pagecraft-strip-title{font-size:19px}
  .pagecraft-strip[aria-expanded="true"] .pagecraft-strip-title{font-size:22px}
  .pagecraft-strip[aria-expanded="false"] .pagecraft-strip-detail,.pagecraft-strip[aria-expanded="false"] .pagecraft-strip-tag{display:none}
}
@media (prefers-reduced-motion:reduce){.pagecraft-strip,.pagecraft-strip-img,.pagecraft-strip-rail,.pagecraft-strip-body{transition:none}}`,va=`<script>
(function(){
  var disposers=[];
  function clamp(v,lo,hi){return Math.min(hi,Math.max(lo,v));}
  function numAttr(el,name,def){
    var raw=el.getAttribute(name);
    if(raw===null||raw==='')return def;
    var n=parseFloat(raw);
    return isFinite(n)?clamp(n,0,100):def;
  }
  document.querySelectorAll('.pagecraft-strips[data-strips]').forEach(function(root){
    if(root.hasAttribute('data-pc-st-ready')||root.hasAttribute('data-strips-edit'))return;
    root.setAttribute('data-pc-st-ready','1');
    var strips=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-strip'));
    if(!strips.length)return;
    var isHover=root.getAttribute('data-trigger')==='hover';
    var openVal=numAttr(root,'data-open',50);
    var reachVal=numAttr(root,'data-reach',35);
    var bounceVal=numAttr(root,'data-bounce',10);
    var kLift=0.4+(openVal/100)*2.8;
    var sigma=0.35+(reachVal/100)*0.9;
    var springK=0.08+(bounceVal/100)*0.16;
    var springD=0.62+(bounceVal/100)*0.2;
    function fall(dist){var r=dist/sigma;return Math.exp(-(r*r));}
    function isReducedMotion(){
      return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    var activeIdx=isHover?-1:strips.findIndex(function(b){return b.getAttribute('aria-expanded')==='true';});
    if(!isHover&&activeIdx<0)activeIdx=0;
    var cur=strips.map(function(_,i){return activeIdx<0?0:fall(Math.abs(i-activeIdx))*100;});
    var vel=strips.map(function(){return 0;});
    var target=cur.slice();
    var rafId=0;
    var prevTime=0;
    function applyFlex(){
      strips.forEach(function(btn,i){
        btn.style.flexGrow=String(1+kLift*(cur[i]/100));
      });
    }
    root.setAttribute('data-pc-st-spring','1');
    applyFlex();
    function tick(t){
      var dt=prevTime?clamp((t-prevTime)/16.67,0,2.5):1;
      prevTime=t;
      var moving=false;
      for(var i=0;i<strips.length;i++){
        vel[i]+=(target[i]-cur[i])*springK*dt;
        vel[i]*=Math.pow(springD,dt);
        cur[i]+=vel[i]*dt;
        if(Math.abs(target[i]-cur[i])<0.02&&Math.abs(vel[i])<0.02){
          cur[i]=target[i];
          vel[i]=0;
        }else{
          moving=true;
        }
      }
      applyFlex();
      if(moving){
        rafId=requestAnimationFrame(tick);
      }else{
        rafId=0;
        prevTime=0;
      }
    }
    function activate(idx){
      activeIdx=idx;
      strips.forEach(function(btn,i){
        btn.setAttribute('aria-expanded',i===activeIdx?'true':'false');
        target[i]=activeIdx<0?0:fall(Math.abs(i-activeIdx))*100;
      });
      if(isReducedMotion()||typeof requestAnimationFrame!=='function'){
        if(rafId){cancelAnimationFrame(rafId);rafId=0;prevTime=0;}
        for(var i=0;i<strips.length;i++){cur[i]=target[i];vel[i]=0;}
        applyFlex();
        return;
      }
      if(!rafId){
        prevTime=0;
        rafId=requestAnimationFrame(tick);
      }
    }
    var offs=[];
    if(isHover){
      function onPointerOut(e){
        var to=e.relatedTarget;
        if(!to||!root.contains(to))activate(-1);
      }
      function onPointerCancel(){activate(-1);}
      function onFocusOut(e){
        var to=e.relatedTarget;
        if(!to||!root.contains(to))activate(-1);
      }
      root.addEventListener('pointerout',onPointerOut);
      root.addEventListener('pointercancel',onPointerCancel);
      root.addEventListener('focusout',onFocusOut);
      offs.push(function(){
        root.removeEventListener('pointerout',onPointerOut);
        root.removeEventListener('pointercancel',onPointerCancel);
        root.removeEventListener('focusout',onFocusOut);
      });
    }
    strips.forEach(function(btn,idx){
      function onClick(){activate(idx);}
      function onPointerEnter(){if(activeIdx!==idx)activate(idx);}
      function onFocus(){if(activeIdx!==idx)activate(idx);}
      function onKey(e){
        if(isHover&&e.key==='Escape'){activate(-1);return;}
        var next=-1;
        if(e.key==='ArrowRight'||e.key==='ArrowDown')next=(idx+1)%strips.length;
        else if(e.key==='ArrowLeft'||e.key==='ArrowUp')next=(idx-1+strips.length)%strips.length;
        else if(e.key==='Home')next=0;
        else if(e.key==='End')next=strips.length-1;
        if(next<0)return;
        e.preventDefault();
        strips[next].focus();
        activate(next);
      }
      btn.addEventListener('click',onClick);
      btn.addEventListener('keydown',onKey);
      if(isHover){
        btn.addEventListener('pointerenter',onPointerEnter);
        btn.addEventListener('focus',onFocus);
      }
      offs.push(function(){
        btn.removeEventListener('click',onClick);
        btn.removeEventListener('keydown',onKey);
        if(isHover){
          btn.removeEventListener('pointerenter',onPointerEnter);
          btn.removeEventListener('focus',onFocus);
        }
      });
    });
    disposers.push(function(){
      if(rafId){cancelAnimationFrame(rafId);rafId=0;}
      offs.forEach(function(off){off();});
      strips.forEach(function(btn){btn.style.flexGrow='';});
      root.removeAttribute('data-pc-st-ready');
      root.removeAttribute('data-pc-st-spring');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,xa=`.pagecraft-switcher{display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1.25fr);gap:var(--sw-gap,36px);align-items:start;width:100%}
.pagecraft-switcher[data-layout="tabs"]{grid-template-columns:minmax(0,1fr);gap:24px}
.pagecraft-switcher-list{display:flex;flex-direction:column;border-top:1px solid var(--sw-line,rgba(0,0,0,.14))}
.pagecraft-switcher[data-layout="tabs"] .pagecraft-switcher-list{flex-direction:row;flex-wrap:wrap;gap:8px;border-top:0;border-bottom:1px solid var(--sw-line,rgba(0,0,0,.14));padding-bottom:14px}
.pagecraft-switcher-tab{appearance:none;width:100%;border:0;border-bottom:1px solid var(--sw-line,rgba(0,0,0,.14));border-left:3px solid transparent;padding:20px 18px 20px 20px;margin:0;background:transparent;color:var(--sw-ink,#181A1D);font-family:inherit;text-align:left;display:flex;flex-direction:column;gap:6px;cursor:pointer;transition:background-color .2s ease,border-color .2s ease}
.pagecraft-switcher-tab:hover{background:rgba(24,26,29,.03)}
.pagecraft-switcher-tab[aria-selected="true"]{background:var(--sw-active-bg,rgba(168,68,4,.06));border-left-color:var(--sw-accent,#A84404)}
.pagecraft-switcher-tab:focus-visible{outline:2px solid var(--sw-accent,#A84404);outline-offset:-2px}
.pagecraft-switcher[data-switcher-edit] .pagecraft-switcher-tab{pointer-events:none}
.pagecraft-switcher[data-layout="tabs"] .pagecraft-switcher-tab{width:auto;border:1px solid var(--sw-line,rgba(0,0,0,.14));border-radius:999px;padding:10px 18px;gap:2px}
.pagecraft-switcher[data-layout="tabs"] .pagecraft-switcher-tab[aria-selected="true"]{background:var(--sw-accent,#A84404);border-color:var(--sw-accent,#A84404);color:#fff}
.pagecraft-switcher[data-layout="tabs"] .pagecraft-switcher-tab[aria-selected="true"] .pagecraft-switcher-tab-meta{color:rgba(255,255,255,.86)}
.pagecraft-switcher-tab-title{display:block;font-size:18px;line-height:1.25;font-weight:600;color:inherit}
.pagecraft-switcher-tab-meta{display:block;font-size:13px;line-height:1.35;font-weight:500;color:var(--sw-muted,#52565E)}
.pagecraft-switcher-tab-detail{display:block;margin-top:4px;font-size:14.5px;line-height:1.58;color:var(--sw-muted,#52565E);font-weight:400}
.pagecraft-switcher-tab[aria-selected="false"] .pagecraft-switcher-tab-detail,.pagecraft-switcher[data-layout="tabs"] .pagecraft-switcher-tab-detail{display:none}
.pagecraft-switcher-stage{display:grid;border-radius:var(--sw-radius,14px);overflow:hidden;border:1px solid var(--sw-line,rgba(0,0,0,.14));background:var(--sw-surface,#fff)}
.pagecraft-switcher-panel{grid-area:1 / 1;margin:0;display:flex;flex-direction:column;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .28s ease,visibility .28s ease}
.pagecraft-switcher-panel[data-active="1"]{opacity:1;visibility:visible;pointer-events:auto;z-index:1}
.pagecraft-switcher-img{display:block;width:100%;height:auto;aspect-ratio:var(--sw-ratio,3 / 2);object-fit:cover;background:#16191d}
.pagecraft-switcher-cap{padding:18px 22px;display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--sw-line,rgba(0,0,0,.12));background:var(--sw-surface,#fff)}
.pagecraft-switcher-cap-title{display:block;font-size:16px;line-height:1.3;font-weight:600;color:var(--sw-ink,#181A1D)}
.pagecraft-switcher-cap-text{margin:0;font-size:14px;line-height:1.55;color:var(--sw-muted,#52565E)}
@media (max-width:860px){
  .pagecraft-switcher{grid-template-columns:minmax(0,1fr);gap:20px}
  .pagecraft-switcher-tab{padding:16px}
  .pagecraft-switcher-cap{padding:16px 18px}
}
@media (prefers-reduced-motion:reduce){.pagecraft-switcher-tab,.pagecraft-switcher-panel{transition:none}}`,wa=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-switcher[data-switcher]').forEach(function(root){
    if(root.hasAttribute('data-pc-sw-ready')||root.hasAttribute('data-switcher-edit'))return;
    root.setAttribute('data-pc-sw-ready','1');
    var tabs=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-switcher-tab[role="tab"]'));
    var panels=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-switcher-panel[role="tabpanel"]'));
    if(!tabs.length||!panels.length)return;
    function activate(idx){
      tabs.forEach(function(tab,i){
        var active=i===idx;
        tab.setAttribute('aria-selected',active?'true':'false');
        tab.setAttribute('tabindex',active?'0':'-1');
      });
      panels.forEach(function(panel,i){
        var active=i===idx;
        panel.setAttribute('data-active',active?'1':'0');
        panel.setAttribute('aria-hidden',active?'false':'true');
      });
    }
    var offs=[];
    tabs.forEach(function(tab,idx){
      function onClick(){activate(idx);}
      function onKey(e){
        var next=-1;
        if(e.key==='ArrowDown'||e.key==='ArrowRight')next=(idx+1)%tabs.length;
        else if(e.key==='ArrowUp'||e.key==='ArrowLeft')next=(idx-1+tabs.length)%tabs.length;
        else if(e.key==='Home')next=0;
        else if(e.key==='End')next=tabs.length-1;
        if(next<0)return;
        e.preventDefault();
        tabs[next].focus();
        activate(next);
      }
      tab.addEventListener('click',onClick);
      tab.addEventListener('keydown',onKey);
      offs.push(function(){tab.removeEventListener('click',onClick);tab.removeEventListener('keydown',onKey);});
    });
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-sw-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,ka=`.pagecraft-exhibit{position:relative;width:100%}
.pagecraft-exhibit-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--ex-line,rgba(19,49,40,.15))}
.pagecraft-exhibit-item{margin:0;border-bottom:1px solid var(--ex-line,rgba(19,49,40,.15))}
.pagecraft-exhibit-row{appearance:none;width:100%;border:0;background:transparent;padding:20px 14px;margin:0;display:grid;grid-template-columns:72px minmax(0,1.4fr) minmax(0,1fr) auto auto;align-items:center;gap:22px;text-align:left;text-decoration:none;color:var(--ex-ink,#132A22);font-family:inherit;cursor:pointer;transition:background-color .22s cubic-bezier(.22,1,.36,1),padding-inline-start .22s cubic-bezier(.22,1,.36,1)}
.pagecraft-exhibit-row:hover,.pagecraft-exhibit-row:focus-visible,.pagecraft-exhibit-row[data-active="1"]{background:var(--ex-hover,rgba(19,49,40,.045));padding-inline-start:20px}
.pagecraft-exhibit-row:focus-visible{outline:2px solid var(--ex-accent,#0F6A53);outline-offset:-2px}
.pagecraft-exhibit[data-exhibit-edit] .pagecraft-exhibit-row{pointer-events:none}
.pagecraft-exhibit-thumb{display:block;width:72px;border-radius:7px;overflow:hidden;border:1px solid var(--ex-line,rgba(19,49,40,.15));background:#133128;flex-shrink:0}
.pagecraft-exhibit-thumb-img{display:block;width:100%;height:auto;aspect-ratio:4 / 3;object-fit:cover}
.pagecraft-exhibit-main{display:flex;flex-direction:column;gap:3px;min-width:0}
.pagecraft-exhibit-title{display:block;font-size:clamp(19px,1.9vw,24px);line-height:1.32;font-weight:600;letter-spacing:-.012em;color:var(--ex-ink,#132A22)}
.pagecraft-exhibit-loc{display:block;font-size:13.5px;line-height:1.4;color:var(--ex-muted,#435A51)}
.pagecraft-exhibit-scope{display:block;font-size:14px;line-height:1.45;color:var(--ex-muted,#435A51)}
.pagecraft-exhibit-year{display:block;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ex-ink,#132A22);white-space:nowrap}
.pagecraft-exhibit-arrow{color:var(--ex-accent,#0F6A53);opacity:.72;flex-shrink:0;transition:transform .22s cubic-bezier(.22,1,.36,1),opacity .22s ease}
.pagecraft-exhibit-row:hover .pagecraft-exhibit-arrow,.pagecraft-exhibit-row:focus-visible .pagecraft-exhibit-arrow{opacity:1;transform:translate(2px,-2px)}
.pagecraft-exhibit-float{position:absolute;inset-inline-end:52px;inset-block-start:0;width:276px;aspect-ratio:var(--ex-ratio,4 / 3);border-radius:var(--ex-radius,12px);overflow:hidden;border:1px solid var(--ex-line,rgba(19,49,40,.18));background-color:var(--ex-surface,#133128);background-size:cover;background-position:center;box-shadow:0 20px 48px rgba(14,30,24,.22);pointer-events:none;z-index:20;opacity:0;visibility:hidden;transform:translate3d(0,var(--ex-y,12px),0) scale(.96);transition:opacity .24s cubic-bezier(.22,1,.36,1),visibility .24s ease,transform .28s cubic-bezier(.22,1,.36,1)}
.pagecraft-exhibit-float[data-open="1"]{opacity:1;visibility:visible;transform:translate3d(0,var(--ex-y,12px),0) scale(1)}
@media (max-width:860px){
  .pagecraft-exhibit-year{grid-column:3;grid-row:1}
  .pagecraft-exhibit-row{grid-template-columns:64px minmax(0,1fr) auto;gap:12px 14px;padding:16px 8px}
  .pagecraft-exhibit-row:hover,.pagecraft-exhibit-row:focus-visible,.pagecraft-exhibit-row[data-active="1"]{padding-inline-start:10px}
  .pagecraft-exhibit-thumb{width:64px}
  .pagecraft-exhibit-scope{grid-column:2 / -1;font-size:13px}
  .pagecraft-exhibit-arrow{display:none}
  .pagecraft-exhibit-float{opacity:0!important;visibility:hidden!important}
}
@media (prefers-reduced-motion:reduce){.pagecraft-exhibit-row,.pagecraft-exhibit-arrow,.pagecraft-exhibit-float{transition:none}}`,Sa=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-exhibit[data-exhibit]').forEach(function(root){
    if(root.hasAttribute('data-pc-ex-ready')||root.hasAttribute('data-exhibit-edit'))return;
    root.setAttribute('data-pc-ex-ready','1');
    var rows=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-exhibit-row[data-exhibit-idx]'));
    var floatEl=root.querySelector('.pagecraft-exhibit-float');
    if(!rows.length||!floatEl)return;
    function show(idx,row){
      rows.forEach(function(r,i){r.setAttribute('data-active',i===idx?'1':'0');});
      var img=row.querySelector('.pagecraft-exhibit-thumb-img');
      var src=img&&(img.currentSrc||img.getAttribute('src'))||'';
      if(src){
        floatEl.style.backgroundImage='url("'+src.replace(/"/g,'\\"')+'")';
        floatEl.setAttribute('data-active-idx',String(idx));
      }
      var rootRect=root.getBoundingClientRect();
      var rowRect=row.getBoundingClientRect();
      var fh=floatEl.offsetHeight||207;
      var maxTop=Math.max(0,(rootRect.height||320)-fh);
      var y=Math.max(0,Math.min(maxTop,(rowRect.top-rootRect.top)+(rowRect.height/2)-(fh/2)));
      floatEl.style.setProperty('--ex-y',Math.round(y)+'px');
      floatEl.setAttribute('data-open','1');
    }
    function hide(){
      rows.forEach(function(r){r.removeAttribute('data-active');});
      floatEl.setAttribute('data-open','0');
    }
    var offs=[];
    rows.forEach(function(row,idx){
      function onEnter(){show(idx,row);}
      function onFocus(){show(idx,row);}
      row.addEventListener('pointerenter',onEnter);
      row.addEventListener('focus',onFocus);
      offs.push(function(){row.removeEventListener('pointerenter',onEnter);row.removeEventListener('focus',onFocus);});
    });
    function onLeave(){hide();}
    function onFocusOut(e){if(!root.contains(e.relatedTarget))hide();}
    root.addEventListener('pointerleave',onLeave);
    root.addEventListener('focusout',onFocusOut);
    offs.push(function(){root.removeEventListener('pointerleave',onLeave);root.removeEventListener('focusout',onFocusOut);});
    disposers.push(function(){
      offs.forEach(function(off){off();});
      hide();
      root.removeAttribute('data-pc-ex-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,$a=`.pagecraft-scrolly{display:grid;grid-template-columns:minmax(0,.96fr) minmax(0,1.08fr);gap:var(--sc-gap,44px);align-items:start;width:100%;position:relative}
.pagecraft-scrolly-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:24px}
.pagecraft-scrolly-step{margin:0;outline:none;cursor:pointer}
.pagecraft-scrolly[data-scrolly-edit] .pagecraft-scrolly-step{pointer-events:none}
.pagecraft-scrolly-card{padding:28px 30px;border-radius:var(--sc-radius,14px);border:1px solid var(--sc-line,rgba(19,49,40,.15));background:var(--sc-surface,#fff);display:flex;flex-direction:column;gap:12px;transition:border-color .25s ease,background-color .25s ease,box-shadow .25s ease}
.pagecraft-scrolly-step[data-active="1"] .pagecraft-scrolly-card{border-color:var(--sc-accent,#0F6A53);box-shadow:0 16px 38px rgba(14,32,25,.09)}
.pagecraft-scrolly-step:focus-visible .pagecraft-scrolly-card{outline:2px solid var(--sc-accent,#0F6A53);outline-offset:2px}
.pagecraft-scrolly-title{margin:0;font-size:clamp(20px,2vw,25px);line-height:1.22;font-weight:600;letter-spacing:-.012em;color:var(--sc-ink,#132A22)}
.pagecraft-scrolly-detail{margin:0;font-size:15.5px;line-height:1.62;color:var(--sc-muted,#435A51)}
.pagecraft-scrolly-fact{align-self:flex-start;margin-top:4px;padding:5px 12px;border-radius:999px;border:1px solid var(--sc-line,rgba(19,49,40,.16));font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--sc-accent,#0F6A53);background:rgba(15,106,83,.06)}
.pagecraft-scrolly-stage{position:sticky;top:108px}
.pagecraft-scrolly-frame{display:grid;border-radius:var(--sc-radius,14px);overflow:hidden;border:1px solid var(--sc-line,rgba(19,49,40,.16));background:var(--sc-surface,#fff);box-shadow:0 20px 48px rgba(14,32,25,.12)}
.pagecraft-scrolly-plate{grid-area:1 / 1;margin:0;display:flex;flex-direction:column;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .38s cubic-bezier(.22,1,.36,1),visibility .38s ease}
.pagecraft-scrolly-plate[data-active="1"]{opacity:1;visibility:visible;pointer-events:auto;z-index:1}
.pagecraft-scrolly-img{display:block;width:100%;height:auto;aspect-ratio:var(--sc-ratio,4 / 3);object-fit:cover;background:#133128;transform:scale(1.03);transition:transform .55s cubic-bezier(.22,1,.36,1)}
.pagecraft-scrolly-plate[data-active="1"] .pagecraft-scrolly-img{transform:scale(1)}
.pagecraft-scrolly-cap{padding:14px 20px;font-size:13.5px;line-height:1.45;font-weight:500;font-variant-numeric:tabular-nums;color:var(--sc-muted,#435A51);border-top:1px solid var(--sc-line,rgba(19,49,40,.12));background:var(--sc-surface,#fff)}
@media (max-width:767px){
  .pagecraft-scrolly{grid-template-columns:minmax(0,1fr);gap:20px}
  .pagecraft-scrolly-stage{position:relative;top:auto;order:-1}
  .pagecraft-scrolly-card{padding:20px}
  .pagecraft-scrolly-steps{gap:14px}
}
@media (prefers-reduced-motion:reduce){.pagecraft-scrolly-card,.pagecraft-scrolly-plate,.pagecraft-scrolly-img{transition:none}}`,Ea=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-scrolly[data-scrolly]').forEach(function(root){
    if(root.hasAttribute('data-pc-sc-ready')||root.hasAttribute('data-scrolly-edit'))return;
    root.setAttribute('data-pc-sc-ready','1');
    var steps=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-scrolly-step[data-scrolly-step]'));
    var plates=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-scrolly-plate[data-scrolly-plate]'));
    if(!steps.length||!plates.length)return;
    function activate(idx){
      steps.forEach(function(s,i){s.setAttribute('data-active',i===idx?'1':'0');});
      plates.forEach(function(p,i){
        var on=i===idx;
        p.setAttribute('data-active',on?'1':'0');
        p.setAttribute('aria-hidden',on?'false':'true');
      });
    }
    var offs=[];
    steps.forEach(function(step,idx){
      function onAct(){activate(idx);}
      function onKey(e){
        if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(idx);}
      }
      step.addEventListener('click',onAct);
      step.addEventListener('focus',onAct);
      step.addEventListener('keydown',onKey);
      offs.push(function(){
        step.removeEventListener('click',onAct);
        step.removeEventListener('focus',onAct);
        step.removeEventListener('keydown',onKey);
      });
    });
    if(typeof IntersectionObserver==='function'){
      var io=new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(!entry.isIntersecting)return;
          var idx=parseInt(entry.target.getAttribute('data-scrolly-step')||'0',10);
          if(idx>=0)activate(idx);
        });
      },{rootMargin:'-28% 0px -42% 0px',threshold:0.05});
      steps.forEach(function(step){io.observe(step);});
      offs.push(function(){io.disconnect();});
    }
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-sc-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,Aa=`.pagecraft-clocks{width:100%}
.pagecraft-clocks-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--ck-min,240px)),1fr));gap:var(--ck-gap,0px);border-top:var(--ck-rule,2px) solid var(--ck-ink,#0C0F1A)}
.pagecraft-clocks-card{margin:0;display:flex;flex-direction:column;gap:14px;padding:24px var(--ck-pad,24px) 26px;background:var(--ck-surface,transparent);border-radius:var(--ck-radius,0px);border-bottom:1px solid var(--ck-line,#CDD2DC)}
.pagecraft-clocks-card+.pagecraft-clocks-card{border-inline-start:1px solid var(--ck-line,#CDD2DC)}
.pagecraft-clocks-media{display:block;width:100%;border-radius:var(--ck-img-radius,4px);overflow:hidden;border:1px solid var(--ck-line,#CDD2DC);margin-bottom:4px}
.pagecraft-clocks-img{display:block;width:100%;height:auto;aspect-ratio:4 / 3;object-fit:cover}
.pagecraft-clocks-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
.pagecraft-clocks-city{font-size:var(--ck-city-size,22px);line-height:1.15;font-weight:600;letter-spacing:-.01em;color:var(--ck-ink,#0C0F1A)}
.pagecraft-clocks-time{font-size:var(--ck-time-size,40px);line-height:1;font-weight:500;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--ck-ink,#0C0F1A);white-space:nowrap}
.pagecraft-clocks-state{display:inline-flex;align-items:center;gap:8px;font-size:13px;line-height:1.3;font-weight:600;color:var(--ck-muted,#525A6B)}
.pagecraft-clocks-state[hidden]{display:none}
.pagecraft-clocks-state::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--ck-line,#CDD2DC);flex-shrink:0}
.pagecraft-clocks-state[data-open="1"]{color:var(--ck-accent,#1B36B8)}
.pagecraft-clocks-state[data-open="1"]::before{background:var(--ck-accent,#1B36B8);box-shadow:0 0 0 3px color-mix(in srgb,var(--ck-accent,#1B36B8) 18%,transparent)}
.pagecraft-clocks-addr{margin:0;font-size:15px;line-height:1.55;color:var(--ck-muted,#525A6B);font-style:normal}
.pagecraft-clocks-links{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:auto;padding-top:4px}
.pagecraft-clocks-link{font-size:14px;font-weight:600;line-height:1.4;color:var(--ck-ink,#0C0F1A);text-decoration:underline;text-decoration-color:var(--ck-line,#CDD2DC);text-underline-offset:4px;text-decoration-thickness:1px;transition:text-decoration-color .18s ease,color .18s ease}
.pagecraft-clocks-link:hover,.pagecraft-clocks-link:focus-visible{color:var(--ck-accent,#1B36B8);text-decoration-color:currentColor}
.pagecraft-clocks-link:focus-visible{outline:2px solid var(--ck-accent,#1B36B8);outline-offset:3px;border-radius:2px}
@media (max-width:860px){
  .pagecraft-clocks-card+.pagecraft-clocks-card{border-inline-start:0}
  .pagecraft-clocks-card{padding:20px var(--ck-pad-m,20px) 22px}
  .pagecraft-clocks-time{font-size:min(var(--ck-time-size,40px),34px)}
}
@media (prefers-reduced-motion:reduce){.pagecraft-clocks-link{transition:none}}`,Ca=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-clocks[data-clocks]').forEach(function(root){
    if(root.hasAttribute('data-pc-ck-ready'))return;
    root.setAttribute('data-pc-ck-ready','1');
    var cards=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-clocks-card[data-tz]'));
    if(!cards.length)return;
    var h12=root.getAttribute('data-hour12')==='1';
    var opens=parseFloat(root.getAttribute('data-opens')||'9');
    var closes=parseFloat(root.getAttribute('data-closes')||'18');
    var openLabel=root.getAttribute('data-open-label')||'Open now';
    var closedLabel=root.getAttribute('data-closed-label')||'Closed';
    function tick(){
      var now=new Date();
      cards.forEach(function(card){
        var tz=card.getAttribute('data-tz')||'';
        var timeEl=card.querySelector('[data-clocks-time]');
        var stateEl=card.querySelector('[data-clocks-state]');
        try{
          var parts=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',weekday:'short',hour12:false}).formatToParts(now);
          var get=function(t){for(var i=0;i<parts.length;i++){if(parts[i].type===t)return parts[i].value;}return '';};
          var hh=parseInt(get('hour'),10)%24;var mm=parseInt(get('minute'),10);var wd=get('weekday');
          if(timeEl){
            timeEl.textContent=new Intl.DateTimeFormat(h12?'en-US':'en-GB',{timeZone:tz,hour:h12?'numeric':'2-digit',minute:'2-digit',hour12:h12}).format(now);
            timeEl.setAttribute('datetime',now.toISOString());
          }
          if(stateEl){
            var dec=hh+mm/60;
            var overnight=closes<opens;
            /* After midnight an overnight shift still belongs to the day it started. */
            var day=overnight&&dec<closes?({Mon:'Sun',Tue:'Mon',Wed:'Tue',Thu:'Wed',Fri:'Thu',Sat:'Fri',Sun:'Sat'})[wd]:wd;
            var weekend=day==='Sat'||day==='Sun';
            var isOpen=!weekend&&(overnight?dec>=opens||dec<closes:dec>=opens&&dec<closes);
            stateEl.removeAttribute('hidden');
            stateEl.setAttribute('data-open',isOpen?'1':'0');
            stateEl.textContent=isOpen?openLabel:closedLabel;
          }
        }catch(err){
          if(timeEl)timeEl.textContent='--:--';
        }
      });
    }
    tick();
    var timer=setInterval(tick,15000);
    function onVis(){if(!document.hidden)tick();}
    document.addEventListener('visibilitychange',onVis);
    disposers.push(function(){
      clearInterval(timer);
      document.removeEventListener('visibilitychange',onVis);
      root.removeAttribute('data-pc-ck-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,Pa=`.pagecraft-roster{width:100%;display:flex;flex-direction:column;gap:20px}
.pagecraft-roster-stage{display:grid;background:var(--rs-surface,#FFFFFF);border:1px solid var(--rs-line,#C8D0DF);border-radius:var(--rs-radius,2px);overflow:hidden}
.pagecraft-roster-panel{grid-area:1 / 1;display:grid;grid-template-columns:minmax(0,.42fr) minmax(0,.58fr);align-items:stretch;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .26s cubic-bezier(.22,1,.36,1),visibility .26s ease}
.pagecraft-roster-panel[data-active="1"]{opacity:1;visibility:visible;pointer-events:auto}
.pagecraft-roster-media{background:var(--rs-ink,#0C1220);overflow:hidden}
.pagecraft-roster-img{display:block;width:100%;height:100%;min-height:340px;aspect-ratio:var(--rs-ratio,4 / 5);object-fit:cover;object-position:center top}
.pagecraft-roster-body{padding:36px 40px;display:flex;flex-direction:column;justify-content:space-between;gap:22px}
.pagecraft-roster-head{display:flex;flex-direction:column;gap:8px}
.pagecraft-roster-name{margin:0;font-size:clamp(26px,2.5vw,34px);line-height:1.2;font-weight:600;letter-spacing:-.016em;color:var(--rs-ink,#0C1220)}
.pagecraft-roster-role{margin:0;font-size:16px;line-height:1.5;font-weight:500;color:var(--rs-accent,#1B3B9B)}
.pagecraft-roster-meta{display:flex;flex-wrap:wrap;gap:8px 24px;padding-top:14px;border-top:1px solid var(--rs-line,#C8D0DF);font-size:14px;line-height:1.5;color:var(--rs-muted,#4A566E)}
.pagecraft-roster-meta strong{color:var(--rs-ink,#0C1220);font-weight:600}
.pagecraft-roster-quote{margin:0;padding-top:18px;border-top:1px solid var(--rs-line,#C8D0DF);font-size:17px;line-height:1.6;color:var(--rs-ink,#0C1220);max-width:56ch}
.pagecraft-roster-cta{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;line-height:1.4;color:var(--rs-accent,#1B3B9B);text-decoration:underline;text-underline-offset:4px}
.pagecraft-roster-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:12px}
.pagecraft-roster-tab{appearance:none;margin:0;padding:14px 16px;display:flex;align-items:center;gap:12px;text-align:left;background:var(--rs-surface,#FFFFFF);border:1px solid var(--rs-line,#C8D0DF);border-radius:var(--rs-radius,2px);color:var(--rs-ink,#0C1220);font-family:inherit;cursor:pointer;transition:border-color .18s ease,background-color .18s ease}
.pagecraft-roster-tab[aria-selected="true"]{border-color:var(--rs-accent,#1B3B9B);background:color-mix(in srgb,var(--rs-accent,#1B3B9B) 6%,var(--rs-surface,#FFFFFF))}
.pagecraft-roster-tab:focus-visible{outline:2px solid var(--rs-accent,#1B3B9B);outline-offset:2px}
.pagecraft-roster-avatar{width:42px;height:42px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;letter-spacing:.04em;background-color:var(--rs-ink,#0C1220);color:#FFFFFF;background-size:cover;background-position:center top}
.pagecraft-roster-avatar[data-has-photo="1"]{color:transparent}
.pagecraft-roster-tmeta{display:flex;flex-direction:column;gap:2px;min-width:0}
.pagecraft-roster-tname{font-size:14.5px;line-height:1.35;font-weight:600;color:var(--rs-ink,#0C1220)}
.pagecraft-roster-tseat{font-size:12.5px;line-height:1.35;color:var(--rs-muted,#4A566E)}
@media (max-width:767px){
  .pagecraft-roster-panel{grid-template-columns:1fr}
  .pagecraft-roster-img{height:auto;min-height:0;aspect-ratio:var(--rs-ratio,4 / 5)}
  .pagecraft-roster-body{padding:24px 20px}
}
@media (prefers-reduced-motion:reduce){.pagecraft-roster-panel,.pagecraft-roster-tab{transition:none}}`,Ta=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-roster[data-roster]').forEach(function(root){
    if(root.hasAttribute('data-pc-rs-ready'))return;
    root.setAttribute('data-pc-rs-ready','1');
    var tabs=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-roster-tab[data-roster-tab]'));
    var panels=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-roster-panel[data-roster-panel]'));
    if(!tabs.length||!panels.length)return;
    panels.forEach(function(panel,i){
      var img=panel.querySelector('.pagecraft-roster-img');
      var av=tabs[i]&&tabs[i].querySelector('.pagecraft-roster-avatar');
      var src=img&&(img.currentSrc||img.getAttribute('src'))||'';
      if(av&&src&&src.indexOf('data:image/svg')!==0){
        av.style.backgroundImage='url("'+src.replace(/"/g,'\\"')+'")';
        av.setAttribute('data-has-photo','1');
      }
    });
    function select(idx,focusTab){
      tabs.forEach(function(t,i){
        var on=i===idx;
        t.setAttribute('aria-selected',on?'true':'false');
        t.setAttribute('tabindex',on?'0':'-1');
        if(on&&focusTab)t.focus();
      });
      panels.forEach(function(p,i){
        var on=i===idx;
        p.setAttribute('data-active',on?'1':'0');
        p.setAttribute('aria-hidden',on?'false':'true');
      });
    }
    var offs=[];
    tabs.forEach(function(tab,idx){
      function onClick(){select(idx,false);}
      function onKey(e){
        var n=tabs.length;
        if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();select((idx+1)%n,true);}
        else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();select((idx-1+n)%n,true);}
        else if(e.key==='Home'){e.preventDefault();select(0,true);}
        else if(e.key==='End'){e.preventDefault();select(n-1,true);}
      }
      tab.addEventListener('click',onClick);
      tab.addEventListener('keydown',onKey);
      offs.push(function(){
        tab.removeEventListener('click',onClick);
        tab.removeEventListener('keydown',onKey);
      });
    });
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-rs-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,La=`.pagecraft-tiers{width:100%;display:flex;flex-direction:column;gap:24px}
.pagecraft-tiers-bar{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.pagecraft-tiers-cur-lbl{font-size:12.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--tr-muted,#4A566E);margin-right:4px}
.pagecraft-tiers-cur{appearance:none;margin:0;padding:8px 14px;font-family:inherit;font-size:13px;font-weight:600;line-height:1.3;border:1px solid var(--tr-line,#C8D0DF);border-radius:var(--tr-radius,2px);background:var(--tr-surface,#FFFFFF);color:var(--tr-ink,#0C1220);cursor:pointer;transition:background-color .16s ease,color .16s ease,border-color .16s ease}
.pagecraft-tiers-cur[aria-pressed="true"]{background:var(--tr-accent,#1B3B9B);border-color:var(--tr-accent,#1B3B9B);color:var(--tr-on,#FFFFFF)}
.pagecraft-tiers-cur:focus-visible{outline:2px solid var(--tr-accent,#1B3B9B);outline-offset:2px}
.pagecraft-tiers-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:22px;align-items:stretch}
.pagecraft-tiers-card{padding:30px 28px;display:flex;flex-direction:column;gap:18px;background:var(--tr-surface,#FFFFFF);color:var(--tr-ink,#0C1220);border:1px solid var(--tr-line,#C8D0DF);border-radius:var(--tr-radius,2px)}
.pagecraft-tiers-card[data-featured="1"]{background:var(--tr-feat-bg,#0C1220);color:var(--tr-feat-ink,#F2F4F8);border-color:var(--tr-feat-bg,#0C1220)}
.pagecraft-tiers-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.pagecraft-tiers-name{margin:0;font-size:22px;line-height:1.3;font-weight:600;color:inherit}
.pagecraft-tiers-badge{padding:4px 10px;font-size:11.5px;line-height:1.3;font-weight:600;border-radius:2px;background:var(--tr-accent,#1B3B9B);color:var(--tr-on,#FFFFFF);white-space:nowrap}
.pagecraft-tiers-sum{margin:0;font-size:14.5px;line-height:1.58;color:var(--tr-muted,#4A566E);max-width:46ch}
.pagecraft-tiers-card[data-featured="1"] .pagecraft-tiers-sum{color:var(--tr-feat-muted,#B8C6E0)}
.pagecraft-tiers-price-row{display:flex;align-items:baseline;gap:8px;padding:16px 0;border-top:1px solid var(--tr-line,#C8D0DF);border-bottom:1px solid var(--tr-line,#C8D0DF)}
.pagecraft-tiers-card[data-featured="1"] .pagecraft-tiers-price-row{border-color:rgba(184,198,224,.22)}
.pagecraft-tiers-price{font-size:clamp(30px,3vw,38px);line-height:1.1;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:inherit}
.pagecraft-tiers-period{font-size:14px;line-height:1.4;color:var(--tr-muted,#4A566E)}
.pagecraft-tiers-card[data-featured="1"] .pagecraft-tiers-period{color:var(--tr-feat-muted,#B8C6E0)}
.pagecraft-tiers-feats{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;flex:1}
.pagecraft-tiers-feat{font-size:14px;line-height:1.5;display:flex;align-items:flex-start;gap:10px;color:inherit}
.pagecraft-tiers-check{color:var(--tr-accent,#1B3B9B);font-weight:700;flex-shrink:0}
.pagecraft-tiers-card[data-featured="1"] .pagecraft-tiers-check{color:#7DA2FF}
.pagecraft-tiers-btn{margin-top:6px;padding:12px 18px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;line-height:1.3;text-decoration:none;border-radius:var(--tr-radius,2px);border:1px solid var(--tr-ink,#0C1220);color:var(--tr-ink,#0C1220);background:transparent;transition:background-color .16s ease,color .16s ease}
.pagecraft-tiers-card[data-featured="1"] .pagecraft-tiers-btn{background:var(--tr-accent,#1B3B9B);border-color:var(--tr-accent,#1B3B9B);color:var(--tr-on,#FFFFFF)}
.pagecraft-tiers-btn:hover,.pagecraft-tiers-btn:focus-visible{background:var(--tr-accent,#1B3B9B);border-color:var(--tr-accent,#1B3B9B);color:var(--tr-on,#FFFFFF)}
@media (max-width:860px){.pagecraft-tiers-bar{justify-content:flex-start}.pagecraft-tiers-card{padding:24px 20px}}
@media (prefers-reduced-motion:reduce){.pagecraft-tiers-cur,.pagecraft-tiers-btn{transition:none}}`,Ma=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-tiers[data-tiers]').forEach(function(root){
    if(root.hasAttribute('data-pc-tr-ready'))return;
    root.setAttribute('data-pc-tr-ready','1');
    var btns=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-tiers-cur[data-tiers-cur]'));
    var prices=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-tiers-price[data-usd]'));
    if(!btns.length)return;
    function setCur(cur){
      root.setAttribute('data-active-cur',cur);
      btns.forEach(function(b){
        b.setAttribute('aria-pressed',b.getAttribute('data-tiers-cur')===cur?'true':'false');
      });
      prices.forEach(function(el){
        var val=el.getAttribute('data-'+cur)||el.getAttribute('data-usd')||'';
        if(val)el.textContent=val;
      });
    }
    var offs=[];
    btns.forEach(function(btn){
      function onClick(){setCur(btn.getAttribute('data-tiers-cur')||'usd');}
      btn.addEventListener('click',onClick);
      offs.push(function(){btn.removeEventListener('click',onClick);});
    });
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-tr-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,Ia=`.pagecraft-qapills{width:100%;display:flex;flex-direction:column;gap:24px}
.pagecraft-qapills-bar{display:flex;flex-wrap:wrap;gap:10px;justify-content:var(--qp-align,center)}
.pagecraft-qapills-pill{appearance:none;margin:0;padding:10px 18px;min-height:42px;font-family:inherit;font-size:14px;font-weight:600;line-height:1.35;border:1px solid var(--qp-line,#C8D0DF);border-radius:var(--qp-pill-radius,999px);background:var(--qp-surface,#FFFFFF);color:var(--qp-ink,#0C1220);cursor:pointer;transition:background-color .16s ease,color .16s ease,border-color .16s ease}
.pagecraft-qapills-pill[aria-selected="true"]{background:var(--qp-accent,#1B3B9B);border-color:var(--qp-accent,#1B3B9B);color:var(--qp-on,#FFFFFF)}
.pagecraft-qapills-pill:focus-visible{outline:2px solid var(--qp-accent,#1B3B9B);outline-offset:2px}
.pagecraft-qapills-stage{padding:36px 40px;background:var(--qp-surface,#FFFFFF);border:1px solid var(--qp-line,#C8D0DF);border-radius:var(--qp-radius,2px)}
.pagecraft-qapills-panel{display:flex;flex-direction:column;align-items:var(--qp-panel-align,center);text-align:var(--qp-text-align,center);gap:14px}
.pagecraft-qapills-panel[hidden]{display:none}
.pagecraft-qapills-q{margin:0;font-size:clamp(22px,2.2vw,28px);line-height:1.3;font-weight:600;color:var(--qp-ink,#0C1220);max-width:42ch}
.pagecraft-qapills-a{margin:0;font-size:16px;line-height:1.65;color:var(--qp-muted,#4A566E);max-width:60ch}
.pagecraft-qapills-note{font-size:13px;line-height:1.45;font-weight:600;color:var(--qp-ink,#0C1220);padding-top:6px}
.pagecraft-qapills-link{font-size:14px;font-weight:600;line-height:1.4;color:var(--qp-accent,#1B3B9B);text-decoration:underline;text-underline-offset:4px}
@media (max-width:860px){.pagecraft-qapills-stage{padding:24px 20px}.pagecraft-qapills-bar{justify-content:flex-start}}
@media (prefers-reduced-motion:reduce){.pagecraft-qapills-pill{transition:none}}`,Da=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-qapills[data-qapills]').forEach(function(root){
    if(root.hasAttribute('data-pc-qp-ready'))return;
    root.setAttribute('data-pc-qp-ready','1');
    var pills=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-qapills-pill[data-qa-idx]'));
    var panels=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-qapills-panel[data-qa-panel]'));
    if(!pills.length||!panels.length)return;
    function activate(idx,focusPill){
      pills.forEach(function(p,i){
        var on=i===idx;
        p.setAttribute('aria-selected',on?'true':'false');
        p.setAttribute('tabindex',on?'0':'-1');
        if(on&&focusPill)p.focus();
      });
      panels.forEach(function(pn,i){
        if(i===idx)pn.removeAttribute('hidden');
        else pn.setAttribute('hidden','');
      });
    }
    var offs=[];
    pills.forEach(function(pill,idx){
      function onClick(){activate(idx,false);}
      function onKey(e){
        var n=pills.length;
        if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();activate((idx+1)%n,true);}
        else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();activate((idx-1+n)%n,true);}
        else if(e.key==='Home'){e.preventDefault();activate(0,true);}
        else if(e.key==='End'){e.preventDefault();activate(n-1,true);}
      }
      pill.addEventListener('click',onClick);
      pill.addEventListener('keydown',onKey);
      offs.push(function(){
        pill.removeEventListener('click',onClick);
        pill.removeEventListener('keydown',onKey);
      });
    });
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-qp-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,Ra=`.pagecraft-form.pagecraft-dockbar{position:relative;z-index:3;display:flex;flex-wrap:wrap;align-items:stretch;gap:0;padding:8px;background:var(--db-surface,#FFFFFF);border:1px solid var(--db-line,#C8D0DF);border-radius:var(--db-radius,4px);box-shadow:0 22px 52px rgba(12,18,32,.14)}
.pagecraft-dockbar>.pagecraft-field,.pagecraft-dockbar>.pagecraft-field.half{flex:1 1 170px;min-width:0;padding:12px 18px;justify-content:center;gap:4px}
.pagecraft-dockbar>.pagecraft-field+.pagecraft-field{border-inline-start:1px solid var(--db-line,#C8D0DF)}
.pagecraft-dockbar>.pagecraft-field label{font-size:11.5px;line-height:1.35;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--db-ink,#0C1220)}
.pagecraft-dockbar>.pagecraft-field :is(input:not([type=checkbox]),select,textarea){min-width:0;padding:2px 0;border:0;border-radius:0;background:transparent;font-size:14.5px;line-height:1.45;color:var(--db-ink,#0C1220);outline:none}
.pagecraft-dockbar>.pagecraft-field textarea{height:1.9em;resize:none}
.pagecraft-dockbar>.pagecraft-field :is(input,textarea)::placeholder{color:var(--db-muted,#4A566E);opacity:1}
.pagecraft-dockbar>.pagecraft-field:focus-within{box-shadow:inset 0 0 0 2px var(--db-accent,#1B3B9B)}
.pagecraft-dockbar>.pagecraft-form-button{flex:0 0 auto;align-self:stretch;margin:0 0 0 8px;padding:0 26px;min-height:54px;border-radius:var(--db-radius,4px);background:var(--db-accent,#1B3B9B);color:var(--db-on,#FFFFFF);font-size:14.5px;line-height:1.3;transition:background-color .16s ease}
.pagecraft-dockbar>.pagecraft-form-button:is(:hover,:focus-visible):not(:disabled){background:var(--db-ink,#0C1220);color:var(--db-surface,#FFFFFF)}
.pagecraft-dockbar>.pagecraft-form-button:focus-visible{outline:2px solid var(--db-accent,#1B3B9B);outline-offset:2px}
.pagecraft-dockbar>.pagecraft-form-status{padding:8px 18px 4px;color:var(--db-muted,#4A566E)}
@media (max-width:767px){
  .pagecraft-dockbar>.pagecraft-field,.pagecraft-dockbar>.pagecraft-field.half{flex-basis:100%}
  .pagecraft-dockbar>.pagecraft-field+.pagecraft-field{border-inline-start:0;border-top:1px solid var(--db-line,#C8D0DF)}
  .pagecraft-dockbar>.pagecraft-form-button{flex:1 1 100%;margin:8px 0 0;min-height:48px}
}
@media (prefers-reduced-motion:reduce){.pagecraft-dockbar>.pagecraft-form-button{transition:none}}`,Oa=`.pagecraft-arches{width:100%;padding:14px 0 32px}
.pagecraft-arches-list{list-style:none;margin:0 auto;padding:0;max-width:1080px;display:flex;align-items:flex-end;justify-content:center}
.pagecraft-arches-item{margin:0 -10px;width:clamp(140px,18vw,212px);flex:0 1 auto;border-radius:999px 999px 14px 14px;overflow:hidden;border:3px solid var(--ar-frame,#FAF7F2);background:var(--ar-bg,#DCD3C6);box-shadow:0 22px 46px rgba(24,21,18,.15);transition:transform .34s cubic-bezier(.22,1,.36,1)}
.pagecraft-arches-item:nth-child(1){transform:translateY(26px) rotate(-7deg);z-index:1}
.pagecraft-arches-item:nth-child(2){transform:translateY(8px) rotate(-3.5deg);z-index:2}
.pagecraft-arches-item:nth-child(3){transform:translateY(-6px) rotate(0deg);z-index:4;width:clamp(154px,19.5vw,228px)}
.pagecraft-arches-item:nth-child(4){transform:translateY(8px) rotate(3.5deg);z-index:2}
.pagecraft-arches-item:nth-child(5){transform:translateY(26px) rotate(7deg);z-index:1}
.pagecraft-arches-item:hover{z-index:5;transform:translateY(-10px) rotate(0deg)}
.pagecraft-arches-img{display:block;width:100%;height:auto;aspect-ratio:2 / 3;object-fit:cover}
@media (max-width:860px){
  .pagecraft-arches{padding:4px 0 12px}
  .pagecraft-arches-list{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
  .pagecraft-arches-item,.pagecraft-arches-item:nth-child(n){margin:0;width:calc(33.333% - 7px);transform:none;border-width:2px}
}
@media (prefers-reduced-motion:reduce){.pagecraft-arches-item{transition:none}}`,Na=`.pagecraft-chapters{width:100%;display:flex;flex-direction:column;gap:22px}
.pagecraft-chapters-stage{position:relative;display:grid;border-radius:var(--ch-radius,14px);overflow:hidden;background:#161311;border:1px solid var(--ch-line,rgba(244,239,232,.14))}
.pagecraft-chapters-pause{position:absolute;inset-block-start:14px;inset-inline-end:14px;z-index:2;min-height:36px;padding:6px 14px;border:0;border-radius:999px;background:rgba(18,15,13,.72);color:#fff;font:600 13px/1.2 inherit;cursor:pointer}
.pagecraft-chapters-pause[hidden]{display:none}
.pagecraft-chapters-pause:focus-visible{outline:2px solid #fff;outline-offset:2px}
.pagecraft-chapters-slide{grid-area:1 / 1;position:relative;margin:0;opacity:0;visibility:hidden;transition:opacity .38s cubic-bezier(.22,1,.36,1),visibility .38s ease}
.pagecraft-chapters-slide[data-active="1"]{opacity:1;visibility:visible}
.pagecraft-chapters-img{display:block;width:100%;height:auto;aspect-ratio:var(--ch-ratio,16 / 9);object-fit:cover}
.pagecraft-chapters-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(18,15,13,.04) 38%,rgba(18,15,13,.82) 100%);display:flex;align-items:flex-end;padding:32px 36px}
.pagecraft-chapters-overlay{margin:0;font-size:clamp(18px,2vw,24px);line-height:1.4;font-weight:500;color:#FAF7F2;max-width:46ch}
.pagecraft-chapters-nav{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:20px}
.pagecraft-chapters-btn{appearance:none;margin:0;padding:0;border:0;background:transparent;text-align:left;color:var(--ch-ink,#FAF7F2);font-family:inherit;display:flex;flex-direction:column;gap:10px;cursor:pointer}
.pagecraft-chapters-btn:focus-visible{outline:2px solid var(--ch-accent,#DF9E68);outline-offset:4px;border-radius:4px}
.pagecraft-chapters-bar{display:block;width:100%;height:2px;background:var(--ch-line,rgba(244,239,232,.2));overflow:hidden;border-radius:999px}
.pagecraft-chapters-fill{display:block;width:100%;height:100%;background:var(--ch-accent,#DF9E68);transform:scaleX(0);transform-origin:left center;transition:transform .3s ease}
.pagecraft-chapters-btn[aria-selected="true"] .pagecraft-chapters-fill{transform:scaleX(1)}
.pagecraft-chapters-title{font-size:16px;line-height:1.38;font-weight:600;color:var(--ch-ink,#FAF7F2)}
.pagecraft-chapters-btn[aria-selected="false"] .pagecraft-chapters-title{opacity:.76}
.pagecraft-chapters-sub{font-size:13.5px;line-height:1.48;color:var(--ch-muted,#C8BDB0)}
@media (max-width:860px){.pagecraft-chapters-scrim{padding:18px 20px}.pagecraft-chapters-nav{gap:14px}}
@media (prefers-reduced-motion:reduce){.pagecraft-chapters-slide,.pagecraft-chapters-fill{transition:none}}`,Fa=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-chapters[data-chapters]').forEach(function(root){
    if(root.hasAttribute('data-pc-ch-ready'))return;
    root.setAttribute('data-pc-ch-ready','1');
    var btns=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-chapters-btn[data-ch-btn]'));
    var slides=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-chapters-slide[data-ch-slide]'));
    if(!btns.length||!slides.length)return;
    var cur=0;
    function select(idx,focusBtn){
      cur=idx;
      btns.forEach(function(b,i){
        var on=i===idx;
        b.setAttribute('aria-selected',on?'true':'false');
        b.setAttribute('tabindex',on?'0':'-1');
        if(on&&focusBtn)b.focus();
      });
      slides.forEach(function(s,i){
        var on=i===idx;
        s.setAttribute('data-active',on?'1':'0');
        s.setAttribute('aria-hidden',on?'false':'true');
      });
    }
    var offs=[];
    btns.forEach(function(btn,idx){
      function onClick(){select(idx,false);resetTimer();}
      function onKey(e){
        var n=btns.length;
        if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();select((idx+1)%n,true);resetTimer();}
        else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();select((idx-1+n)%n,true);resetTimer();}
        else if(e.key==='Home'){e.preventDefault();select(0,true);resetTimer();}
        else if(e.key==='End'){e.preventDefault();select(n-1,true);resetTimer();}
      }
      btn.addEventListener('click',onClick);
      btn.addEventListener('keydown',onKey);
      offs.push(function(){
        btn.removeEventListener('click',onClick);
        btn.removeEventListener('keydown',onKey);
      });
    });
    var sec=parseFloat(root.getAttribute('data-auto')||'0');
    var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    var timer=null,hover=false,focus=false,paused=false,held=false;
    var toggle=root.querySelector('[data-ch-pause]');
    function hold(){held=hover||focus||paused;}
    function onEnter(){hover=true;hold();}
    function onLeave(){hover=false;hold();}
    function onFocusIn(e){focus=e.target!==toggle;hold();}
    function onFocusOut(e){if(!root.contains(e.relatedTarget)){focus=false;hold();}}
    function onToggle(){paused=!paused;toggle.setAttribute('aria-pressed',paused?'true':'false');toggle.textContent=paused?'Play':'Pause';hold();}
    root.addEventListener('pointerenter',onEnter);root.addEventListener('pointerleave',onLeave);
    root.addEventListener('focusin',onFocusIn);root.addEventListener('focusout',onFocusOut);
    if(toggle){if(reduced||btns.length<2)toggle.hidden=true;else toggle.hidden=false;toggle.addEventListener('click',onToggle);}
    offs.push(function(){root.removeEventListener('pointerenter',onEnter);root.removeEventListener('pointerleave',onLeave);root.removeEventListener('focusin',onFocusIn);root.removeEventListener('focusout',onFocusOut);if(toggle)toggle.removeEventListener('click',onToggle);});
    function resetTimer(){
      if(timer){clearInterval(timer);timer=null;}
      if(sec>0&&!reduced&&btns.length>1){
        timer=setInterval(function(){if(!document.hidden&&!held)select((cur+1)%btns.length,false);},sec*1000);
      }
    }
    resetTimer();
    disposers.push(function(){
      if(timer)clearInterval(timer);
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-ch-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,Ba=`.pagecraft-form.pagecraft-slotpicker{width:100%;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.85fr);gap:36px;align-items:start}
.pagecraft-slotpicker:not([data-ready]) .pagecraft-sp-buttons{display:none}
.pagecraft-slotpicker[data-ready] .pagecraft-sp-native{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.pagecraft-sp-group{position:relative}
.pagecraft-sp-contact{--f-gap:14px;--f-bg:var(--sp-surface,#FAF7F2);--f-text:var(--sp-ink,#181512);--f-label:var(--sp-muted,#5E5349);--f-border:var(--sp-line,#DCD3C6);--f-radius:var(--sp-radius,10px);--f-btn-bg:var(--sp-accent,#8F3D22);display:flex;flex-wrap:wrap;gap:var(--f-gap);font-size:15px}
.pagecraft-sp-percent>.pagecraft-field{flex:0 0 100%}
.pagecraft-sp-percent>.field-width-50{flex-basis:calc((100% - var(--f-gap)) / 2)}
.pagecraft-sp-percent>.field-width-33{flex-basis:calc((100% - var(--f-gap) * 2) / 3)}
.pagecraft-sp-percent>.field-width-25{flex-basis:calc((100% - var(--f-gap) * 3) / 4)}
.pagecraft-sp-percent>.field-width-20{flex-basis:calc((100% - var(--f-gap) * 4) / 5)}
.pagecraft-sp-pass:disabled,.pagecraft-sp-pill:disabled{cursor:not-allowed}
.pagecraft-sp-steps{display:flex;flex-direction:column;gap:26px}
.pagecraft-sp-group{display:flex;flex-direction:column;gap:12px}
.pagecraft-sp-step-h{margin:0;font-size:15px;line-height:1.4;font-weight:600;color:var(--sp-ink,#181512)}
.pagecraft-sp-passes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:12px}
.pagecraft-sp-pass{appearance:none;margin:0;padding:16px 18px;display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:left;font-family:inherit;background:var(--sp-surface,#FAF7F2);border:1px solid var(--sp-line,#DCD3C6);border-radius:var(--sp-radius,10px);color:var(--sp-ink,#181512);cursor:pointer;transition:border-color .16s ease,background-color .16s ease}
.pagecraft-sp-pass[aria-pressed="true"]{border-color:var(--sp-accent,#8F3D22);box-shadow:inset 0 0 0 1px var(--sp-accent,#8F3D22);background:color-mix(in srgb,var(--sp-accent,#8F3D22) 6%,var(--sp-surface,#FAF7F2))}
.pagecraft-sp-pass-name{font-size:15px;line-height:1.38;font-weight:600;color:var(--sp-ink,#181512)}
.pagecraft-sp-pass-meta{font-size:13px;line-height:1.45;color:var(--sp-muted,#5E5349)}
.pagecraft-sp-pass-price{font-size:14px;line-height:1.35;font-weight:700;color:var(--sp-accent,#8F3D22);margin-top:2px}
.pagecraft-sp-pills{display:flex;flex-wrap:wrap;gap:10px}
.pagecraft-sp-pill{appearance:none;margin:0;padding:10px 18px;min-height:42px;font-family:inherit;font-size:14px;line-height:1.35;font-weight:600;background:var(--sp-surface,#FAF7F2);color:var(--sp-ink,#181512);border:1px solid var(--sp-line,#DCD3C6);border-radius:999px;cursor:pointer;transition:background-color .16s ease,color .16s ease,border-color .16s ease}
.pagecraft-sp-pill[aria-pressed="true"]{background:var(--sp-accent,#8F3D22);border-color:var(--sp-accent,#8F3D22);color:var(--sp-on,#FFFFFF)}
.pagecraft-sp-pass:focus-visible,.pagecraft-sp-pill:focus-visible{outline:2px solid var(--sp-accent,#8F3D22);outline-offset:2px}
.pagecraft-sp-summary{padding:28px;background:var(--sp-surface,#FAF7F2);border:1px solid var(--sp-line,#DCD3C6);border-radius:var(--sp-radius,10px);display:flex;flex-direction:column;gap:16px}
.pagecraft-sp-sum-title{margin:0;font-size:20px;line-height:1.35;font-weight:600;color:var(--sp-ink,#181512)}
.pagecraft-sp-rows{display:flex;flex-direction:column;gap:0;border-top:1px solid var(--sp-line,#DCD3C6)}
.pagecraft-sp-row{padding:11px 0;display:flex;justify-content:space-between;align-items:baseline;gap:12px;border-bottom:1px solid var(--sp-line,#DCD3C6);font-size:14px;line-height:1.45;color:var(--sp-muted,#5E5349)}
.pagecraft-sp-row strong{color:var(--sp-ink,#181512);font-weight:600;text-align:right}
.pagecraft-sp-total-row{padding-top:14px;display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:15px;line-height:1.4;font-weight:600;color:var(--sp-ink,#181512)}
.pagecraft-sp-total{font-size:28px;line-height:1.15;font-weight:600;font-variant-numeric:tabular-nums;color:var(--sp-accent,#8F3D22)}
.pagecraft-slotpicker .pagecraft-form-button{align-self:stretch;padding:13px 20px;min-height:46px;display:inline-flex;align-items:center;justify-content:center;background:var(--sp-accent,#8F3D22);color:var(--sp-on,#FFFFFF);border-radius:999px;font-size:14.5px;font-weight:600;line-height:1.35;text-decoration:none;transition:opacity .16s ease}
.pagecraft-slotpicker .pagecraft-form-button:is(:hover,:focus-visible):not(:disabled){opacity:.9}
.pagecraft-sp-note{margin:0;font-size:13px;line-height:1.5;color:var(--sp-muted,#5E5349)}
@media (max-width:860px){.pagecraft-form.pagecraft-slotpicker{grid-template-columns:1fr;gap:24px}.pagecraft-sp-summary{padding:22px 20px}}
@media (max-width:767px){.pagecraft-sp-percent>.pagecraft-field{flex-basis:100%}}
@media (prefers-reduced-motion:reduce){.pagecraft-sp-pass,.pagecraft-sp-pill,.pagecraft-slotpicker .pagecraft-form-button{align-self:stretch;transition:none}}`,qa=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-slotpicker[data-slotpicker]').forEach(function(root){
    if(root.hasAttribute('data-ready'))return;
    var groups=Array.prototype.slice.call(root.querySelectorAll('[data-sp-choice]')).map(function(el){
      return {key:el.getAttribute('data-sp-choice'),select:el.querySelector('select'),buttons:Array.prototype.slice.call(el.querySelectorAll('[data-sp-value]'))};
    }).filter(function(g){return g.select;});
    root.setAttribute('data-ready','');
    var totalEl=root.querySelector('[data-sp-total]');
    function sync(){
      var price=NaN,fixed=false,guests=1;
      groups.forEach(function(g){
        g.buttons.forEach(function(b){
          var on=b.getAttribute('data-sp-value')===g.select.value;
          b.setAttribute('aria-pressed',on?'true':'false');
          b.disabled=g.select.disabled;
          if(on&&g.key==='service'){price=parseFloat(b.getAttribute('data-price'));fixed=b.getAttribute('data-fixed')==='1';}
        });
        if(g.key==='guests')guests=parseInt(g.select.value,10)||1;
        var out=root.querySelector('[data-sp-out="'+g.key+'"]');
        if(out)out.textContent=g.select.value;
      });
      if(totalEl){
        var total=fixed?price:price*guests;
        totalEl.textContent=isFinite(total)?totalEl.getAttribute('data-sym')+(total%1?total.toFixed(2):total):'\u2014';
      }
    }
    var offs=[];
    groups.forEach(function(g){
      g.select.setAttribute('tabindex','-1');
      g.select.addEventListener('change',sync);
      offs.push(function(){g.select.removeEventListener('change',sync);g.select.removeAttribute('tabindex');});
      g.buttons.forEach(function(b){
        function pick(){
          g.select.value=b.getAttribute('data-sp-value');
          g.select.dispatchEvent(new Event('input',{bubbles:true}));
          g.select.dispatchEvent(new Event('change',{bubbles:true}));
        }
        b.addEventListener('click',pick);
        offs.push(function(){b.removeEventListener('click',pick);});
      });
    });
    function onShow(){sync();}
    window.addEventListener('pageshow',onShow);
    offs.push(function(){window.removeEventListener('pageshow',onShow);});
    sync();
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,za=`.pagecraft-reel{position:relative;width:100%;padding:32px 20px 28px;border-radius:var(--rl-stage-radius,20px);background:var(--rl-bg,#f3f3f3);box-sizing:border-box;overflow:hidden;-webkit-user-select:none;user-select:none}
.pagecraft-reel-stage{position:relative;height:var(--rl-height,480px);display:flex;align-items:center;justify-content:center;perspective:1100px;touch-action:pan-y;cursor:grab}
.pagecraft-reel-stage[data-dragging]{cursor:grabbing}
.pagecraft-reel-track{position:relative;width:min(var(--rl-card-w,220px),62vw);aspect-ratio:var(--rl-ratio,9 / 16);max-height:calc(100% - 28px);transform-style:preserve-3d}
.pagecraft-reel-card{position:absolute;inset:0;margin:0;border-radius:var(--rl-radius,16px);overflow:hidden;background:#16181d;transform-origin:center center;transition:transform .55s cubic-bezier(.22,1,.36,1),opacity .45s ease,filter .45s ease,box-shadow .45s ease;will-change:transform,opacity,filter}
.pagecraft-reel-card[data-slot="0"]{transform:translate3d(0,0,0) rotateY(0deg) scale(1);opacity:1;filter:blur(0);z-index:5;box-shadow:0 22px 48px rgba(15,18,24,.24)}
.pagecraft-reel-card[data-slot="-1"]{transform:translate3d(-58%,0,-90px) rotateY(24deg) scale(.86);opacity:.88;filter:blur(2.2px);z-index:4;cursor:pointer;box-shadow:0 14px 32px rgba(15,18,24,.14)}
.pagecraft-reel-card[data-slot="1"]{transform:translate3d(58%,0,-90px) rotateY(-24deg) scale(.86);opacity:.88;filter:blur(2.2px);z-index:4;cursor:pointer;box-shadow:0 14px 32px rgba(15,18,24,.14)}
.pagecraft-reel-card[data-slot="-2"]{transform:translate3d(-104%,0,-180px) rotateY(36deg) scale(.74);opacity:.5;filter:blur(5.5px);z-index:3;cursor:pointer}
.pagecraft-reel-card[data-slot="2"]{transform:translate3d(104%,0,-180px) rotateY(-36deg) scale(.74);opacity:.5;filter:blur(5.5px);z-index:3;cursor:pointer}
.pagecraft-reel-card[data-slot="far"]{transform:translate3d(0,0,-240px) scale(.6);opacity:0;filter:blur(8px);z-index:1;pointer-events:none}
.pagecraft-reel[data-reel-edit] .pagecraft-reel-card,.pagecraft-reel[data-reel-edit] .pagecraft-reel-nav,.pagecraft-reel[data-reel-edit] .pagecraft-reel-dot{pointer-events:none}
.pagecraft-reel-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;-webkit-user-drag:none}
.pagecraft-reel-scrim{position:absolute;inset:0;background:linear-gradient(180deg,transparent 56%,rgba(12,14,18,.62) 100%);pointer-events:none}
.pagecraft-reel-caption{position:absolute;inset-inline:14px;inset-block-end:16px;text-align:center;color:var(--rl-ink,#fff);font-size:13.5px;line-height:1.3;font-weight:500;letter-spacing:.005em;text-shadow:0 1px 6px rgba(0,0,0,.45);opacity:0;transition:opacity .32s ease;pointer-events:none}
.pagecraft-reel-card[data-slot="0"] .pagecraft-reel-caption{opacity:1}
.pagecraft-reel-nav{position:absolute;inset-block-start:50%;transform:translateY(-50%);z-index:8;width:38px;height:38px;border:0;border-radius:999px;background:rgba(255,255,255,.94);color:var(--rl-accent,#E04F3E);box-shadow:0 4px 16px rgba(15,18,24,.12);display:grid;place-items:center;cursor:pointer;padding:0;touch-action:manipulation;transition:transform .2s cubic-bezier(.22,1,.36,1),box-shadow .2s ease}
.pagecraft-reel-nav:hover{transform:translateY(-50%) scale(1.07);box-shadow:0 6px 20px rgba(15,18,24,.16)}
.pagecraft-reel-nav:active{transform:translateY(-50%) scale(.95)}
.pagecraft-reel-nav:focus-visible{outline:2px solid var(--rl-accent,#E04F3E);outline-offset:3px}
.pagecraft-reel-nav[data-reel-prev]{inset-inline-start:14px}
.pagecraft-reel-nav[data-reel-next]{inset-inline-end:14px}
.pagecraft-reel-dots{display:inline-flex;align-items:center;justify-content:center;gap:2px;margin:10px auto 0;padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.88);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 2px 10px rgba(15,18,24,.08);position:relative;left:50%;transform:translateX(-50%);z-index:6}
.pagecraft-reel-dot{appearance:none;border:0;background:transparent;padding:0;margin:0;min-width:16px;height:24px;display:inline-grid;place-items:center;cursor:pointer;touch-action:manipulation}
.pagecraft-reel-dot span{display:block;width:6px;height:6px;border-radius:999px;background:rgba(24,26,30,.24);transition:width .24s cubic-bezier(.22,1,.36,1),background-color .2s ease}
.pagecraft-reel-dot[aria-current="true"] span{width:14px;background:var(--rl-accent,#E04F3E)}
.pagecraft-reel-dot:focus-visible{outline:2px solid var(--rl-accent,#E04F3E);outline-offset:1px;border-radius:999px}
.pagecraft-reel-status{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
@media (max-width:640px){
  .pagecraft-reel{padding:24px 12px 20px}
  .pagecraft-reel-card[data-slot="-1"]{transform:translate3d(-44%,0,-80px) rotateY(22deg) scale(.84)}
  .pagecraft-reel-card[data-slot="1"]{transform:translate3d(44%,0,-80px) rotateY(-22deg) scale(.84)}
  .pagecraft-reel-card[data-slot="-2"]{transform:translate3d(-78%,0,-160px) rotateY(32deg) scale(.7)}
  .pagecraft-reel-card[data-slot="2"]{transform:translate3d(78%,0,-160px) rotateY(-32deg) scale(.7)}
  .pagecraft-reel-nav[data-reel-prev]{inset-inline-start:6px}
  .pagecraft-reel-nav[data-reel-next]{inset-inline-end:6px}
}
@media (prefers-reduced-motion:reduce){.pagecraft-reel-card,.pagecraft-reel-caption,.pagecraft-reel-nav,.pagecraft-reel-dot span{transition:none}}`,_a=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-reel[data-reel]').forEach(function(root){
    if(root.hasAttribute('data-pc-rl-ready')||root.hasAttribute('data-reel-edit'))return;
    var cards=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-reel-card'));
    if(!cards.length)return;
    root.setAttribute('data-pc-rl-ready','1');
    var stage=root.querySelector('.pagecraft-reel-stage');
    var prevBtn=root.querySelector('[data-reel-prev]');
    var nextBtn=root.querySelector('[data-reel-next]');
    var dots=Array.prototype.slice.call(root.querySelectorAll('[data-reel-dot]'));
    var status=root.querySelector('.pagecraft-reel-status');
    var n=cards.length;
    var active=0;
    function isReducedMotion(){
      return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    function slotOf(i){
      var d=((i-active)%n+n)%n;
      if(d>n/2)d-=n;
      if(d===0)return '0';
      if(d===1||d===-1||d===2||d===-2)return String(d);
      return 'far';
    }
    function syncVideos(){
      var calm=isReducedMotion();
      cards.forEach(function(card,i){
        var v=card.querySelector('video');
        if(!v)return;
        if(i===active&&!calm){
          try{var pr=v.play();if(pr&&typeof pr.catch==='function')pr.catch(function(){});}catch(_){}
        }else{
          try{if(!v.paused)v.pause();}catch(_){}
        }
      });
    }
    function go(nextIdx,announce){
      active=((nextIdx%n)+n)%n;
      cards.forEach(function(card,i){
        card.setAttribute('data-slot',slotOf(i));
      });
      dots.forEach(function(dot,i){
        dot.setAttribute('aria-current',i===active?'true':'false');
      });
      syncVideos();
      if(announce&&status)status.textContent='Reel '+(active+1)+' of '+n;
    }
    var offs=[];
    if(prevBtn){
      function onPrev(){go(active-1,true);}
      prevBtn.addEventListener('click',onPrev);
      offs.push(function(){prevBtn.removeEventListener('click',onPrev);});
    }
    if(nextBtn){
      function onNext(){go(active+1,true);}
      nextBtn.addEventListener('click',onNext);
      offs.push(function(){nextBtn.removeEventListener('click',onNext);});
    }
    dots.forEach(function(dot,i){
      function onDot(){go(i,true);}
      dot.addEventListener('click',onDot);
      offs.push(function(){dot.removeEventListener('click',onDot);});
    });
    cards.forEach(function(card,i){
      function onCardClick(){if(i!==active)go(i,true);}
      card.addEventListener('click',onCardClick);
      offs.push(function(){card.removeEventListener('click',onCardClick);});
    });
    function onKey(e){
      var tag=(e.target&&e.target.tagName)||'';
      if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
      if(e.key==='ArrowLeft'){e.preventDefault();go(active-1,true);}
      else if(e.key==='ArrowRight'){e.preventDefault();go(active+1,true);}
      else if(e.key==='Home'){e.preventDefault();go(0,true);}
      else if(e.key==='End'){e.preventDefault();go(n-1,true);}
    }
    root.addEventListener('keydown',onKey);
    offs.push(function(){root.removeEventListener('keydown',onKey);});
    if(stage){
      var startX=0,down=false;
      function onDown(e){
        if(e.button!==undefined&&e.button!==0)return;
        if(e.target&&e.target.closest&&e.target.closest('button'))return;
        down=true;startX=e.clientX;
        stage.setAttribute('data-dragging','1');
      }
      function onUp(e){
        if(!down)return;
        down=false;
        stage.removeAttribute('data-dragging');
        var dx=e.clientX-startX;
        if(Math.abs(dx)>36)go(dx<0?active+1:active-1,true);
      }
      function onCancel(){down=false;stage.removeAttribute('data-dragging');}
      stage.addEventListener('pointerdown',onDown);
      window.addEventListener('pointerup',onUp);
      stage.addEventListener('pointercancel',onCancel);
      offs.push(function(){
        stage.removeEventListener('pointerdown',onDown);
        window.removeEventListener('pointerup',onUp);
        stage.removeEventListener('pointercancel',onCancel);
      });
    }
    go(0,false);
    disposers.push(function(){
      offs.forEach(function(off){off();});
      cards.forEach(function(card){
        var v=card.querySelector('video');
        if(v)try{if(!v.paused)v.pause();}catch(_){}
      });
      if(stage)stage.removeAttribute('data-dragging');
      root.removeAttribute('data-pc-rl-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,ja=`.pagecraft-grow{position:relative;width:100%;height:var(--gc-height,480px);border-radius:var(--gc-stage-radius,22px);background:var(--gc-bg,#E4E4E4);overflow:hidden;display:flex;align-items:center;-webkit-user-select:none;user-select:none;--gc-part:32px}
.pagecraft-grow-bg{position:absolute;inset:0;pointer-events:none;z-index:0;opacity:0;transition:opacity .48s cubic-bezier(.22,1,.36,1)}
.pagecraft-grow-bg[data-on]{opacity:1}
.pagecraft-grow-bg-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.26);filter:blur(46px) saturate(1.25) brightness(.88);display:block}
.pagecraft-grow-bg::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(16,18,22,.12),rgba(16,18,22,.36))}
.pagecraft-grow-track{position:relative;z-index:1;display:flex;align-items:center;gap:var(--gc-gap,12px);padding-inline:12px;will-change:transform}
.pagecraft-grow-card{position:relative;flex:none;width:var(--gc-card-w,200px);aspect-ratio:var(--gc-ratio,3 / 4);border:0;padding:0;margin:0;border-radius:var(--gc-radius,6px);overflow:hidden;background:#1a1c20;cursor:pointer;display:block;font-family:inherit;text-align:center;transform:translate3d(0,0,0) scale(1);opacity:1;filter:none;z-index:1;box-shadow:0 6px 18px rgba(15,18,24,.12);transition:transform .46s cubic-bezier(.22,1,.36,1),opacity .36s ease,filter .36s ease,box-shadow .42s ease}
.pagecraft-grow-card:focus-visible{outline:2px solid #fff;outline-offset:3px}
.pagecraft-grow[data-grow-edit] .pagecraft-grow-card{pointer-events:none}
.pagecraft-grow-card[data-grow-state="active"]{transform:translate3d(0,0,0) scale(1.26);z-index:4;opacity:1;filter:none;box-shadow:0 24px 54px rgba(10,12,16,.38)}
.pagecraft-grow-card[data-grow-state="left"]{transform:translate3d(calc(-1 * var(--gc-part,32px)),0,0) scale(1);opacity:.54;filter:saturate(.76) brightness(.88)}
.pagecraft-grow-card[data-grow-state="right"]{transform:translate3d(var(--gc-part,32px),0,0) scale(1);opacity:.54;filter:saturate(.76) brightness(.88)}
.pagecraft-grow-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;-webkit-user-drag:none}
.pagecraft-grow-scrim{position:absolute;inset:0;background:linear-gradient(180deg,transparent 54%,rgba(10,12,16,.72) 100%);opacity:0;transition:opacity .32s ease;pointer-events:none}
.pagecraft-grow-cap{position:absolute;inset-inline:12px;inset-block-end:14px;display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--gc-ink,#fff);opacity:0;transform:translateY(6px);transition:opacity .32s ease,transform .36s cubic-bezier(.22,1,.36,1);pointer-events:none}
.pagecraft-grow-card[data-grow-state="active"] .pagecraft-grow-scrim,.pagecraft-grow-card[data-grow-state="active"] .pagecraft-grow-cap{opacity:1;transform:none}
.pagecraft-grow-title{font-size:14.5px;line-height:1.25;font-weight:600;letter-spacing:-.01em;text-shadow:0 1px 6px rgba(0,0,0,.45)}
.pagecraft-grow-sub{font-size:11.5px;line-height:1.3;font-weight:400;opacity:.82;text-shadow:0 1px 4px rgba(0,0,0,.4)}
@media (max-width:640px){
  .pagecraft-grow{height:var(--gc-height,380px)}
  .pagecraft-grow-card{width:min(var(--gc-card-w,160px),44vw)}
  .pagecraft-grow-card[data-grow-state="active"]{transform:translate3d(0,0,0) scale(1.18)}
}
@media (prefers-reduced-motion:reduce){.pagecraft-grow-bg,.pagecraft-grow-card,.pagecraft-grow-scrim,.pagecraft-grow-cap{transition:none}}`,Ha=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-grow[data-grow]').forEach(function(root){
    if(root.hasAttribute('data-pc-gc-ready')||root.hasAttribute('data-grow-edit'))return;
    var track=root.querySelector('.pagecraft-grow-track');
    if(!track)return;
    var baseCount=parseInt(root.getAttribute('data-grow-count')||'0',10)||0;
    if(!baseCount)return;
    root.setAttribute('data-pc-gc-ready','1');
    var bgWrap=root.querySelector('.pagecraft-grow-bg');
    var bgImg=root.querySelector('.pagecraft-grow-bg-img');
    var rawSpeed=parseFloat(root.getAttribute('data-grow-speed')||'36');
    var speed=isFinite(rawSpeed)&&rawSpeed>=0?rawSpeed:36;
    function isReducedMotion(){
      return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    var cards=Array.prototype.slice.call(track.querySelectorAll('.pagecraft-grow-card'));
    var activeIdx=-1;
    var offset=0;
    var rafId=0;
    var prevTime=0;
    var setWidth=0;
    function measureSet(){
      if(cards.length>baseCount){
        var d=cards[baseCount].offsetLeft-cards[0].offsetLeft;
        if(d>0)setWidth=d;
      }
    }
    function setActive(idx){
      activeIdx=idx;
      if(idx<0){
        root.removeAttribute('data-has-active');
        cards.forEach(function(c){c.removeAttribute('data-grow-state');});
        if(bgWrap)bgWrap.removeAttribute('data-on');
        return;
      }
      var card=cards[idx];
      if(!card)return;
      var w=card.offsetWidth||200;
      var part=Math.round(w*0.13+6);
      root.style.setProperty('--gc-part',part+'px');
      root.setAttribute('data-has-active','1');
      cards.forEach(function(c,i){
        c.setAttribute('data-grow-state',i===idx?'active':(i<idx?'left':'right'));
      });
      var img=card.querySelector('.pagecraft-grow-img');
      if(bgWrap&&bgImg&&img&&img.getAttribute('src')){
        bgImg.setAttribute('src',img.getAttribute('src'));
        bgWrap.setAttribute('data-on','1');
      }
    }
    var offs=[];
    cards.forEach(function(card,idx){
      function onEnter(){setActive(idx);}
      function onFocus(){setActive(idx);}
      function onClick(){setActive(activeIdx===idx?-1:idx);}
      card.addEventListener('pointerenter',onEnter);
      card.addEventListener('focus',onFocus);
      card.addEventListener('click',onClick);
      offs.push(function(){
        card.removeEventListener('pointerenter',onEnter);
        card.removeEventListener('focus',onFocus);
        card.removeEventListener('click',onClick);
      });
    });
    function onLeave(){setActive(-1);}
    function onFocusOut(e){
      var to=e.relatedTarget;
      if(!to||!root.contains(to))setActive(-1);
    }
    function onKey(e){
      if(e.key==='Escape'&&activeIdx>=0){setActive(-1);}
    }
    root.addEventListener('pointerleave',onLeave);
    root.addEventListener('focusout',onFocusOut);
    root.addEventListener('keydown',onKey);
    offs.push(function(){
      root.removeEventListener('pointerleave',onLeave);
      root.removeEventListener('focusout',onFocusOut);
      root.removeEventListener('keydown',onKey);
    });
    function tick(t){
      if(!prevTime)prevTime=t;
      var dt=Math.min(0.05,Math.max(0,(t-prevTime)/1000));
      prevTime=t;
      if(activeIdx<0&&speed>0&&!isReducedMotion()){
        if(!setWidth)measureSet();
        if(setWidth>0){
          offset=(offset+speed*dt)%setWidth;
          track.style.transform='translate3d('+(-offset).toFixed(2)+'px,0,0)';
        }
      }
      rafId=requestAnimationFrame(tick);
    }
    measureSet();
    if(speed>0&&!isReducedMotion()&&typeof requestAnimationFrame==='function'){
      rafId=requestAnimationFrame(tick);
    }
    disposers.push(function(){
      if(rafId){cancelAnimationFrame(rafId);rafId=0;}
      offs.forEach(function(off){off();});
      setActive(-1);
      track.style.transform='';
      root.removeAttribute('data-pc-gc-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
<\/script>
`,Va=`.pagecraft-deck{position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:20px;padding:18px 0 8px;-webkit-user-select:none;user-select:none}
.pagecraft-deck-stage{position:relative;width:min(var(--dk-card-w,320px),86vw);aspect-ratio:var(--dk-ratio,4 / 5);touch-action:pan-y}
.pagecraft-deck-card{position:absolute;inset:0;margin:0;border-radius:var(--dk-radius,18px);overflow:hidden;background:var(--dk-bg,#181a20);box-shadow:0 18px 42px rgba(10,12,18,.26);transform-origin:center 72%;transition:transform .5s cubic-bezier(.22,1.12,.36,1),opacity .4s ease,filter .4s ease;will-change:transform,opacity}
.pagecraft-deck-card[data-depth="0"]{transform:translate3d(0,0,0) rotate(0deg) scale(1);z-index:5;opacity:1;cursor:grab}
.pagecraft-deck-card[data-depth="0"][data-dragging]{transition:none;cursor:grabbing}
.pagecraft-deck-card[data-depth="1"]{transform:translate3d(14px,8px,0) rotate(3.8deg) scale(.95);z-index:4;opacity:.92;filter:brightness(.88)}
.pagecraft-deck-card[data-depth="2"]{transform:translate3d(-14px,15px,0) rotate(-4.2deg) scale(.90);z-index:3;opacity:.78;filter:brightness(.76)}
.pagecraft-deck-card[data-depth="3"]{transform:translate3d(10px,21px,0) rotate(6deg) scale(.85);z-index:2;opacity:.55;filter:brightness(.66)}
.pagecraft-deck-card[data-depth="back"]{transform:translate3d(0,24px,0) rotate(0deg) scale(.8);z-index:1;opacity:0;pointer-events:none}
.pagecraft-deck-card[data-fling="right"]{transform:translate3d(120%,-18px,0) rotate(18deg) scale(.96);opacity:0;z-index:6;transition:transform .34s cubic-bezier(.32,0,.67,0),opacity .28s ease}
.pagecraft-deck-card[data-fling="left"]{transform:translate3d(-120%,-18px,0) rotate(-18deg) scale(.96);opacity:0;z-index:6;transition:transform .34s cubic-bezier(.32,0,.67,0),opacity .28s ease}
.pagecraft-deck[data-deck-edit] .pagecraft-deck-card,.pagecraft-deck[data-deck-edit] .pagecraft-deck-btn{pointer-events:none}
.pagecraft-deck-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;-webkit-user-drag:none}
.pagecraft-deck-scrim{position:absolute;inset:0;background:linear-gradient(180deg,transparent 52%,rgba(10,12,18,.76) 100%);pointer-events:none}
.pagecraft-deck-cap{position:absolute;inset-inline:18px;inset-block-end:18px;display:flex;flex-direction:column;gap:4px;color:var(--dk-ink,#fff);pointer-events:none}
.pagecraft-deck-tag{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dk-accent,#f59e0b)}
.pagecraft-deck-title{font-size:18px;line-height:1.25;font-weight:600;letter-spacing:-.01em}
.pagecraft-deck-controls{display:inline-flex;align-items:center;gap:12px}
.pagecraft-deck-btn{width:38px;height:38px;border-radius:999px;border:1px solid var(--dk-line,rgba(0,0,0,.14));background:var(--dk-btn-bg,#fff);color:var(--dk-btn-ink,#18181b);display:grid;place-items:center;cursor:pointer;padding:0;touch-action:manipulation;transition:transform .18s ease,border-color .18s ease}
.pagecraft-deck-btn:hover{transform:scale(1.06)}
.pagecraft-deck-btn:active{transform:scale(.94)}
.pagecraft-deck-btn:focus-visible{outline:2px solid var(--dk-accent,#f59e0b);outline-offset:2px}
.pagecraft-deck-count{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--dk-muted,inherit);min-width:44px;text-align:center}
@media (prefers-reduced-motion:reduce){.pagecraft-deck-card,.pagecraft-deck-btn{transition:none}}`,Wa=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-deck[data-deck]').forEach(function(root){
    if(root.hasAttribute('data-pc-dk-ready')||root.hasAttribute('data-deck-edit'))return;
    var cards=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-deck-card'));
    if(!cards.length)return;
    root.setAttribute('data-pc-dk-ready','1');
    var prevBtn=root.querySelector('[data-deck-prev]');
    var nextBtn=root.querySelector('[data-deck-next]');
    var countEl=root.querySelector('[data-deck-count]');
    var n=cards.length,top=0,busy=false,timer=0;
    function isReducedMotion(){return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);}
    function paint(){
      cards.forEach(function(c,i){
        var d=((i-top)%n+n)%n;
        c.removeAttribute('data-fling');
        c.removeAttribute('data-dragging');
        c.style.transform='';
        c.setAttribute('data-depth',d<=3?String(d):'back');
        c.setAttribute('aria-hidden',d===0?'false':'true');
      });
      if(countEl)countEl.textContent=(top+1)+' / '+n;
    }
    function step(dir){
      if(n<2||busy)return;
      if(isReducedMotion()){top=((top+dir)%n+n)%n;paint();return;}
      busy=true;
      var activeCard=cards[top];
      activeCard.style.transform='';
      activeCard.removeAttribute('data-dragging');
      activeCard.setAttribute('data-fling',dir>0?'right':'left');
      timer=setTimeout(function(){
        top=((top+dir)%n+n)%n;
        busy=false;
        paint();
      },240);
    }
    var offs=[];
    if(prevBtn){var onP=function(){step(-1);};prevBtn.addEventListener('click',onP);offs.push(function(){prevBtn.removeEventListener('click',onP);});}
    if(nextBtn){var onN=function(){step(1);};nextBtn.addEventListener('click',onN);offs.push(function(){nextBtn.removeEventListener('click',onN);});}
    var stage=root.querySelector('.pagecraft-deck-stage');
    if(stage){
      var drag=null;
      function onDown(e){
        if(busy||n<2||(e.button!==undefined&&e.button!==0))return;
        var card=cards[top];
        if(!card||!card.contains(e.target))return;
        drag={x:e.clientX,y:e.clientY,dx:0,dy:0,id:e.pointerId,moved:false};
        try{card.setPointerCapture(e.pointerId);}catch(_){}
      }
      function onMove(e){
        if(!drag)return;
        drag.dx=e.clientX-drag.x;drag.dy=e.clientY-drag.y;
        if(!drag.moved&&Math.abs(drag.dx)+Math.abs(drag.dy)>6){drag.moved=true;cards[top].setAttribute('data-dragging','1');}
        if(!drag.moved)return;
        var rot=Math.max(-20,Math.min(20,drag.dx*0.065));
        cards[top].style.transform='translate3d('+drag.dx.toFixed(1)+'px,'+(drag.dy*0.35).toFixed(1)+'px,0) rotate('+rot.toFixed(1)+'deg)';
      }
      function onUp(){
        if(!drag)return;
        var d0=drag;drag=null;
        var card=cards[top];
        try{card.releasePointerCapture(d0.id);}catch(_){}
        card.removeAttribute('data-dragging');
        if(!d0.moved){step(1);return;}
        if(Math.abs(d0.dx)>68){step(d0.dx>0?1:-1);}
        else{card.style.transform='';}
      }
      stage.addEventListener('pointerdown',onDown);
      window.addEventListener('pointermove',onMove);
      window.addEventListener('pointerup',onUp);
      stage.addEventListener('pointercancel',onUp);
      offs.push(function(){
        stage.removeEventListener('pointerdown',onDown);
        window.removeEventListener('pointermove',onMove);
        window.removeEventListener('pointerup',onUp);
        stage.removeEventListener('pointercancel',onUp);
      });
    }
    function onKey(e){
      if(e.key==='ArrowRight'){e.preventDefault();step(1);}
      else if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}
    }
    root.addEventListener('keydown',onKey);
    offs.push(function(){root.removeEventListener('keydown',onKey);});
    paint();
    disposers.push(function(){
      if(timer){clearTimeout(timer);timer=0;}
      offs.forEach(function(off){off();});
      cards.forEach(function(c){c.style.transform='';c.removeAttribute('data-fling');c.removeAttribute('data-dragging');});
      root.removeAttribute('data-pc-dk-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){disposers.forEach(function(d){d();});});
  }
})();
<\/script>
`,Ua=`.pagecraft-metrics{display:grid;grid-template-columns:repeat(var(--mt-cols,3),minmax(0,1fr));gap:var(--mt-gap,18px);width:100%}
.pagecraft-metric-card{padding:24px 22px;border-radius:var(--mt-radius,14px);background:var(--mt-bg,#f6f6f3);border:1px solid var(--mt-line,rgba(0,0,0,.1));display:flex;flex-direction:column;gap:8px;min-width:0}
.pagecraft-metric-val{display:inline-flex;align-items:baseline;font-size:clamp(30px,3.6vw,46px);line-height:1.05;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:var(--mt-accent,#18181b)}
.pagecraft-metric-affix{font-weight:600;opacity:.85}
.pagecraft-metric-drum{display:inline-block;height:1.05em;overflow:hidden;vertical-align:baseline}
.pagecraft-metric-reel{display:flex;flex-direction:column;transform:translateY(calc(var(--mt-d,0) * -1.05em));transition:transform var(--mt-dur,.95s) cubic-bezier(.16,1,.3,1)}
.pagecraft-metrics[data-metrics-idle] .pagecraft-metric-reel{transform:translateY(0);transition:none}
.pagecraft-metric-reel span{display:block;height:1.05em;line-height:1.05em}
.pagecraft-metric-label{font-size:15px;line-height:1.35;font-weight:600;color:var(--mt-ink,#18181b)}
.pagecraft-metric-detail{margin:0;font-size:13.5px;line-height:1.48;color:var(--mt-muted,#666)}
@media (max-width:768px){.pagecraft-metrics{grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))}}
@media (prefers-reduced-motion:reduce){.pagecraft-metric-reel{transition:none !important}}`,Ya=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-metrics[data-metrics]').forEach(function(root){
    if(root.hasAttribute('data-pc-mt-ready')||root.hasAttribute('data-metrics-edit'))return;
    root.setAttribute('data-pc-mt-ready','1');
    var rm=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if(rm||typeof IntersectionObserver!=='function'){
      root.removeAttribute('data-metrics-idle');
      disposers.push(function(){root.removeAttribute('data-pc-mt-ready');});
      return;
    }
    root.setAttribute('data-metrics-idle','1');
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting)return;
        if(typeof requestAnimationFrame==='function'){
          requestAnimationFrame(function(){root.removeAttribute('data-metrics-idle');});
        }else{
          root.removeAttribute('data-metrics-idle');
        }
        io.disconnect();
      });
    },{threshold:0.2});
    io.observe(root);
    disposers.push(function(){
      io.disconnect();
      root.removeAttribute('data-metrics-idle');
      root.removeAttribute('data-pc-mt-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){disposers.forEach(function(d){d();});});
  }
})();
<\/script>
`,Ga=`.pagecraft-spotlight{display:grid;grid-template-columns:repeat(var(--sp-cols,3),minmax(0,1fr));gap:var(--sp-gap,18px);width:100%}
.pagecraft-spot-card{position:relative;padding:28px 26px;border-radius:var(--sp-radius,18px);background:radial-gradient(120% 90% at 50% 0%,rgba(255,255,255,.045),transparent 55%),var(--sp-bg,#111318);border:1px solid var(--sp-line,rgba(255,255,255,.1));color:var(--sp-ink,#f4f5f7);display:flex;flex-direction:column;gap:12px;overflow:hidden;isolation:isolate;min-width:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 1px 2px rgba(0,0,0,.22);transition:transform .28s cubic-bezier(.22,1,.36,1),box-shadow .28s ease,border-color .28s ease;--mx:-999px;--my:-999px}
.pagecraft-spot-card[data-spot-over="1"],.pagecraft-spot-card:hover{transform:translateY(-3px);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 16px 36px -14px rgba(0,0,0,.55)}
.pagecraft-spot-card::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.5px;background:radial-gradient(240px circle at var(--mx) var(--my),var(--sp-glow,rgba(56,189,248,.92)),rgba(56,189,248,.18) 42%,transparent 72%);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask-composite:exclude;pointer-events:none;z-index:3;opacity:0;transition:opacity .26s ease}
.pagecraft-spot-card::after{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(300px circle at var(--mx) var(--my),var(--sp-sheen,rgba(56,189,248,.18)),transparent 68%);pointer-events:none;z-index:1;opacity:0;transition:opacity .26s ease}
.pagecraft-spot-grid{position:absolute;inset:0;border-radius:inherit;background-image:radial-gradient(rgba(255,255,255,.22) 1px,transparent 1px);background-size:18px 18px;-webkit-mask-image:radial-gradient(220px circle at var(--mx) var(--my),#000 0%,rgba(0,0,0,.45) 45%,transparent 75%);mask-image:radial-gradient(220px circle at var(--mx) var(--my),#000 0%,rgba(0,0,0,.45) 45%,transparent 75%);pointer-events:none;z-index:0;opacity:0;transition:opacity .26s ease}
.pagecraft-spotlight[data-spot-lit] .pagecraft-spot-card::before,.pagecraft-spotlight[data-spot-lit] .pagecraft-spot-card::after,.pagecraft-spotlight[data-spot-lit] .pagecraft-spot-grid{opacity:1}
.pagecraft-spot-tag{position:relative;z-index:2;display:inline-flex;align-items:center;gap:6px;width:fit-content;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--sp-accent,#38bdf8)}
.pagecraft-spot-tag::before{content:"";width:5px;height:5px;border-radius:999px;background:currentColor;opacity:.85}
.pagecraft-spot-title{position:relative;z-index:2;margin:2px 0 0;font-size:19px;line-height:1.28;font-weight:600;letter-spacing:-.015em;color:var(--sp-ink,#f4f5f7)}
.pagecraft-spot-detail{position:relative;z-index:2;margin:0;font-size:14px;line-height:1.58;color:var(--sp-muted,#9aa3b2)}
.pagecraft-spot-link{position:relative;z-index:2;margin-top:auto;padding-top:8px;font-size:13.5px;font-weight:600;color:var(--sp-accent,#38bdf8);text-decoration:none;display:inline-flex;align-items:center;gap:6px;width:fit-content}
.pagecraft-spot-link span{display:inline-block;transition:transform .22s cubic-bezier(.22,1,.36,1)}
.pagecraft-spot-link:hover span{transform:translateX(4px)}
.pagecraft-spot-link:focus-visible{outline:2px solid var(--sp-accent,#38bdf8);outline-offset:3px;border-radius:4px}
@media (max-width:720px){.pagecraft-spotlight{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.pagecraft-spot-card,.pagecraft-spot-card::before,.pagecraft-spot-card::after,.pagecraft-spot-grid,.pagecraft-spot-link span{transition:none}}`,Ka=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-spotlight[data-spotlight]').forEach(function(root){
    if(root.hasAttribute('data-pc-sp-ready')||root.hasAttribute('data-spotlight-edit'))return;
    var cards=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-spot-card'));
    if(!cards.length)return;
    root.setAttribute('data-pc-sp-ready','1');
    function onMove(e){
      root.setAttribute('data-spot-lit','1');
      cards.forEach(function(card){
        var r=card.getBoundingClientRect();
        var x=e.clientX-r.left,y=e.clientY-r.top;
        card.style.setProperty('--mx',x.toFixed(1)+'px');
        card.style.setProperty('--my',y.toFixed(1)+'px');
        var over=x>=0&&x<=r.width&&y>=0&&y<=r.height;
        if(over)card.setAttribute('data-spot-over','1');
        else card.removeAttribute('data-spot-over');
      });
    }
    function onLeave(){
      root.removeAttribute('data-spot-lit');
      cards.forEach(function(card){card.removeAttribute('data-spot-over');});
    }
    root.addEventListener('pointermove',onMove);
    root.addEventListener('pointerleave',onLeave);
    disposers.push(function(){
      root.removeEventListener('pointermove',onMove);
      root.removeEventListener('pointerleave',onLeave);
      root.removeAttribute('data-spot-lit');
      cards.forEach(function(card){card.removeAttribute('data-spot-over');});
      root.removeAttribute('data-pc-sp-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){disposers.forEach(function(d){d();});});
  }
})();
<\/script>
`,Za=`.pagecraft-terminal{width:100%;border-radius:var(--tm-radius,16px);background:var(--tm-bg,#0d1016);border:1px solid var(--tm-line,rgba(255,255,255,.11));color:var(--tm-ink,#e6ebf2);overflow:hidden;box-shadow:0 22px 48px -20px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.06);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
.pagecraft-term-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:rgba(255,255,255,.035);border-bottom:1px solid var(--tm-line,rgba(255,255,255,.09))}
.pagecraft-term-dots{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto}
.pagecraft-term-dots i{display:block;width:10px;height:10px;border-radius:999px;opacity:.85}
.pagecraft-term-dots i:nth-child(1){background:#ff5f57}
.pagecraft-term-dots i:nth-child(2){background:#febc2e}
.pagecraft-term-dots i:nth-child(3){background:#28c840}
.pagecraft-term-title{font-family:system-ui,-apple-system,sans-serif;font-size:12.5px;font-weight:500;color:var(--tm-muted,#8b95a5);letter-spacing:.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pagecraft-term-copy{appearance:none;border:1px solid var(--tm-line,rgba(255,255,255,.12));background:rgba(255,255,255,.05);color:var(--tm-ink,#e6ebf2);border-radius:7px;padding:4px 10px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:background .16s ease,border-color .16s ease,color .16s ease}
.pagecraft-term-copy:hover{background:rgba(255,255,255,.11)}
.pagecraft-term-copy[data-copied="1"]{border-color:var(--tm-accent,#34d399);color:var(--tm-accent,#34d399)}
.pagecraft-term-tabs{display:flex;align-items:center;gap:6px;padding:10px 16px 0;overflow-x:auto;scrollbar-width:none}
.pagecraft-term-tabs::-webkit-scrollbar{display:none}
.pagecraft-term-tab{appearance:none;border:1px solid transparent;background:transparent;color:var(--tm-muted,#8b95a5);font-family:system-ui,-apple-system,sans-serif;font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:8px;cursor:pointer;white-space:nowrap;transition:background .18s ease,color .18s ease,border-color .18s ease}
.pagecraft-term-tab:hover{color:var(--tm-ink,#e6ebf2);background:rgba(255,255,255,.05)}
.pagecraft-term-tab[aria-selected="true"]{color:var(--tm-ink,#e6ebf2);background:rgba(255,255,255,.09);border-color:var(--tm-line,rgba(255,255,255,.12))}
.pagecraft-term-body{padding:18px 20px 22px;min-height:152px;display:flex;flex-direction:column;gap:12px}
.pagecraft-term-cmd{margin:0;display:flex;align-items:center;gap:10px;font-size:14px;line-height:1.55;word-break:break-word}
.pagecraft-term-prompt{color:var(--tm-accent,#34d399);font-weight:700;user-select:none;flex:0 0 auto}
.pagecraft-term-text{color:var(--tm-ink,#f4f7fb)}
.pagecraft-term-caret{display:inline-block;width:8px;height:1.15em;margin-left:2px;vertical-align:-2px;background:var(--tm-accent,#34d399);animation:pc-term-blink 1.05s steps(1) infinite}
@keyframes pc-term-blink{0%,49%{opacity:1}50%,100%{opacity:0}}
.pagecraft-term-out{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px;font-size:13px;line-height:1.6;color:var(--tm-muted,#96a1b2);opacity:1;transform:translateY(0);transition:opacity .28s ease,transform .28s ease}
.pagecraft-term-out[data-pending="1"]{opacity:0;transform:translateY(4px)}
.pagecraft-term-line-ok{color:var(--tm-accent,#34d399)}
.pagecraft-term-note{padding:10px 20px;border-top:1px solid var(--tm-line,rgba(255,255,255,.08));background:rgba(255,255,255,.02);font-family:system-ui,-apple-system,sans-serif;font-size:12.5px;color:var(--tm-muted,#8b95a5)}
.pagecraft-term-panel[hidden]{display:none}
@media (prefers-reduced-motion:reduce){.pagecraft-term-caret{animation:none}.pagecraft-term-out{transition:none}}`,Ja=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-terminal[data-terminal]').forEach(function(root){
    if(root.hasAttribute('data-pc-tm-ready')||root.hasAttribute('data-terminal-edit'))return;
    var tabs=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-term-tab'));
    var panels=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-term-panel'));
    var copyBtn=root.querySelector('.pagecraft-term-copy');
    if(!panels.length)return;
    root.setAttribute('data-pc-tm-ready','1');
    var rm=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var active=0,typeTimer=0,copyTimer=0;
    function stopTyping(){if(typeTimer){clearTimeout(typeTimer);typeTimer=0;}}
    function show(idx,animate){
      stopTyping();
      active=((idx%panels.length)+panels.length)%panels.length;
      tabs.forEach(function(t,i){
        var on=i===active;
        t.setAttribute('aria-selected',on?'true':'false');
        t.tabIndex=on?0:-1;
      });
      panels.forEach(function(p,i){
        var on=i===active;
        p.hidden=!on;
      });
      var panel=panels[active];
      var textEl=panel.querySelector('.pagecraft-term-text');
      var outEl=panel.querySelector('.pagecraft-term-out');
      var full=(panel.getAttribute('data-cmd')||'');
      if(!textEl)return;
      if(!animate||rm||!full){
        textEl.textContent=full;
        if(outEl)outEl.removeAttribute('data-pending');
        return;
      }
      textEl.textContent='';
      if(outEl)outEl.setAttribute('data-pending','1');
      var pos=0;
      function tick(){
        pos+=1;
        textEl.textContent=full.slice(0,pos);
        if(pos<full.length){
          typeTimer=setTimeout(tick,18);
        }else{
          typeTimer=0;
          if(outEl)outEl.removeAttribute('data-pending');
        }
      }
      typeTimer=setTimeout(tick,24);
    }
    var offs=[];
    tabs.forEach(function(t,i){
      function onClick(){show(i,true);}
      t.addEventListener('click',onClick);
      offs.push(function(){t.removeEventListener('click',onClick);});
    });
    if(copyBtn){
      function onCopy(){
        var cmd=(panels[active]&&panels[active].getAttribute('data-cmd'))||'';
        if(!cmd)return;
        if(navigator.clipboard&&navigator.clipboard.writeText){
          navigator.clipboard.writeText(cmd).catch(function(){});
        }
        copyBtn.textContent='Copied';
        copyBtn.setAttribute('data-copied','1');
        if(copyTimer)clearTimeout(copyTimer);
        copyTimer=setTimeout(function(){
          copyBtn.textContent='Copy';
          copyBtn.removeAttribute('data-copied');
          copyTimer=0;
        },1600);
      }
      copyBtn.addEventListener('click',onCopy);
      offs.push(function(){copyBtn.removeEventListener('click',onCopy);});
    }
    show(0,false);
    disposers.push(function(){
      stopTyping();
      if(copyTimer){clearTimeout(copyTimer);copyTimer=0;}
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-tm-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){disposers.forEach(function(d){d();});});
  }
})();
<\/script>
`,Xa=`.pagecraft-tilt{display:grid;grid-template-columns:repeat(var(--tl-cols,3),minmax(0,1fr));gap:var(--tl-gap,20px);width:100%}
.pagecraft-tilt-wrap{perspective:1000px;min-width:0}
.pagecraft-tilt-card{position:relative;aspect-ratio:var(--tl-ratio,4/5);border-radius:var(--tl-radius,18px);overflow:hidden;background:var(--tl-bg,#12151c);border:1px solid var(--tl-line,rgba(255,255,255,.12));transform-style:preserve-3d;transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) scale3d(var(--sc,1),var(--sc,1),1);transition:transform .42s cubic-bezier(.22,1,.36,1),box-shadow .32s ease;box-shadow:0 16px 36px -18px rgba(0,0,0,.45);display:flex;flex-direction:column;justify-content:flex-end;isolation:isolate;cursor:default}
.pagecraft-tilt-card[data-tilting="1"]{transition:transform .08s linear,box-shadow .2s ease;box-shadow:0 28px 54px -18px rgba(0,0,0,.62)}
.pagecraft-tilt-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transform:scale(1.04);pointer-events:none}
.pagecraft-tilt-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,10,14,.06) 0%,rgba(8,10,14,.28) 46%,rgba(8,10,14,.86) 100%);pointer-events:none;z-index:1}
.pagecraft-tilt-glare{position:absolute;inset:0;background:radial-gradient(280px circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.28),rgba(255,255,255,.06) 42%,transparent 70%);mix-blend-mode:overlay;pointer-events:none;z-index:2;opacity:var(--go,0);transition:opacity .28s ease}
.pagecraft-tilt-body{position:relative;z-index:3;padding:22px 22px 24px;display:flex;flex-direction:column;gap:8px;transform:translateZ(26px)}
.pagecraft-tilt-tag{display:inline-flex;align-items:center;width:fit-content;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.14);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.2);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#fff}
.pagecraft-tilt-title{margin:0;font-size:20px;line-height:1.22;font-weight:600;letter-spacing:-.015em;color:#fff}
.pagecraft-tilt-detail{margin:0;font-size:13.5px;line-height:1.5;color:rgba(255,255,255,.8)}
@media (max-width:720px){.pagecraft-tilt{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.pagecraft-tilt-card,.pagecraft-tilt-glare{transition:none;transform:none}}`,Qa=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-tilt[data-tilt]').forEach(function(root){
    if(root.hasAttribute('data-pc-tl-ready')||root.hasAttribute('data-tilt-edit'))return;
    var rm=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var cards=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-tilt-card'));
    if(!cards.length)return;
    root.setAttribute('data-pc-tl-ready','1');
    if(rm){
      disposers.push(function(){root.removeAttribute('data-pc-tl-ready');});
      return;
    }
    var offs=[];
    cards.forEach(function(card){
      function onMove(e){
        var r=card.getBoundingClientRect();
        if(!r.width||!r.height)return;
        var px=(e.clientX-r.left)/r.width;
        var py=(e.clientY-r.top)/r.height;
        var ry=((px-0.5)*16).toFixed(2)+'deg';
        var rx=((0.5-py)*14).toFixed(2)+'deg';
        card.setAttribute('data-tilting','1');
        card.style.setProperty('--rx',rx);
        card.style.setProperty('--ry',ry);
        card.style.setProperty('--sc','1.02');
        card.style.setProperty('--gx',(px*100).toFixed(1)+'%');
        card.style.setProperty('--gy',(py*100).toFixed(1)+'%');
        card.style.setProperty('--go','1');
      }
      function onLeave(){
        card.removeAttribute('data-tilting');
        card.style.setProperty('--rx','0deg');
        card.style.setProperty('--ry','0deg');
        card.style.setProperty('--sc','1');
        card.style.setProperty('--go','0');
      }
      card.addEventListener('pointermove',onMove);
      card.addEventListener('pointerleave',onLeave);
      offs.push(function(){
        card.removeEventListener('pointermove',onMove);
        card.removeEventListener('pointerleave',onLeave);
        onLeave();
      });
    });
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-tl-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){disposers.forEach(function(d){d();});});
  }
})();
<\/script>
`,en=`.pagecraft-flip{display:grid;grid-template-columns:repeat(var(--fl-cols,3),minmax(0,1fr));gap:var(--fl-gap,18px);width:100%}
.pagecraft-flip-card{position:relative;perspective:1100px;aspect-ratio:var(--fl-ratio,4/5);min-height:280px;min-width:0;cursor:pointer;outline:none}
.pagecraft-flip-card:focus-visible .pagecraft-flip-inner{box-shadow:0 0 0 3px var(--fl-accent,#2563eb)}
.pagecraft-flip-inner{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .64s cubic-bezier(.22,1,.36,1);border-radius:var(--fl-radius,18px)}
.pagecraft-flip-card[data-flipped="1"] .pagecraft-flip-inner{transform:rotateY(180deg)}
.pagecraft-flip[data-flip-trigger="hover"] .pagecraft-flip-card:hover .pagecraft-flip-inner{transform:rotateY(180deg)}
.pagecraft-flip-face{position:absolute;inset:0;border-radius:inherit;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:flex;flex-direction:column}
.pagecraft-flip-front{background:var(--fl-front-bg,#13161d);color:#fff;justify-content:flex-end;border:1px solid rgba(255,255,255,.1)}
.pagecraft-flip-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.pagecraft-flip-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,12,16,.08) 0%,rgba(10,12,16,.34) 48%,rgba(10,12,16,.88) 100%);pointer-events:none}
.pagecraft-flip-front-body{position:relative;z-index:1;padding:22px;display:flex;flex-direction:column;gap:8px}
.pagecraft-flip-tag{display:inline-flex;width:fit-content;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.15);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#fff}
.pagecraft-flip-title{margin:0;font-size:20px;line-height:1.22;font-weight:600;letter-spacing:-.015em;color:#fff}
.pagecraft-flip-hint{margin-top:4px;font-size:12px;font-weight:500;color:rgba(255,255,255,.78);display:inline-flex;align-items:center;gap:5px}
.pagecraft-flip-back{transform:rotateY(180deg);background:var(--fl-back-bg,#ffffff);color:var(--fl-ink,#18181b);border:1px solid var(--fl-line,rgba(0,0,0,.1));padding:24px;justify-content:space-between;box-shadow:0 16px 36px -16px rgba(0,0,0,.14)}
.pagecraft-flip-back-top{display:flex;flex-direction:column;gap:10px}
.pagecraft-flip-back-tag{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fl-accent,#2563eb)}
.pagecraft-flip-back-title{margin:0;font-size:19px;line-height:1.28;font-weight:650;letter-spacing:-.015em;color:var(--fl-ink,#18181b)}
.pagecraft-flip-detail{margin:0;font-size:14px;line-height:1.58;color:var(--fl-muted,#52525b)}
.pagecraft-flip-back-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:12px;border-top:1px solid var(--fl-line,rgba(0,0,0,.08))}
.pagecraft-flip-link{font-size:13.5px;font-weight:600;color:var(--fl-accent,#2563eb);text-decoration:none;display:inline-flex;align-items:center;gap:4px}
.pagecraft-flip-link:hover{text-decoration:underline}
.pagecraft-flip-return{font-size:12px;font-weight:600;color:var(--fl-muted,#71717a)}
@media (max-width:720px){.pagecraft-flip{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.pagecraft-flip-inner{transition:none}}`,tn=`<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-flip[data-flip]').forEach(function(root){
    if(root.hasAttribute('data-pc-fl-ready')||root.hasAttribute('data-flip-edit'))return;
    var cards=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-flip-card'));
    if(!cards.length)return;
    root.setAttribute('data-pc-fl-ready','1');
    var offs=[];
    cards.forEach(function(card){
      function toggle(e){
        if(e&&e.target&&e.target.closest&&e.target.closest('a'))return;
        var on=card.getAttribute('data-flipped')==='1';
        card.setAttribute('data-flipped',on?'0':'1');
        card.setAttribute('aria-pressed',on?'false':'true');
      }
      function onKey(e){
        if(e.key==='Enter'||e.key===' '){
          e.preventDefault();
          toggle(e);
        }
      }
      card.addEventListener('click',toggle);
      card.addEventListener('keydown',onKey);
      offs.push(function(){
        card.removeEventListener('click',toggle);
        card.removeEventListener('keydown',onKey);
        card.setAttribute('data-flipped','0');
        card.setAttribute('aria-pressed','false');
      });
    });
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-fl-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){disposers.forEach(function(d){d();});});
  }
})();
<\/script>
`;var rn=0,yo=()=>(rn++,"n"+Date.now().toString(36).slice(-5)+rn.toString(36)+Math.floor(Math.random()*1296).toString(36)),s=e=>String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");var Nn="pagecraft:wordpress-content:",vo="%%PAGECRAFT_WP_CONTENT:",Ue="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";function fr(e){let t=new TextEncoder().encode(e),r="";for(let a=0;a<t.length;a+=3){let i=t[a],n=a+1<t.length?t[a+1]:0,o=a+2<t.length?t[a+2]:0,c=i<<16|n<<8|o;r+=Ue[c>>18&63]+Ue[c>>12&63]+(a+1<t.length?Ue[c>>6&63]:"")+(a+2<t.length?Ue[c&63]:"")}return r}function xo(e){if(!e||/[^A-Za-z0-9_-]/.test(e))return null;let t=[],r=0,a=0;for(let i of e){let n=Ue.indexOf(i);if(n<0)return null;r=r<<6|n,a+=6,a>=8&&(a-=8,t.push(r>>a&255),r&=(1<<a)-1)}if(a&&r!==0)return null;try{return new TextDecoder("utf-8",{fatal:!0}).decode(new Uint8Array(t))}catch{return null}}function Fn(e){let t=String(e??"").trim();return!t||t.length>2048||/[?#\\\u0000-\u001f\u007f]/.test(t)?null:(t=("/"+t.replace(/^\/+/,"")).replace(/\/{2,}/g,"/"),t!=="/"&&!/\.[^/]+\/?$/.test(t)&&!t.endsWith("/")&&(t+="/"),t)}function wo(e,t){if(e!=="page"&&e!=="post")return"";let r=Fn(t);return r?`${Nn}${e}:${fr(r)}`:""}function Bn(e){let r=String(e??"").trim().match(/^pagecraft:wordpress-content:(page|post):([A-Za-z0-9_-]+)$/);if(!r)return null;let a=xo(r[2]),i=a==null?null:Fn(a);return!i||i!==a||fr(i)!==r[2]?null:{objectType:r[1],path:i}}function ko(e){let t=wo(e.objectType,e.path),r=t?Bn(t):null;return r?`${vo}${r.objectType}:${fr(r.path)}%%`:""}var qn="";function Ne(){return!!qn}var So=e=>{let t=String(e??"").trim();if(!/^https:\/\//i.test(t))return"";try{let r=new URL(t);return r.protocol!=="https:"||!r.hostname||r.username||r.password?"":t}catch{return""}};function Ut(e,t="",r=qn){let a=String(e.action||"").trim(),i=So(a),n=e.method==="get"?"get":"post";return r?a?i?{kind:"external",action:i,method:n,reason:"",note:"Sends entries to the configured external HTTPS destination."}:{kind:"disabled",action:"",method:n,reason:"unsafe",note:"Disabled until the destination is a complete HTTPS URL."}:n==="get"?{kind:"disabled",action:"",method:n,reason:"missing",note:"Add an HTTPS destination for this search, or choose POST to save inquiries in Submissions."}:{kind:"cloud",action:r+"/"+encodeURIComponent(t),method:"post",reason:"",note:"Saves entries to this site\u2019s Submissions inbox when published."}:e.mode==="wordpress"?{kind:"wordpress",action:`%%PAGECRAFT_FORM_ENDPOINT:${t}%%`,method:"post",reason:"",note:"Handled by the connected WordPress site."}:i?{kind:"external",action:i,method:n,reason:"",note:"Sends entries to the configured external HTTPS destination."}:{kind:"disabled",action:"",method:n,reason:a?"unsafe":"missing",note:a?"Disabled until the destination is a complete HTTPS URL.":`${n.toUpperCase()} needs a complete HTTPS destination before publishing.`}}var qe=e=>JSON.parse(JSON.stringify(e)),zn=e=>String(e).toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"page";var Yt="index.html",_n=[["is","is"],["not","is not"],["has","contains"],["set","has any value"],["unset","is empty"]],an=(e,t,r,a)=>({"padding-top":e,"padding-right":t,"padding-bottom":r,"padding-left":a}),gr={"padding-top":"13px","padding-right":"26px","padding-bottom":"13px","padding-left":"26px","border-radius":"8px","background-color":"var(--c-brand)"},$o={solid:{},outline:{"background-color":"transparent","background-image":"none","border-width":"1px","border-style":"solid","border-color":"currentColor"},ghost:{"background-color":"transparent","background-image":"none","border-color":"transparent"},link:{"background-color":"transparent","background-image":"none","border-width":"0","border-color":"transparent","border-radius":"0",padding:"0"}},C={size:["px","rem","em","vw"],len:["px","rem","%","vw","vh","dvh","svh"],space:["px","rem","%"],radius:["px","rem","%"],line:["","px","em","%"],track:["em","px"],border:["px","rem"]},Eo=4,Ao=100,Co=4,Po=10**-Co,we="--pc-column-v-align";function To(e){return[["follow",`Follow row \xB7 ${os(e)}`],["flex-start","Top"],["center","Center"],["flex-end","Bottom"]]}var nn={s:"system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",f:"Georgia,'Times New Roman',serif",d:"system-ui,-apple-system,sans-serif",m:"ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"},Lo={s:"Sans serif",f:"Serif",d:"Display",m:"Monospace"},Y="400;500;600;700",mr=[["Manrope","s",Y],["DM Sans","s",Y],["Inter","s",Y],["Figtree","s",Y],["Plus Jakarta Sans","s",Y],["Work Sans","s",Y],["Outfit","s",Y],["Sora","s",Y],["Space Grotesk","s","400;500;600;700"],["Epilogue","s",Y],["Archivo","s",Y],["Karla","s",Y],["Rubik","s",Y],["Poppins","s","400;500;600;700"],["Montserrat","s",Y],["Raleway","s",Y],["Nunito Sans","s",Y],["Open Sans","s",Y],["Lato","s","400;700"],["Roboto","s","400;500;700"],["Source Sans 3","s",Y],["IBM Plex Sans","s","400;500;600;700"],["Mulish","s",Y],["Public Sans","s",Y],["Playfair Display","f","400;500;600;700"],["Fraunces","f",Y],["Lora","f","400;500;600;700"],["Merriweather","f","400;700"],["Source Serif 4","f",Y],["Crimson Pro","f",Y],["Libre Baskerville","f","400;700"],["EB Garamond","f","400;500;600;700"],["Cormorant Garamond","f","400;500;600;700"],["Spectral","f","400;500;600;700"],["Newsreader","f",Y],["DM Serif Display","f","400"],["Instrument Serif","f","400"],["Bebas Neue","d","400"],["Anton","d","400"],["Oswald","d","400;500;600;700"],["Archivo Black","d","400"],["Syne","d","400;500;600;700;800"],["Chivo","d",Y],["JetBrains Mono","m","400;500;600;700"],["IBM Plex Mono","m","400;500;600;700"],["Space Mono","m","400;700"],["Roboto Mono","m",Y],["Fira Code","m",Y],["DM Mono","m","400;500"]],jn=Object.fromEntries(mr.map(([e,t,r])=>[e.toLowerCase(),{fam:e,cat:t,w:r}])),Mo=(e,t)=>`'${e}',${nn[t]||nn.s}`;function Io(e){return String(e||"").split(",")[0].trim().replace(/^['"]|['"]$/g,"")}function Do(){let e=new Set,t=a=>{let i=jn[Io(a).toLowerCase()];i&&e.add(i.fam)};t(M.meta.font),t(M.meta.headFont);let r=a=>["d","t","m"].forEach(i=>{let n=(a&&a[i]||{})["font-family"];n&&t(n)});return vr().forEach(a=>r(a.css)),At().forEach(a=>r(a.css)),bs().forEach(a=>ie(a,i=>r(i.css))),mr.map(([a])=>a).filter(a=>e.has(a))}function hr(){let e=Do();return e.length?`https://fonts.googleapis.com/css2?${e.map(r=>`family=${r.replace(/ /g,"+")}:wght@${jn[r.toLowerCase()].w}`).join("&")}&display=swap`:""}var Ro=["latin","latin-ext"];function Hn(e,t=Ro){let r=[],a=String(e||"").split(/\/\*\s*([a-z0-9-]+)\s*\*\//i);for(let i=1;i<a.length;i+=2){let n=a[i].toLowerCase();if(t.length&&!t.includes(n))continue;let o=a[i+1]||"";for(let c of o.matchAll(/@font-face\s*\{([^}]*)\}/g)){let f=c[1],m=P=>{let w=f.match(new RegExp(P+"\\s*:\\s*([^;]+)"));return w?w[1].trim():""},d=(f.match(/url\(([^)]+)\)/)||[,""])[1].replace(/['"]/g,""),E=m("font-family").replace(/['"]/g,"");!d||!E||r.push({family:E,weight:m("font-weight")||"400",style:m("font-style")||"normal",subset:n,url:d,range:m("unicode-range")})}}return r}function Vn(e,t){return e.map(r=>`@font-face{font-family:'${r.family}';font-style:${r.style};font-weight:${r.weight};font-display:swap;src:url('${t(r)}') format('woff2')${r.range?`;unicode-range:${r.range}`:""}}`).join(`
`)}function Oo(){let e=hr();return e?`<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${s(e)}">
`:""}var No=[["","Default"],["inherit","Inherit"],["system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif","System sans"],["Georgia,'Times New Roman',serif","System serif"],["ui-monospace,SFMono-Regular,Menlo,Consolas,monospace","System monospace"]];function Gt(){let e=[["Standard",No]];return["s","f","d","m"].forEach(t=>{e.push([Lo[t]+" \u2014 Google Fonts",mr.filter(([,r])=>r===t).map(([r,a])=>[Mo(r,a),r])])}),e}var Fo=[["","Default"],["none","None"],["0 1px 2px rgba(17,19,17,.07)","Hairline"],["0 8px 20px -8px rgba(17,19,17,.18)","Soft"],["0 20px 44px -14px rgba(17,19,17,.28)","Elevated"],["0 34px 70px -22px rgba(17,19,17,.38)","Deep"]];var Bo=[["","Default"],["none","None"],["grayscale(1)","Greyscale"],["saturate(1.25)","Richer"],["contrast(1.1)","More contrast"],["blur(6px)","Blurred"],["brightness(.85)","Darker"]],qo=[["repeat(2, minmax(0, 1fr))","2 across"],["repeat(3, minmax(0, 1fr))","3 across"],["repeat(4, minmax(0, 1fr))","4 across"],["repeat(6, minmax(0, 1fr))","6 across"],["repeat(auto-fit, minmax(240px, 1fr))","As many as fit"],["2fr 1fr","Wide then narrow"],["1fr 2fr","Narrow then wide"]];var Le={section:{label:"Section",icon:"section",level:1,caps:["spacing","decoration","effects","animation"],make:()=>({props:{tag:"section",width:"boxed",inner:"",floating:0},css:{d:{...an("72px","24px","72px","24px")},t:{},m:{...an("48px","20px","48px","20px")}}}),controls:{content:[{t:"pick",k:"width",label:"Content width",opts:[["boxed","Boxed"],["full","Full width"]],text:1},{t:"unit",c:"min-height",label:"Min height",layout:"inline",r:1,units:C.len},{t:"toggle",k:"floating",label:"Float over hero",note:"Overlays this section at the top of the page so a header blends with a full-height hero."},{t:"select",k:"tag",label:"HTML tag",layout:"inline",opts:[["section","section"],["div","div"],["header","header"],["footer","footer"],["main","main"],["article","article"],["aside","aside"]]}],style:[]}},row:{label:"Row",icon:"row",level:2,caps:["spacing","decoration","effects","animation"],make:()=>({props:{},css:{d:{gap:"24px","align-items":"stretch","justify-content":"flex-start"},t:{},m:{gap:"20px"}}}),controls:{content:[{t:"unit",c:"gap",label:"Gap",layout:"inline",r:1,units:C.space},{t:"pick",c:"align-items",label:"Vertical align",r:1,opts:[["flex-start","vTop"],["center","vMid"],["flex-end","vBot"],["baseline","Base"],["stretch","Fill"]]},{t:"select",c:"justify-content",label:"Distribution",r:1,opts:[["flex-start","Start"],["center","Center"],["flex-end","End"],["space-between","Space between"],["space-around","Space around"]]},{t:"select",c:"flex-wrap",label:"Wrap",r:1,opts:[["wrap","Wrap"],["wrap-reverse","Wrap, reversed"],["nowrap","No wrap"]]},{t:"cols",label:"Columns"},{t:"stack",label:"Stack on tablet",when:e=>(e.children||[]).length>1,note:"Puts each column on its own line on tablets, the way they stack on phones."},{t:"order",label:"Order",when:e=>(e.children||[]).length>1,note:"Reversed swaps the columns at this screen size. On a phone, where they stack, the last column comes first."}],style:[]}},slider:{label:"Slider",icon:"slider",level:2,caps:["spacing","decoration","effects","animation"],make:()=>({props:{arrows:1,controlsPosition:"sides",pagination:"dots",aria:"Slides"},css:{d:{"--sl-gap":"24px","--sl-w":"calc((100% - 2 * var(--sl-gap,24px)) / 3)"},t:{"--sl-w":"calc((100% - var(--sl-gap,24px)) / 2)"},m:{"--sl-gap":"16px","--sl-w":"86%"}}}),controls:{content:[{t:"select",c:"--sl-w",label:"Slides in view",r:1,opts:[["100%","One"],["calc((100% - var(--sl-gap,24px)) / 2)","Two"],["calc((100% - 2 * var(--sl-gap,24px)) / 3)","Three"],["calc((100% - 3 * var(--sl-gap,24px)) / 4)","Four"],["86%","One and a peek"],["auto","As wide as their contents"]]},{t:"unit",c:"--sl-gap",label:"Gap",layout:"inline",r:1,units:C.space},{t:"select",k:"controlsPosition",label:"Controls position",opts:[["sides","Beside slides"],["bottom","Centered below"]]},{t:"pick",k:"pagination",label:"Pagination",opts:[["dots","Dots"],["progress","Progress bar"]],text:1},{t:"toggle",k:"arrows",label:"Arrow buttons",note:"Hidden without JavaScript, where swiping and scrolling still work"},{t:"text",k:"aria",label:"Region name",ph:"Slides",note:"What a screen reader calls the scrollable area"}],style:[]}},list:{label:"Collection list",icon:"cms",level:2,caps:["spacing","decoration","effects","animation"],make:()=>({props:{collectionLayout:"grid",sort:"",dir:"asc",where:"",op:"is",limit:""},css:{d:{gap:"24px","align-items":"stretch","flex-wrap":"wrap"},t:{},m:{gap:"20px"}}}),controls:{content:[{t:"source",label:"Collection"},{t:"select",k:"collectionLayout",label:"Layout",opts:[["grid","Grid"],["slider","Slider"]]},{t:"select",k:"sort",label:"Sort by",opts:e=>[["","CMS order"],...(e.src&&ke(e.src)?ke(e.src).fields:[]).map(t=>[t.id,t.name])]},{t:"pick",k:"dir",label:"Direction",opts:[["asc","A\u2013Z"],["desc","Z\u2013A"]]},{t:"select",k:"where",label:"Filter",opts:e=>[["","Every item"],...(e.src&&ke(e.src)?ke(e.src).fields:[]).map(t=>[t.id,t.name])]},{t:"select",k:"op",label:"Test",opts:_n,when:e=>!!e.props.where},{t:"text",k:"val",label:"Value",ph:"e.g. Journal",set:1,when:e=>{let t=e.props;return!!t.where&&t.op!=="set"&&t.op!=="unset"}},{t:"unit",k:"per",label:"Items per page",integer:1,units:[""],ph:"all on one page",note:"Turns this page into one file per page of results."},{t:"unit",k:"limit",label:"Show at most",integer:1,units:[""],ph:"all",note:"Items per page wins where both are set.",when:e=>!(parseInt(String(e.props.per||""),10)>0)},{t:"unit",c:"gap",label:"Gap",layout:"inline",r:1,units:C.space},{t:"pick",c:"align-items",label:"Vertical align",r:1,opts:[["flex-start","vTop"],["center","vMid"],["flex-end","vBot"],["baseline","Base"],["stretch","Fill"]]},{t:"select",c:"flex-wrap",label:"Wrap",r:1,opts:[["wrap","Wrap"],["nowrap","No wrap"]],when:e=>e.props.collectionLayout!=="slider"}],style:[]}},column:{label:"Column",icon:"column",level:3,alsoHolds:["row","slider","box","marquee","filter"],caps:["spacing","decoration","effects","animation"],make:()=>({props:{},css:{d:{"flex-grow":"100",[we]:"follow","align-items":"stretch",gap:"16px"},t:{},m:{"flex-basis":"100%"}}}),controls:{content:[{t:"slider",c:"flex-grow",label:"Width (share)",r:1,min:Eo,max:Ao,step:Po,raw:1,when:on},{t:"unit",c:"flex-basis",label:"Min basis",layout:"inline",r:1,units:["%","px","rem"],note:"Set 100% to force a full-width stack.",when:on},{t:"select",c:we,label:"Vertical align",r:1,opts:To,note:"Follows the parent row unless this column overrides it."},{t:"pick",c:"align-items",label:"Horizontal align",r:1,opts:[["flex-start","alignL"],["center","alignC"],["flex-end","alignR"],["stretch","Fill"]]},{t:"unit",c:"gap",label:"Gap",layout:"inline",r:1,units:C.space}],style:[]}},box:{label:"Box",icon:"box",level:2,takes:4,alsoHolds:["box","row","slider","column","marquee","filter"],caps:["spacing","decoration","effects","animation"],make:()=>({props:{layout:"block",tag:"div",link:"",target:""},css:{d:{},t:{},m:{}}}),controls:{content:[{t:"select",k:"layout",label:"Layout",opts:[["block","Stacked"],["flex","Flex"],["grid","Grid"]]},{t:"pick",c:"flex-direction",label:"Direction",r:1,when:e=>e.props.layout==="flex",opts:[["row","Row"],["column","Column"]]},{t:"unit",c:"gap",label:"Gap",layout:"inline",r:1,units:C.space,when:e=>e.props.layout!=="block"},{t:"select",c:"justify-content",label:"Distribute",r:1,when:e=>e.props.layout!=="block",opts:[["","Default"],["flex-start","Start"],["center","Center"],["flex-end","End"],["space-between","Space between"],["space-around","Space around"]]},{t:"pick",c:"align-items",label:"Align",r:1,when:e=>e.props.layout!=="block",opts:[["flex-start","vTop"],["center","vMid"],["flex-end","vBot"],["stretch","Fill"]]},{t:"select",c:"flex-wrap",label:"Wrap",r:1,when:e=>e.props.layout==="flex",opts:[["","Default"],["wrap","Wrap"],["nowrap","No wrap"]]},{t:"select",c:"grid-template-columns",label:"Columns",r:1,when:e=>e.props.layout==="grid",opts:qo},{t:"select",k:"tag",label:"HTML tag",layout:"inline",when:e=>!String(e.props.link||"").trim(),opts:[["div","div"],["article","article"],["aside","aside"],["nav","nav"],["header","header"],["footer","footer"],["main","main"],["section","section"],["ul","ul"],["ol","ol"],["li","li"]]},{t:"link",k:"link",label:"Link",note:"A whole box that is one link."},{t:"text",k:"tags",label:"Filter tags",ph:"Investigation, Science",when:Ko}],style:[]}},heading:{label:"Heading",icon:"heading",level:4,edit:"text",styleLabel:"Typography & fill",caps:["spacing","effects","typography","animation"],make:()=>({props:{text:"A headline that carries weight",level:"h2",link:"",target:"",ts:"title"},css:{d:{"text-align":"left","margin-bottom":"0px"},t:{},m:{}}}),controls:{content:[{t:"area",k:"text",label:"Heading text",rows:2,mono:0},{t:"tstyle",k:"ts",label:"Text style"},{t:"select",k:"level",label:"HTML tag",layout:"inline",opts:[["h1","H1"],["h2","H2"],["h3","H3"],["h4","H4"],["h5","H5"],["h6","H6"],["p","p"],["div","div"]]},{t:"pick",c:"text-align",label:"Alignment",r:1,opts:[["left","alignL"],["center","alignC"],["right","alignR"]]},{t:"link",k:"link",label:"Link"}],style:[{t:"unit",c:"font-size",label:"Size",layout:"inline",r:1,units:C.size},{t:"color",c:"color",label:"Colour",layout:"inline",r:1},{t:"select",c:"font-weight",label:"Weight",layout:"inline",r:1,opts:[["","Default"],["300","Light 300"],["400","Regular 400"],["500","Medium 500"],["600","Semibold 600"],["700","Bold 700"],["800","Extrabold 800"],["900","Black 900"]]},{t:"unit",c:"line-height",label:"Line height",layout:"inline",r:1,units:C.line},{t:"unit",c:"letter-spacing",label:"Letter spacing",r:1,neg:1,units:C.track},{t:"opt",c:"font-family",label:"Font",r:1,og:Gt,ph:"'Family',sans-serif"},{t:"select",c:"text-transform",label:"Transform",r:1,opts:[["","Default"],["none","None"],["uppercase","UPPERCASE"],["lowercase","lowercase"],["capitalize","Capitalize"]]}]}},text:{label:"Rich text",icon:"text",level:4,edit:"rich",styleLabel:"Typography & fill",caps:["spacing","effects","typography","animation"],make:()=>({props:{html:"<p>Double-click to edit this block. A floating toolbar gives you <strong>bold</strong>, <em>italic</em>, links, lists and headings \u2014 everything exports as clean semantic HTML.</p>",ts:"body"},css:{d:{"text-align":"left"},t:{},m:{}}}),controls:{content:[{t:"rich",k:"html",label:"Rich text"},{t:"tstyle",k:"ts",label:"Text style"},{t:"pick",c:"text-align",label:"Alignment",r:1,opts:[["left","alignL"],["center","alignC"],["right","alignR"],["justify","alignJ"]]}],style:[{t:"unit",c:"font-size",label:"Size",layout:"inline",r:1,units:C.size},{t:"color",c:"color",label:"Colour",r:1,layout:"inline"},{t:"unit",c:"line-height",label:"Line height",layout:"inline",r:1,units:C.line},{t:"opt",c:"font-family",label:"Font",r:1,og:Gt,ph:"'Family',sans-serif"},{t:"color",c:"--link",label:"Link colour",r:1}]}},quote:{label:"Quote",icon:"quote",level:4,edit:"text",styleLabel:"Typography & fill",caps:["spacing","decoration","effects","typography","animation"],make:()=>({props:{text:"A sentence in their words that a prospect would recognise as their own problem, solved.",by:"Name, Role at Company",source:"",ts:"lead"},css:{d:{"font-size":"24px","line-height":"1.45",color:x("ink"),"max-width":"34ch","align-self":"flex-start"},t:{},m:{"font-size":"20px"}}}),controls:{content:[{t:"area",k:"text",label:"Quotation",rows:3,mono:0,note:"No quotation marks \u2014 the style draws them."},{t:"text",k:"by",label:"Attribution",ph:"Name, Role at Company",note:"Empty exports a bare blockquote; named adds a caption."},{t:"text",k:"source",label:"Source URL",ph:"https://\u2026",note:"Links the attribution, and records the source."},{t:"tstyle",k:"ts",label:"Text style"},{t:"pick",c:"align-self",label:"Alignment",r:1,when:ft,opts:[["flex-start","alignL"],["center","alignC"],["flex-end","alignR"]]}],style:[{t:"unit",c:"font-size",label:"Size",layout:"inline",r:1,units:C.size},{t:"color",c:"color",label:"Colour",r:1,layout:"inline"},{t:"unit",c:"line-height",label:"Line height",layout:"inline",r:1,units:C.line},{t:"opt",c:"font-family",label:"Font",r:1,og:Gt,ph:"'Family',sans-serif"},{t:"unit",c:"max-width",label:"Measure",layout:"inline",r:1,units:["ch","px","rem","%"],note:"How wide the lines may run. 34ch reads well."},{t:"pick",c:"text-align",label:"Text alignment",r:1,opts:[["left","alignL"],["center","alignC"],["right","alignR"]]},{t:"color",c:"border-left-color",label:"Rule colour",r:1,layout:"inline"},{t:"unit",c:"border-left-width",label:"Rule width",layout:"inline",r:1,units:C.border},{t:"box",c:"padding",label:"Padding",r:1}]}},image:{label:"Image",icon:"image",level:4,caps:["spacing","effects","animation"],make:()=>({props:{src:"",alt:"",link:"",target:"",caption:"",label:"",lazy:1,w:"",h:"",decorative:0},css:{d:{width:"100%","max-width":"100%","border-radius":"10px","object-fit":"cover","align-self":"flex-start"},t:{},m:{}}}),controls:{content:[{t:"img",k:"src",label:"Image source"},{t:"text",k:"alt",label:"Alt text",ph:"Describe the image"},{t:"toggle",k:"decorative",label:"Decorative image",note:"Screen readers skip decorative images."},{t:"text",k:"label",label:"Link label",ph:"What the link opens",note:"Names the link while the decorative image stays hidden from screen readers.",when:e=>(!!e.props.decorative||!!e.bind?.decorative)&&(!!String(e.props.link||"").trim()||!!e.bind?.link)},{t:"dims",label:"Intrinsic size",note:"Stops the page shifting as it loads."},{t:"text",k:"caption",label:"Caption",ph:"Optional"},{t:"link",k:"link",label:"Link"},{t:"pick",c:"align-self",label:"Alignment",r:1,when:ft,opts:[["flex-start","alignL"],["center","alignC"],["flex-end","alignR"],["stretch","Fill"]]},{t:"toggle",k:"lazy",label:"Lazy load"}],style:[{t:"unit",c:"width",label:"Width",layout:"inline",r:1,units:C.len},{t:"unit",c:"height",label:"Height",layout:"inline",r:1,units:C.len},{t:"select",c:"object-fit",label:"Fit",r:1,opts:[["cover","Cover"],["contain","Contain"],["fill","Fill"],["none","None"]]},{t:"focal",c:"object-position",label:"Focal point",r:1,when:Go},{t:"unit",c:"border-radius",label:"Radius",layout:"inline",r:1,units:C.radius},{t:"slider",c:"opacity",label:"Opacity",r:1,min:0,max:1,step:.01,raw:1},{t:"opt",c:"filter",label:"Filter",r:1,opts:Bo,ph:"grayscale(1) blur(2px)"}]}},video:{label:"Video",icon:"video",level:4,caps:["spacing","effects","animation"],make:()=>({props:{src:"https://www.youtube.com/watch?v=aqz-KE-bpKQ",ratio:"16 / 9",autoplay:0,loop:0,muted:1,controls:1,poster:"",facade:1,lightbox:0},css:{d:{width:"100%","border-radius":"10px",overflow:"hidden"},t:{},m:{}}}),controls:{content:[{t:"text",k:"src",label:"Video URL",ph:"YouTube, Vimeo or .mp4"},{t:"select",k:"ratio",label:"Aspect ratio",opts:[["16 / 9","16:9"],["4 / 3","4:3"],["1 / 1","1:1"],["21 / 9","21:9"],["9 / 16","9:16 vertical"]]},{t:"img",k:"poster",label:"Poster image"},{t:"toggle",k:"facade",label:"Load player on click",when:e=>!e.props.autoplay&&["youtube","vimeo"].includes(ze(e.props).kind)},{t:"toggle",k:"lightbox",label:"Open in lightbox"},{t:"toggle",k:"controls",label:"Show controls"},{t:"toggle",k:"autoplay",label:"Autoplay",note:"Autoplay videos play without sound."},{t:"toggle",k:"muted",label:"Muted",when:e=>!e.props.autoplay},{t:"toggle",k:"loop",label:"Loop"}],style:[{t:"unit",c:"width",label:"Width",layout:"inline",r:1,units:C.len},{t:"unit",c:"border-radius",label:"Radius",layout:"inline",r:1,units:C.radius}]}},button:{label:"Button",icon:"button",level:4,edit:"text",caps:["spacing","decoration","effects","typography","animation"],make:()=>({props:{text:"Get started",link:"",target:"",variant:"solid",icon:"none",align:"flex-start",wrap:"inline-flex",ts:"btn"},css:{d:{"--pc-solid-fg":mt(),"align-self":"flex-start",...gr},t:{},m:{}}}),controls:{content:[{t:"text",k:"text",label:"Label"},{t:"tstyle",k:"ts",label:"Text style"},{t:"link",k:"link",label:"Link"},{t:"select",k:"variant",label:"Variant",opts:[["solid","Solid"],["outline","Outline"],["ghost","Ghost"],["link","Text link"]]},{t:"select",k:"icon",label:"Trailing icon",opts:[["none","None"],["arrow","Arrow"],["check","Check"],["plus","Plus"]]},{t:"pick",c:"align-self",label:"Alignment",r:1,when:ft,opts:[["flex-start","alignL"],["center","alignC"],["flex-end","alignR"],["stretch","Fill"]]},{t:"select",c:"margin-top",label:"Position",r:1,opts:[["","Default"],["0","In the normal flow"],["auto","Push to column bottom"]],note:"Uses the column\u2019s remaining height above this button.",when:e=>!!ne(e.id)?.parent&&ne(e.id).parent.type==="column"}],style:[{t:"color",c:"background-color",label:"Background",r:1},{t:"color",c:"color",label:"Text colour",r:1,layout:"inline"},{t:"unit",c:"font-size",label:"Size",layout:"inline",r:1,units:C.space},{t:"select",c:"font-weight",label:"Weight",r:1,layout:"inline",opts:[["","Default"],["400","400"],["500","500"],["600","600"],["700","700"]]},{t:"unit",c:"border-radius",label:"Radius",layout:"inline",r:1,units:C.radius},{t:"unit",c:"letter-spacing",label:"Letter spacing",r:1,neg:1,units:C.track},{t:"select",c:"text-transform",label:"Transform",r:1,opts:[["","Default"],["none","None"],["uppercase","UPPERCASE"]]}]}},nav:{label:"Nav menu",icon:"nav",level:4,caps:["spacing","decoration","effects","typography","animation"],make:()=>({props:{items:[{label:"Work",href:Yt},{label:"About",href:Yt},{label:"Contact",href:Yt}],collapse:"mobile",mobileMenu:"dropdown",aria:"Main"},css:{d:{"font-size":"15px","font-weight":"500",color:x("muted"),"align-self":"center","justify-content":"flex-end",width:"100%","--nav-hover":x("ink"),"--nav-gap":"26px","--nav-panel":x("bg")},t:{},m:{}}}),controls:{content:[{t:"items",k:"items",label:"Menu links"},{t:"select",k:"collapse",label:"Collapse at",opts:[["mobile","On mobile (\u2264767px)"],["tablet","On tablet and below (\u22641024px)"],["never","Never \u2014 always inline"]]},{t:"select",k:"mobileMenu",label:"Mobile menu",opts:[["dropdown","Full-width dropdown"],["fullscreen","Fullscreen"]]},{t:"pick",c:"justify-content",label:"Alignment",r:1,opts:[["flex-start","alignL"],["center","alignC"],["flex-end","alignR"]]},{t:"text",k:"aria",label:"Accessible name",ph:"Main",note:"Read by screen readers as \u201C<name> menu\u201D."}],style:[{t:"unit",c:"--nav-gap",label:"Link spacing",r:1,units:C.space},{t:"unit",c:"font-size",label:"Size",layout:"inline",r:1,units:C.space},{t:"select",c:"font-weight",label:"Weight",r:1,layout:"inline",opts:[["400","400"],["500","500"],["600","600"],["700","700"]]},{t:"color",c:"color",label:"Link colour",r:1},{t:"color",c:"--nav-hover",label:"Hover colour",r:1},{t:"color",c:"--nav-panel",label:"Menu background",r:1,when:e=>!e.props.managedMobileLinks},{t:"unit",c:"letter-spacing",label:"Letter spacing",r:1,neg:1,units:C.track},{t:"select",c:"text-transform",label:"Transform",r:1,opts:[["","Default"],["none","None"],["uppercase","UPPERCASE"]]}]}},form:{label:"Form",icon:"form",level:4,caps:["spacing","decoration","effects","typography","animation"],make:()=>({props:{mode:"external",action:"",method:"post",submit:"Send",aria:"Contact form",fields:[{type:"text",label:"Name",name:"name",required:1,ph:""},{type:"email",label:"Email",name:"email",required:1,ph:""},{type:"textarea",label:"Message",name:"message",required:0,ph:""}]},css:{d:{width:"100%","--f-gap":"16px","--f-radius":"8px","--f-pad":"11px 13px","--f-bg":x("surface"),"--f-border":x("line"),"--f-text":x("text"),"--f-label":x("muted"),"--f-btn-bg":x("brand"),"--f-btn-fg":mt(),"font-size":"15px"},t:{},m:{}}}),controls:{content:[{t:"fields",k:"fields",label:"Fields"},{t:"text",k:"submit",label:"Submit button label"},{t:"select",k:"mode",label:"Handling",opts:[["external","External HTTPS endpoint"],["wordpress","WordPress managed"]]},{t:"text",k:"action",label:"Where submissions go",ph:"Paste an HTTPS destination",note:"Paste your service\u2019s complete HTTPS URL. On Cloud, a blank POST form saves to Submissions.",when:e=>Ne()||e.props.mode!=="wordpress"},{t:"select",k:"method",label:"Method",layout:"inline",opts:[["post","POST"],["get","GET"]],when:e=>Ne()||e.props.mode!=="wordpress"},{t:"text",k:"aria",label:"Accessible name",ph:"Contact form"}],style:[{t:"select",c:"--f-layout",label:"Field layout",r:1,opts:[["flex","Wrapped fields"],["grid","Grid"]]},{t:"select",c:"--f-columns",label:"Grid columns",r:1,when:e=>vt(e,Yn(),"--f-layout")==="grid",opts:[["1fr","One"],["repeat(2,minmax(0,1fr))","Two"],["repeat(3,minmax(0,1fr))","Three"],["repeat(4,minmax(0,1fr))","Four"]]},{t:"select",c:"--f-button-align",label:"Alignment",r:1,opts:[["flex-start","Top"],["end","Bottom"]]},{t:"unit",c:"--f-gap",label:"Field spacing",r:1,units:C.space},{t:"unit",c:"font-size",label:"Size",layout:"inline",r:1,units:C.size},{t:"color",c:"--f-bg",label:"Field background",r:1},{t:"color",c:"--f-border",label:"Field border",r:1},{t:"color",c:"--f-text",label:"Field text",r:1},{t:"color",c:"--f-label",label:"Label colour",r:1},{t:"unit",c:"--f-radius",label:"Field radius",r:1,units:C.radius},{t:"color",c:"--f-btn-bg",label:"Button background",r:1},{t:"color",c:"--f-btn-fg",label:"Button text",r:1}]}},spacer:{label:"Spacer",icon:"spacer",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{},css:{d:{height:"48px"},t:{},m:{height:"32px"}}}),controls:{content:[{t:"unit",c:"height",label:"Height",layout:"inline",r:1,units:C.len}],style:[]}},divider:{label:"Divider",icon:"divider",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{},css:{d:{"border-top-width":"1px","border-top-style":"solid","border-top-color":x("line"),width:"100%","margin-top":"20px","margin-bottom":"20px"},t:{},m:{}}}),controls:{content:[{t:"unit",c:"border-top-width",label:"Thickness",layout:"inline",r:1,units:C.border},{t:"select",c:"border-top-style",label:"Style",r:1,opts:[["solid","Solid"],["dashed","Dashed"],["dotted","Dotted"]]},{t:"color",c:"border-top-color",label:"Colour",r:1,layout:"inline"},{t:"unit",c:"width",label:"Width",layout:"inline",r:1,units:C.len}],style:[]}},crumbs:{label:"Breadcrumb",icon:"crumbs",level:4,caps:["spacing","effects","typography","animation"],make:()=>({props:{mode:"auto",home:"Home",sep:"chevron"},css:{d:{"--cb-size":"13px","--cb-color":x("muted"),"--cb-current":x("text"),"--cb-gap":"8px","--cb-weight":"500"},t:{},m:{}}}),controls:{content:[{t:"pick",k:"mode",label:"Trail",set:1,r:0,opts:[["auto","From the page"],["manual","Written here"]]},{t:"text",k:"home",label:"Front page is called",ph:"Home",when:e=>e.props.mode!=="manual"},{t:"items",k:"items",label:"Crumbs",when:e=>e.props.mode==="manual"},{t:"select",k:"sep",label:"Separator",set:1,opts:[["chevron","\u203A"],["slash","/"],["dot","\xB7"],["dash","\u2014"]]}],style:[{t:"unit",c:"--cb-size",label:"Text size",layout:"inline",r:1,units:C.size},{t:"color",c:"--cb-color",label:"Link colour",r:1},{t:"color",c:"--cb-current",label:"Current page colour",r:1},{t:"unit",c:"--cb-gap",label:"Spacing",layout:"inline",r:1,units:C.space}]}},code:{label:"Code",icon:"codeblock",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{body:`const site = build({
  pages: 12,
  scripts: 0   // nothing to run
});`,lang:"js",numbers:0,softwrap:0,copy:1},css:{d:{width:"100%","--cd-bg":x("bg"),"--cd-text":x("text"),"--cd-size":"14px","--cd-pad":"16px 18px","--cd-radius":"10px","--cd-line":x("line"),"--cd-com":x("muted"),"--cd-str":"#2f6f5e","--cd-kw":"#8a4b2a","--cd-num":"#3a5a9a","--cd-key":"#5b4a8a"},t:{},m:{"--cd-size":"13px","--cd-pad":"12px 13px"}}}),controls:{content:[{t:"area",k:"body",label:"Code",rows:9,mono:1,ph:"const x = 1;"},{t:"select",k:"lang",label:"Language",set:1,opts:()=>Object.keys(yt).map(e=>[e,yt[e].label])},{t:"text",k:"title",label:"File name",ph:"index.js"},{t:"toggle",k:"numbers",label:"Number the lines"},{t:"toggle",k:"softwrap",label:"Wrap long lines"},{t:"toggle",k:"copy",label:"Copy button",note:"Hidden unless the browser can copy, so it is never a button that does nothing"}],style:[{t:"color",c:"--cd-bg",label:"Background",r:1},{t:"color",c:"--cd-text",label:"Text colour",r:1,layout:"inline"},{t:"unit",c:"--cd-size",label:"Text size",layout:"inline",r:1,units:C.size},{t:"lengthList",c:"--cd-pad",label:"Padding",r:1,units:C.space},{t:"unit",c:"--cd-radius",label:"Radius",layout:"inline",r:1,units:C.radius},{t:"color",c:"--cd-com",label:"Comments",r:1,layout:"inline",when:e=>e.props.lang!=="text"},{t:"color",c:"--cd-str",label:"Strings",r:1,layout:"inline",when:e=>e.props.lang!=="text"},{t:"color",c:"--cd-kw",label:"Keywords",r:1,layout:"inline",when:e=>e.props.lang!=="text"},{t:"color",c:"--cd-num",label:"Numbers",r:1,layout:"inline",when:e=>e.props.lang!=="text"},{t:"color",c:"--cd-key",label:"Names",r:1,layout:"inline",when:e=>e.props.lang!=="text"}]}},table:{label:"Table",icon:"table",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{body:`Plan|Monthly|Seats
Starter|\xA39|1
Studio|\xA329|5
House|\xA379|20`,head:1,rules:"rows",zebra:0},css:{d:{width:"100%","--tbl-size":"15px","--tbl-pad":"10px 12px","--tbl-line":x("line"),"--tbl-text":x("text"),"--tbl-head-bg":"transparent","--tbl-head-text":x("ink"),"--tbl-head-weight":"600","--tbl-zebra":x("bg"),"--tbl-caption-size":"13px","--tbl-caption-color":x("muted")},t:{},m:{"--tbl-size":"14px","--tbl-pad":"8px 10px"}}}),controls:{content:[{t:"area",k:"body",label:"Rows",rows:7,mono:1,ph:`Plan|Monthly|Seats
Starter|\xA39|1`,note:"One row per line. Paste from a spreadsheet, or separate cells with |"},{t:"text",k:"caption",label:"Caption",ph:"What this table shows"},{t:"toggle",k:"head",label:"First row is a heading"},{t:"toggle",k:"rowhead",label:"First column is a heading"},{t:"select",k:"rules",label:"Lines",set:1,opts:[["rows","Between rows"],["all","Full grid"],["none","None"]]},{t:"toggle",k:"zebra",label:"Shade alternate rows"}],style:[{t:"unit",c:"--tbl-size",label:"Text size",layout:"inline",r:1,units:C.size},{t:"color",c:"--tbl-text",label:"Text colour",r:1,layout:"inline"},{t:"lengthList",c:"--tbl-pad",label:"Cell padding",r:1,units:C.space},{t:"color",c:"--tbl-line",label:"Line colour",r:1,layout:"inline"},{t:"color",c:"--tbl-head-bg",label:"Header background",r:1,when:e=>!!(e.props.head||e.props.rowhead)},{t:"color",c:"--tbl-head-text",label:"Heading colour",r:1,when:e=>!!(e.props.head||e.props.rowhead)},{t:"color",c:"--tbl-zebra",label:"Shading",r:1,layout:"inline",when:e=>!!e.props.zebra},{t:"color",c:"--tbl-caption-color",label:"Caption colour",r:1,when:e=>!!String(e.props.caption||"").trim()}]}},tabs:{label:"Tabs",icon:"tabs",level:4,takes:4,alsoHolds:["box"],caps:["spacing","decoration","effects","animation"],make:()=>({props:{items:[{label:"Overview",panel:"What this is, in a sentence or two."},{label:"Details",panel:"The part someone came looking for."},{label:"Pricing",panel:"The number, plainly."}]},css:{d:{width:"100%","--tb-align":"flex-start","--tb-line":x("line"),"--tb-on":x("ink"),"--tb-off":x("muted"),"--tb-size":"15px","--tb-weight":"500","--tb-pad":"10px 2px","--tb-gap":"22px","--tb-body-size":"16px","--tb-body-color":x("text"),"--tb-body-pad":"20px"},t:{},m:{"--tb-gap":"16px","--tb-size":"14px"}}}),controls:{content:[{t:"qa",k:"items",label:"Tabs",rowKeys:["label","panel"],rowPhs:["Tab label","What this tab says"],rowNew:["New tab",""],addLabel:"Add tab"},{t:"pick",c:"--tb-align",label:"Tabs sit",r:1,opts:[["flex-start","alignL"],["center","alignC"],["flex-end","alignR"]]}],style:[{t:"color",c:"--tb-on",label:"Selected label",r:1},{t:"color",c:"--tb-off",label:"Other labels",r:1},{t:"color",c:"--tb-line",label:"Rule",r:1},{t:"unit",c:"--tb-size",label:"Label size",layout:"inline",r:1,units:C.size},{t:"unit",c:"--tb-gap",label:"Label spacing",r:1,units:C.space},{t:"unit",c:"--tb-body-size",label:"Body size",layout:"inline",r:1,units:C.size},{t:"color",c:"--tb-body-color",label:"Body colour",r:1,layout:"inline"},{t:"unit",c:"--tb-body-pad",label:"Body padding",r:1,units:C.space}]}},accordion:{label:"Accordion",icon:"accordion",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{items:[{q:"What do I get?",a:"One paragraph that answers the question plainly."},{q:"How long does it take?",a:"Say the real number. A range is fine; a dodge is not."},{q:"What does it cost?",a:"The answer people scrolled this far to find."}],open:"first",single:0,marker:"plus"},css:{d:{width:"100%","--ac-line":x("line"),"--ac-pad":"18px","--ac-gap":"0px","--ac-q-size":"17px","--ac-q-weight":"600","--ac-q-color":x("ink"),"--ac-a-size":"16px","--ac-a-color":x("muted"),"--ac-mark":x("slate"),"--ac-radius":"0px"},t:{},m:{"--ac-pad":"15px","--ac-q-size":"16px"}}}),controls:{content:[{t:"qa",k:"items",label:"Questions",rowNew:["A new question",""]},{t:"select",k:"open",label:"Open on load",opts:[["none","All closed"],["first","The first one"],["all","All open"]]},{t:"toggle",k:"single",label:"One open at a time"},{t:"select",k:"marker",label:"Marker",opts:[["plus","Plus / minus"],["caret","Caret"],["none","None"]]}],style:[{t:"color",c:"--ac-line",label:"Divider colour",r:1},{t:"unit",c:"--ac-pad",label:"Row padding",r:1,units:C.space},{t:"unit",c:"--ac-gap",label:"Row gap",layout:"inline",r:1,units:C.space},{t:"unit",c:"--ac-q-size",label:"Question size",r:1,units:C.size},{t:"select",c:"--ac-q-weight",label:"Question weight",r:1,opts:[["400","400"],["500","500"],["600","600"],["700","700"]]},{t:"color",c:"--ac-q-color",label:"Question colour",r:1},{t:"unit",c:"--ac-a-size",label:"Answer size",layout:"inline",r:1,units:C.size},{t:"color",c:"--ac-a-color",label:"Answer colour",r:1},{t:"color",c:"--ac-mark",label:"Marker colour",r:1},{t:"unit",c:"--ac-radius",label:"Row radius",layout:"inline",r:1,units:C.radius}]}},embed:{label:"Embed",icon:"code",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{html:"",ratio:""},css:{d:{width:"100%"},t:{},m:{}}}),controls:{content:[{t:"area",k:"html",label:"HTML",rows:8,mono:1,ph:'<iframe src="\u2026" \u2026></iframe>',note:"Runs on the exported site, not in this canvas."},{t:"select",k:"ratio",label:"Aspect ratio",opts:[["","Auto"],["16 / 9","16:9"],["4 / 3","4:3"],["1 / 1","1:1"],["21 / 9","21:9"],["9 / 16","9:16 vertical"]],note:"Pick one for an iframe with no height of its own."}],style:[]}},icon:{label:"Icon",icon:"icon",level:4,caps:["spacing","effects","animation"],make:()=>({props:{name:"check",label:"",link:"",target:""},css:{d:{"--icon-size":"30px","--icon-stroke":"1.75",color:x("ink"),"align-self":"flex-start"},t:{},m:{}}}),controls:{content:[{t:"icon",k:"name",label:"Icon"},{t:"text",k:"label",label:"Accessible label",ph:"Leave empty if decorative",note:"Empty is hidden from screen readers."},{t:"link",k:"link",label:"Link"},{t:"pick",c:"align-self",label:"Alignment",r:1,when:ft,opts:[["flex-start","alignL"],["center","alignC"],["flex-end","alignR"]]}],style:[{t:"unit",c:"--icon-size",label:"Glyph size",layout:"inline",r:1,units:C.size},{t:"color",c:"color",label:"Colour",r:1,layout:"inline"},{t:"slider",c:"--icon-stroke",label:"Stroke weight",r:1,min:1,max:3,step:.05,raw:1},{t:"color",c:"background-color",label:"Badge background",r:1},{t:"box",c:"padding",label:"Badge padding",r:1},{t:"unit",c:"border-radius",label:"Badge radius",r:1,units:C.radius}]}},gallery:{label:"Gallery",icon:"gallery",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{items:[],galleryLayout:"grid",ratio:"4 / 3",fit:"cover",lightbox:1,lazy:1,captions:0},css:{d:{width:"100%","--g-cols":"3","--g-gap":"12px","--g-radius":"10px"},t:{},m:{"--g-cols":"2","--g-gap":"8px"}}}),controls:{content:[{t:"imgs",k:"items",label:"Images"},{t:"pick",k:"galleryLayout",label:"Layout",opts:[["grid","Grid"],["masonry","Masonry"]],text:1},{t:"unit",c:"--g-cols",label:"Columns",r:1,min:1,integer:1,units:[""],note:"Responsive \u2014 set fewer on Tablet and Mobile."},{t:"select",k:"ratio",label:"Tile shape",opts:[["4 / 3","4:3"],["1 / 1","Square"],["3 / 2","3:2"],["16 / 9","16:9"],["3 / 4","3:4 portrait"],["","Whatever each image is"]]},{t:"select",k:"fit",label:"Fit",opts:[["cover","Cover \u2014 fill and crop"],["contain","Contain \u2014 fit inside"]]},{t:"toggle",k:"lightbox",label:"Open full size on click"},{t:"toggle",k:"captions",label:"Show captions under each tile"},{t:"toggle",k:"lazy",label:"Lazy load"}],style:[{t:"unit",c:"--g-gap",label:"Gap",layout:"inline",r:1,units:C.space},{t:"unit",c:"--g-radius",label:"Tile radius",layout:"inline",r:1,units:C.radius}]}},audio:{label:"Audio",icon:"audio",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{src:"",title:"Episode 01",subtitle:"Field recording \xB7 18 min",artwork:"",controls:1,autoplay:0,loop:0},css:{d:{width:"100%","--au-bg":x("surface"),"--au-text":x("ink"),"--au-muted":x("muted"),"--au-accent":x("ink"),"--au-accent-ink":x("surface"),"--au-line":x("line"),"--au-radius":"12px"},t:{},m:{}}}),controls:{content:[{t:"text",k:"src",label:"Audio URL",ph:"https://.../episode.mp3 or asset:..."},{t:"text",k:"title",label:"Track title",ph:"Episode title"},{t:"text",k:"subtitle",label:"Subtitle",ph:"Show, artist or duration"},{t:"img",k:"artwork",label:"Artwork"},{t:"toggle",k:"controls",label:"Show full player bar"},{t:"toggle",k:"loop",label:"Loop"},{t:"toggle",k:"autoplay",label:"Autoplay"}],style:[{t:"color",c:"--au-bg",label:"Background",r:1},{t:"color",c:"--au-text",label:"Text colour",r:1,layout:"inline"},{t:"color",c:"--au-accent",label:"Button fill",r:1,layout:"inline"},{t:"color",c:"--au-accent-ink",label:"Button icon",r:1,layout:"inline"},{t:"unit",c:"--au-radius",label:"Radius",layout:"inline",r:1,units:C.radius}]}},countdown:{label:"Countdown",icon:"countdown",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{target:"2027-09-18T16:00:00Z",done:"Event started",showSeconds:1,display:"cards",lblDays:"Days",lblHours:"Hours",lblMins:"Mins",lblSecs:"Secs"},css:{d:{width:"100%","--cd2-card":x("surface"),"--cd2-text":x("ink"),"--cd2-num":x("ink"),"--cd2-muted":x("muted"),"--cd2-line":x("line"),"--cd2-radius":"10px","--cd2-gap":"12px"},t:{},m:{"--cd2-gap":"8px"}}}),controls:{content:[{t:"text",k:"target",label:"Target ISO date",ph:"2027-09-18T16:00:00Z",note:"ISO 8601 date and time, for example 2027-09-18T16:00:00Z."},{t:"text",k:"done",label:"Completed message",ph:"Event started"},{t:"select",k:"display",label:"Layout",opts:[["cards","Metric cards"],["inline","Inline strip"]]},{t:"toggle",k:"showSeconds",label:"Show seconds"},{t:"text",k:"lblDays",label:"Days label",ph:"Days"},{t:"text",k:"lblHours",label:"Hours label",ph:"Hours"},{t:"text",k:"lblMins",label:"Minutes label",ph:"Mins"},{t:"text",k:"lblSecs",label:"Seconds label",ph:"Secs",when:e=>e.props.showSeconds!==0}],style:[{t:"color",c:"--cd2-card",label:"Card background",r:1},{t:"color",c:"--cd2-num",label:"Number colour",r:1,layout:"inline"},{t:"color",c:"--cd2-muted",label:"Label colour",r:1,layout:"inline"},{t:"unit",c:"--cd2-num-size",label:"Number size",layout:"inline",r:1,units:C.size},{t:"unit",c:"--cd2-gap",label:"Gap",layout:"inline",r:1,units:C.space},{t:"unit",c:"--cd2-radius",label:"Card radius",layout:"inline",r:1,units:C.radius}]}},marquee:{label:"Marquee",icon:"marquee",level:2,takes:4,alsoHolds:["box","row","slider","column"],caps:["spacing","decoration","effects","animation"],make:()=>({props:{dir:"left",speed:"28s",gap:"32px",pause:1,fade:1},css:{d:{width:"100%"},t:{},m:{}}}),controls:{content:[{t:"pick",k:"dir",label:"Direction",opts:[["left","Left"],["right","Right"]],text:1},{t:"text",k:"speed",label:"Cycle duration",ph:"28s",note:"Time for one full loop, for example 28s or 45s."},{t:"text",k:"gap",label:"Item gap",ph:"32px"},{t:"toggle",k:"pause",label:"Pause on hover and focus"},{t:"toggle",k:"fade",label:"Fade strip edges"}],style:[{t:"unit",c:"--mq-gap",label:"Gap override",layout:"inline",r:1,units:C.space}]}},filter:{label:"Tag filter",icon:"filter",level:2,takes:4,alsoHolds:["box","row","slider","column"],caps:["spacing","decoration","effects","animation"],make:()=>({props:{group:"default",all:"All",tags:"",align:"start"},css:{d:{width:"100%","--fl-gap":"20px","--fl-accent":x("ink"),"--fl-accent-ink":x("surface"),"--fl-line":x("line"),"--fl-btn-text":x("ink"),"--fl-pill-radius":"999px"},t:{},m:{}}}),controls:{content:[{t:"text",k:"group",label:"Group key",ph:"default"},{t:"text",k:"all",label:"Reset tab label",ph:"All"},{t:"text",k:"tags",label:"Tag tabs",ph:"Investigation, Fieldwork, Archive",note:"Comma-separated tags, or leave blank to discover tags from child Boxes."},{t:"pick",k:"align",label:"Tab alignment",opts:[["start","alignL"],["center","alignC"],["end","alignR"]]}],style:[{t:"select",c:"--fl-cols",label:"Card columns",r:1,opts:[["","Auto / stacked"],["repeat(2, minmax(0, 1fr))","2 columns"],["repeat(3, minmax(0, 1fr))","3 columns"],["repeat(4, minmax(0, 1fr))","4 columns"]]},{t:"unit",c:"--fl-gap",label:"Gap",layout:"inline",r:1,units:C.space},{t:"color",c:"--fl-accent",label:"Active tab fill",r:1},{t:"color",c:"--fl-accent-ink",label:"Active tab text",r:1,layout:"inline"},{t:"unit",c:"--fl-pill-radius",label:"Tab radius",layout:"inline",r:1,units:C.radius}]}},compare:{label:"Image compare",icon:"compare",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{beforeSrc:"",afterSrc:"",beforeAlt:"Before comparison view",afterAlt:"After comparison view",beforeLabel:"Before",afterLabel:"After",labels:1,ratio:"16 / 9",position:"50"},css:{d:{width:"100%","--cmp-accent":"#ffffff","--cmp-ink":"#111311","--cmp-radius":"12px"},t:{},m:{}}}),controls:{content:[{t:"img",k:"beforeSrc",label:"Before image"},{t:"text",k:"beforeAlt",label:"Before alt text",ph:"Describe before view"},{t:"toggle",k:"labels",label:"Show labels"},{t:"text",k:"beforeLabel",label:"Before badge",ph:"Before",when:e=>e.props.labels!==0&&e.props.labels!==!1},{t:"img",k:"afterSrc",label:"After image"},{t:"text",k:"afterAlt",label:"After alt text",ph:"Describe after view"},{t:"text",k:"afterLabel",label:"After badge",ph:"After",when:e=>e.props.labels!==0&&e.props.labels!==!1},{t:"select",k:"ratio",label:"Aspect ratio",opts:[["16 / 9","16:9"],["4 / 3","4:3"],["3 / 2","3:2"],["3 / 4","3:4 portrait"],["1 / 1","Square"],["21 / 9","21:9"]]},{t:"unit",k:"position",label:"Initial split (%)",integer:1,min:0,max:100,units:[""]}],style:[{t:"color",c:"--cmp-accent",label:"Handle & divider",r:1,layout:"inline"},{t:"color",c:"--cmp-ink",label:"Handle icon",r:1,layout:"inline"},{t:"unit",c:"--cmp-radius",label:"Radius",layout:"inline",r:1,units:C.radius}]}},timeline:{label:"Timeline",icon:"timeline",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{orientation:"vertical",marker:"numbers",items:[{tag:"Phase 01",title:"Initial assessment",detail:"Outline what happens during the first stage."},{tag:"Phase 02",title:"Build & review",detail:"Document key milestones along the timeline."},{tag:"Phase 03",title:"Delivery & handoff",detail:"Close out with verification and next steps."}]},css:{d:{width:"100%","--tl-accent":x("ink"),"--tl-accent-ink":x("bg"),"--tl-line":x("line"),"--tl-card":x("surface"),"--tl-ink":x("ink"),"--tl-muted":x("muted"),"--tl-gap":"22px","--tl-radius":"10px","--tl-title-size":"18px","--tl-body-size":"15px"},t:{},m:{"--tl-gap":"16px"}}}),controls:{content:[{t:"pick",k:"orientation",label:"Orientation",opts:[["vertical","Vertical"],["horizontal","Horizontal"]],text:1},{t:"select",k:"marker",label:"Markers",opts:[["numbers","Numbers"],["dots","Dots"]]},{t:"qa",k:"items",label:"Milestones",addLabel:"Add milestone",rowFields:[{k:"tag",label:"Phase tag",ph:"Phase 01",def:"Next step"},{k:"title",label:"Title",ph:"Milestone title",def:"New milestone"},{k:"detail",label:"Details",ph:"Description",def:"",area:1}]}],style:[{t:"color",c:"--tl-accent",label:"Marker accent",r:1,layout:"inline"},{t:"color",c:"--tl-accent-ink",label:"Marker text",r:1,layout:"inline"},{t:"color",c:"--tl-line",label:"Spine & border",r:1,layout:"inline"},{t:"color",c:"--tl-card",label:"Card fill",r:1},{t:"color",c:"--tl-ink",label:"Title colour",r:1,layout:"inline"},{t:"color",c:"--tl-muted",label:"Body colour",r:1,layout:"inline"},{t:"unit",c:"--tl-gap",label:"Step gap",layout:"inline",r:1,units:C.space},{t:"unit",c:"--tl-radius",label:"Card radius",layout:"inline",r:1,units:C.radius}]}},progress:{label:"Progress bars",icon:"progress",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{showValue:1,rounded:1,items:[{label:"Completion rate",value:"88",unit:"%"},{label:"Target benchmark",value:"72",unit:"%"}]},css:{d:{width:"100%","--pg-fill":x("brand"),"--pg-track":x("line"),"--pg-text":x("ink"),"--pg-muted":x("muted"),"--pg-height":"10px","--pg-gap":"16px","--pg-radius":"999px"},t:{},m:{}}}),controls:{content:[{t:"qa",k:"items",label:"Meters",addLabel:"Add bar",rowFields:[{k:"label",label:"Label",ph:"Metric name",def:"New metric"},{k:"value",label:"Value (0\u2013100)",ph:"75",def:"75"},{k:"unit",label:"Unit",ph:"%",def:"%"}]},{t:"toggle",k:"showValue",label:"Show numeric value"},{t:"toggle",k:"rounded",label:"Pill ends"}],style:[{t:"color",c:"--pg-fill",label:"Fill colour",r:1,layout:"inline"},{t:"color",c:"--pg-track",label:"Track colour",r:1,layout:"inline"},{t:"color",c:"--pg-text",label:"Label colour",r:1,layout:"inline"},{t:"color",c:"--pg-muted",label:"Value colour",r:1,layout:"inline"},{t:"unit",c:"--pg-height",label:"Bar height",layout:"inline",r:1,units:C.size},{t:"unit",c:"--pg-gap",label:"Row gap",layout:"inline",r:1,units:C.space}]}},hotspot:{label:"Image hotspots",icon:"hotspot",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{src:"",alt:"",w:"",h:"",ratio:"",items:[{label:"01",title:"Primary detail",detail:"Click pin markers to inspect technical specifications.",x:"38",y:"48"},{label:"02",title:"Secondary detail",detail:"Position markers anywhere across the diagram.",x:"66",y:"62"}]},css:{d:{width:"100%","--hs-pin":x("ink"),"--hs-pin-ink":"#ffffff","--hs-ring":"#ffffff","--hs-card":x("bg"),"--hs-card-ink":x("ink"),"--hs-line":x("line"),"--hs-radius":"12px"},t:{},m:{}}}),controls:{content:[{t:"img",k:"src",label:"Diagram / Photo"},{t:"text",k:"alt",label:"Alt text",ph:"Describe the diagram or product view"},{t:"dims",label:"Intrinsic size"},{t:"select",k:"ratio",label:"Aspect ratio",opts:[["","Natural image ratio"],["16 / 9","16:9"],["4 / 3","4:3"],["3 / 2","3:2"],["1 / 1","Square"]]},{t:"qa",k:"items",label:"Hotspot pins",addLabel:"Add pin",rowFields:[{k:"label",label:"Pin badge",ph:"01",def:"03"},{k:"title",label:"Callout title",ph:"Feature name",def:"New callout"},{k:"x",label:"X position (%)",ph:"50",def:"50"},{k:"y",label:"Y position (%)",ph:"50",def:"50"},{k:"detail",label:"Details",ph:"Callout copy",def:"",area:1}]}],style:[{t:"color",c:"--hs-pin",label:"Pin fill",r:1,layout:"inline"},{t:"color",c:"--hs-pin-ink",label:"Pin text",r:1,layout:"inline"},{t:"color",c:"--hs-ring",label:"Pin border",r:1,layout:"inline"},{t:"color",c:"--hs-card",label:"Popover background",r:1},{t:"color",c:"--hs-card-ink",label:"Popover text",r:1,layout:"inline"},{t:"unit",c:"--hs-radius",label:"Image radius",layout:"inline",r:1,units:C.radius}]}},strips:{label:"Expanding strips",icon:"strips",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{trigger:"click",captions:1,open:"50",reach:"35",bounce:"10",items:[{src:"",alt:"",tag:"",title:"First panel",detail:"Add a short description of what this image shows."},{src:"",alt:"",tag:"",title:"Second panel",detail:"Visitors select a panel to expand it."},{src:"",alt:"",tag:"",title:"Third panel",detail:"Use one clear image for each panel."}]},css:{d:{width:"100%","--st-height":"520px","--st-gap":"10px","--st-radius":"14px","--st-bg":"#16191D","--st-ink":"#FFFFFF","--st-accent":x("brand"),"--st-tag":"#F7B084"},t:{},m:{}}}),controls:{content:[{t:"pick",k:"trigger",label:"Interaction",opts:[["click","Click"],["hover","Hover"]],text:1},{t:"toggle",k:"captions",label:"Show captions"},{t:"qa",k:"items",label:"Strips",addLabel:"Add strip",rowFields:[{k:"title",label:"Title",ph:"Panel title",def:"New panel"},{k:"tag",label:"Metadata tag",ph:"Optional footnote",def:""},{k:"src",label:"Photo",ph:"asset:photo",def:"",img:1},{k:"alt",label:"Alt text",ph:"Describe the photo",def:""},{k:"detail",label:"Details",ph:"Short description",def:"",area:1}]}],style:[{t:"slider",k:"open",label:"Expand amount",min:0,max:100,step:5,raw:1},{t:"slider",k:"reach",label:"Neighbor swell",min:0,max:100,step:5,raw:1},{t:"slider",k:"bounce",label:"Spring bounce",min:0,max:100,step:5,raw:1},{t:"unit",c:"--st-height",label:"Strip height",layout:"inline",r:1,units:C.size},{t:"unit",c:"--st-gap",label:"Panel gap",layout:"inline",r:1,units:C.space},{t:"unit",c:"--st-radius",label:"Corner radius",layout:"inline",r:1,units:C.radius},{t:"color",c:"--st-bg",label:"Backdrop",r:1,layout:"inline"},{t:"color",c:"--st-ink",label:"Text colour",r:1,layout:"inline",when:e=>e.props.captions!==0&&e.props.captions!==!1},{t:"color",c:"--st-accent",label:"Focus accent",r:1,layout:"inline"},{t:"color",c:"--st-tag",label:"Tag colour",r:1,layout:"inline",when:e=>e.props.captions!==0&&e.props.captions!==!1}]}},switcher:{label:"Stage switcher",icon:"switcher",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{stageLayout:"rail",ratio:"3 / 2",items:[{label:"First step",meta:"Step 1",title:"What happens first",detail:"Describe this step in a sentence or two.",src:"",alt:"",pos:"50% 50%"},{label:"Second step",meta:"Step 2",title:"What happens next",detail:"Each step shows its own image and caption.",src:"",alt:"",pos:"50% 50%"}]},css:{d:{width:"100%","--sw-accent":x("brand"),"--sw-surface":x("surface"),"--sw-ink":x("ink"),"--sw-muted":x("muted"),"--sw-line":x("line"),"--sw-radius":"14px","--sw-gap":"36px"},t:{},m:{}}}),controls:{content:[{t:"select",k:"stageLayout",label:"Navigation style",opts:[["rail","Vertical step rail"],["tabs","Horizontal tabs"]]},{t:"select",k:"ratio",label:"Stage ratio",opts:[["3 / 2","3:2"],["16 / 9","16:9"],["4 / 3","4:3"],["16 / 10","16:10"],["1 / 1","Square"]]},{t:"qa",k:"items",label:"Stages",addLabel:"Add stage",rowFields:[{k:"label",label:"Step button",ph:"Step title",def:"New stage"},{k:"meta",label:"Meta",ph:"Duration or step",def:""},{k:"title",label:"Caption heading",ph:"Stage headline",def:"Stage overview"},{k:"src",label:"Stage photo",ph:"asset:photo",def:"",img:1},{k:"alt",label:"Alt text",ph:"Describe stage visual",def:""},{k:"pos",label:"Object position",ph:"50% 50%",def:"50% 50%"},{k:"detail",label:"Details",ph:"Stage description",def:"",area:1}]}],style:[{t:"color",c:"--sw-accent",label:"Active accent",r:1,layout:"inline"},{t:"color",c:"--sw-surface",label:"Stage surface",r:1,layout:"inline"},{t:"color",c:"--sw-ink",label:"Text colour",r:1,layout:"inline"},{t:"color",c:"--sw-muted",label:"Muted colour",r:1,layout:"inline"},{t:"color",c:"--sw-line",label:"Border line",r:1,layout:"inline"},{t:"unit",c:"--sw-radius",label:"Stage radius",layout:"inline",r:1,units:C.radius},{t:"unit",c:"--sw-gap",label:"Split gap",layout:"inline",r:1,units:C.space}]}},exhibit:{label:"Exhibit index",icon:"exhibit",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{previewRatio:"4 / 3",items:[{title:"First project",location:"City",scope:"What you did",year:"",href:"",src:"",alt:""},{title:"Second project",location:"City",scope:"What you did",year:"",href:"",src:"",alt:""}]},css:{d:{width:"100%","--ex-accent":x("brand"),"--ex-surface":x("surface"),"--ex-ink":x("ink"),"--ex-muted":x("muted"),"--ex-line":x("line"),"--ex-radius":"12px"},t:{},m:{}}}),controls:{content:[{t:"select",k:"previewRatio",label:"Preview ratio",opts:[["4 / 3","4:3"],["3 / 2","3:2"],["16 / 10","16:10"],["1 / 1","Square"]]},{t:"qa",k:"items",label:"Entries",addLabel:"Add entry",rowFields:[{k:"title",label:"Project title",ph:"Project or monograph title",def:"New entry"},{k:"location",label:"Location",ph:"City or region",def:""},{k:"scope",label:"Scope",ph:"Acreage or discipline",def:""},{k:"year",label:"Year",ph:"2025",def:"2025"},{k:"href",label:"Link URL",ph:"sites.html#entry",def:""},{k:"src",label:"Preview image",ph:"asset:preview",def:"",img:1},{k:"alt",label:"Alt text",ph:"Describe preview visual",def:""}]}],style:[{t:"color",c:"--ex-accent",label:"Accent colour",r:1,layout:"inline"},{t:"color",c:"--ex-surface",label:"Preview surface",r:1,layout:"inline"},{t:"color",c:"--ex-ink",label:"Text colour",r:1,layout:"inline"},{t:"color",c:"--ex-muted",label:"Muted colour",r:1,layout:"inline"},{t:"color",c:"--ex-line",label:"Rule line",r:1,layout:"inline"},{t:"unit",c:"--ex-radius",label:"Preview radius",layout:"inline",r:1,units:C.radius}]}},scrolly:{label:"Sticky steps",icon:"scrolly",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{stickyRatio:"4 / 3",items:[{title:"First step",detail:"Describe this step. Its image stays in view while visitors read.",fact:"",src:"",alt:""},{title:"Second step",detail:"The image changes as visitors scroll to the next step.",fact:"",src:"",alt:""}]},css:{d:{width:"100%","--sc-accent":x("ink"),"--sc-surface":x("surface"),"--sc-ink":x("ink"),"--sc-muted":x("muted"),"--sc-line":x("line"),"--sc-radius":"14px","--sc-gap":"44px"},t:{},m:{}}}),controls:{content:[{t:"select",k:"stickyRatio",label:"Sticky frame ratio",opts:[["4 / 3","4:3"],["3 / 2","3:2"],["16 / 10","16:10"],["16 / 9","16:9"],["1 / 1","Square"]]},{t:"qa",k:"items",label:"Scrolling steps",addLabel:"Add step",rowFields:[{k:"title",label:"Step heading",ph:"Step title",def:"New step"},{k:"fact",label:"Metric note",ph:"Key specification",def:""},{k:"src",label:"Stage image",ph:"asset:stage",def:"",img:1},{k:"alt",label:"Alt text",ph:"Describe stage visual",def:""},{k:"detail",label:"Step narrative",ph:"Describe what happens in this phase",def:"",area:1}]}],style:[{t:"color",c:"--sc-accent",label:"Active accent",r:1,layout:"inline"},{t:"color",c:"--sc-surface",label:"Card surface",r:1,layout:"inline"},{t:"color",c:"--sc-ink",label:"Text colour",r:1,layout:"inline"},{t:"color",c:"--sc-muted",label:"Muted colour",r:1,layout:"inline"},{t:"color",c:"--sc-line",label:"Border line",r:1,layout:"inline"},{t:"unit",c:"--sc-radius",label:"Corner radius",layout:"inline",r:1,units:C.radius},{t:"unit",c:"--sc-gap",label:"Column gap",layout:"inline",r:1,units:C.space}]}},clocks:{label:"Office clocks",icon:"clocks",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{hour12:0,opens:"9",closes:"18",openLabel:"Office open",closedLabel:"After hours",items:[{city:"London",tz:"Europe/London",address:"",phone:"",href:"",linkLabel:""},{city:"New York",tz:"America/New_York",address:"",phone:"",href:"",linkLabel:""}]},css:{d:{width:"100%","--ck-accent":x("ink"),"--ck-surface":"transparent","--ck-ink":x("ink"),"--ck-muted":x("muted"),"--ck-line":x("line"),"--ck-radius":"0px","--ck-gap":"0px","--ck-time-size":"40px"},t:{},m:{}}}),controls:{content:[{t:"toggle",k:"hour12",label:"12-hour clock"},{t:"text",k:"opens",label:"Opens (hour, 0\u201324)",ph:"9"},{t:"text",k:"closes",label:"Closes (hour, 0\u201324)",ph:"18"},{t:"text",k:"openLabel",label:"Open label",ph:"Office open"},{t:"text",k:"closedLabel",label:"Closed label",ph:"After hours"},{t:"qa",k:"items",label:"Offices",addLabel:"Add office",rowFields:[{k:"city",label:"City",ph:"London",def:"New office"},{k:"tz",label:"Time zone (IANA)",ph:"Europe/London",def:"UTC"},{k:"phone",label:"Phone",ph:"+44 20 0000 0000",def:""},{k:"href",label:"Map or page link",ph:"https://maps.example",def:""},{k:"linkLabel",label:"Link label",ph:"Open in Maps",def:""},{k:"src",label:"Office image",ph:"asset:office",def:"",img:1},{k:"alt",label:"Alt text",ph:"Office exterior or room",def:""},{k:"address",label:"Address",ph:"Street, city, postcode",def:"",area:1}]}],style:[{t:"color",c:"--ck-accent",label:"Open accent",r:1,layout:"inline"},{t:"color",c:"--ck-surface",label:"Card fill",r:1,layout:"inline"},{t:"color",c:"--ck-ink",label:"Text colour",r:1,layout:"inline"},{t:"color",c:"--ck-muted",label:"Muted colour",r:1,layout:"inline"},{t:"color",c:"--ck-line",label:"Rule colour",r:1,layout:"inline"},{t:"unit",c:"--ck-time-size",label:"Time size",layout:"inline",r:1,units:C.space},{t:"unit",c:"--ck-radius",label:"Corner radius",layout:"inline",r:1,units:C.radius},{t:"unit",c:"--ck-gap",label:"Card gap",layout:"inline",r:1,units:C.space}]}},roster:{label:"Team spotlight",icon:"roster",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{portraitRatio:"4 / 5",seatLabel:"Based in",credLabel:"Focus",items:[{name:"First person",role:"Role",seat:"City",credential:"Area of focus",quote:"Add a short quote or introduction.",href:"",linkLabel:"",src:"",alt:""},{name:"Second person",role:"Role",seat:"City",credential:"Area of focus",quote:"Add a short quote or introduction.",href:"",linkLabel:"",src:"",alt:""}]},css:{d:{width:"100%","--rs-accent":x("ink"),"--rs-surface":x("surface"),"--rs-ink":x("ink"),"--rs-muted":x("muted"),"--rs-line":x("line"),"--rs-radius":"2px"},t:{},m:{}}}),controls:{content:[{t:"select",k:"portraitRatio",label:"Portrait ratio",opts:[["4 / 5","4:5"],["3 / 4","3:4"],["1 / 1","Square"],["3 / 2","3:2"]]},{t:"text",k:"seatLabel",label:"Location label",ph:"Based in"},{t:"text",k:"credLabel",label:"Focus label",ph:"Focus"},{t:"qa",k:"items",label:"Members",addLabel:"Add member",rowFields:[{k:"name",label:"Full name",ph:"Full name",def:"New person"},{k:"role",label:"Role",ph:"Role",def:""},{k:"seat",label:"Office / city",ph:"Washington, D.C.",def:""},{k:"credential",label:"Focus",ph:"Area of focus",def:""},{k:"src",label:"Portrait",ph:"asset:partner",def:"",img:1},{k:"alt",label:"Alt text",ph:"Describe the portrait",def:""},{k:"href",label:"Action link",ph:"contact.html",def:""},{k:"linkLabel",label:"Link label",ph:"Get in touch",def:""},{k:"quote",label:"Spotlight quote",ph:"A short quote or introduction",def:"",area:1}]}],style:[{t:"color",c:"--rs-accent",label:"Active accent",r:1,layout:"inline"},{t:"color",c:"--rs-surface",label:"Stage surface",r:1,layout:"inline"},{t:"color",c:"--rs-ink",label:"Heading colour",r:1,layout:"inline"},{t:"color",c:"--rs-muted",label:"Muted colour",r:1,layout:"inline"},{t:"color",c:"--rs-line",label:"Border line",r:1,layout:"inline"},{t:"unit",c:"--rs-radius",label:"Corner radius",layout:"inline",r:1,units:C.radius}]}},tiers:{label:"Pricing table",icon:"tiers",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{defaultCurrency:"usd",usdLabel:"USD $",eurLabel:"EUR \u20AC",gbpLabel:"GBP \xA3",items:[{tierName:"Starter",badge:"",priceUsd:"$29",priceEur:"\u20AC27",priceGbp:"\xA323",period:"/ month",summary:"Who this plan is for.",features:`First feature
Second feature`,ctaText:"Get started",href:"",featured:0},{tierName:"Plus",badge:"Most popular",priceUsd:"$59",priceEur:"\u20AC55",priceGbp:"\xA347",period:"/ month",summary:"Who this plan is for.",features:`Everything in Starter
Another feature`,ctaText:"Get started",href:"",featured:1}]},css:{d:{width:"100%","--tr-accent":x("brand"),"--tr-on":mt(),"--tr-surface":x("surface"),"--tr-ink":x("ink"),"--tr-muted":x("muted"),"--tr-line":x("line"),"--tr-feat-bg":x("ink"),"--tr-feat-ink":"#ffffff","--tr-radius":"2px"},t:{},m:{}}}),controls:{content:[{t:"select",k:"defaultCurrency",label:"Default currency",opts:[["usd","USD"],["eur","EUR"],["gbp","GBP"]]},{t:"text",k:"usdLabel",label:"USD button",ph:"USD $"},{t:"text",k:"eurLabel",label:"EUR button",ph:"EUR \u20AC"},{t:"text",k:"gbpLabel",label:"GBP button",ph:"GBP \xA3"},{t:"qa",k:"items",label:"Tiers",addLabel:"Add tier",rowFields:[{k:"tierName",label:"Tier name",ph:"Advisory Retainer",def:"New tier"},{k:"badge",label:"Badge (optional)",ph:"Most popular",def:""},{k:"featured",label:"Highlight this tier",toggle:1},{k:"priceUsd",label:"USD price",ph:"$6,400",def:"$5,000"},{k:"priceEur",label:"EUR price",ph:"\u20AC5,800",def:"\u20AC4,600"},{k:"priceGbp",label:"GBP price",ph:"\xA34,950",def:"\xA33,900"},{k:"period",label:"Billing period",ph:"/ month",def:"/ month"},{k:"ctaText",label:"Button label",ph:"Select tier",def:"Get started"},{k:"href",label:"Button link",ph:"contact.html",def:""},{k:"summary",label:"Summary",ph:"One-sentence tier scope",def:"",area:1},{k:"features",label:"Features (one per line)",ph:`Feature one
Feature two`,def:"",area:1}]}],style:[{t:"color",c:"--tr-accent",label:"Accent colour",r:1,layout:"inline"},{t:"color",c:"--tr-on",label:"Text on accent",r:1,layout:"inline"},{t:"color",c:"--tr-surface",label:"Card surface",r:1,layout:"inline"},{t:"color",c:"--tr-ink",label:"Text colour",r:1,layout:"inline"},{t:"color",c:"--tr-muted",label:"Muted colour",r:1,layout:"inline"},{t:"color",c:"--tr-line",label:"Border line",r:1,layout:"inline"},{t:"color",c:"--tr-feat-bg",label:"Featured fill",r:1,layout:"inline"},{t:"color",c:"--tr-feat-ink",label:"Featured text",r:1,layout:"inline"},{t:"unit",c:"--tr-radius",label:"Corner radius",layout:"inline",r:1,units:C.radius}]}},qapills:{label:"Question pills",icon:"qapills",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{pillAlign:"center",items:[{q:"First question?",a:"Write a direct answer here.",note:"",href:"",linkLabel:""},{q:"Second question?",a:"Visitors pick a question to see its answer.",note:"",href:"",linkLabel:""}]},css:{d:{width:"100%","--qp-accent":x("ink"),"--qp-on":x("bg"),"--qp-surface":x("surface"),"--qp-ink":x("ink"),"--qp-muted":x("muted"),"--qp-line":x("line"),"--qp-radius":"2px","--qp-pill-radius":"999px"},t:{},m:{}}}),controls:{content:[{t:"pick",k:"pillAlign",label:"Alignment",opts:[["start","Left"],["center","Center"]],text:1},{t:"qa",k:"items",label:"Questions",addLabel:"Add question",rowFields:[{k:"q",label:"Question pill",ph:"Short question",def:"New question?"},{k:"note",label:"Note",ph:"Optional note",def:""},{k:"href",label:"Action link",ph:"contact.html",def:""},{k:"linkLabel",label:"Link label",ph:"Learn more",def:""},{k:"a",label:"Full answer",ph:"Direct answer shown in panel",def:"",area:1}]}],style:[{t:"color",c:"--qp-accent",label:"Active pill accent",r:1,layout:"inline"},{t:"color",c:"--qp-on",label:"Text on accent",r:1,layout:"inline"},{t:"color",c:"--qp-surface",label:"Panel surface",r:1,layout:"inline"},{t:"color",c:"--qp-ink",label:"Question colour",r:1,layout:"inline"},{t:"color",c:"--qp-muted",label:"Answer colour",r:1,layout:"inline"},{t:"color",c:"--qp-line",label:"Border line",r:1,layout:"inline"},{t:"unit",c:"--qp-radius",label:"Panel radius",layout:"inline",r:1,units:C.radius},{t:"unit",c:"--qp-pill-radius",label:"Pill radius",layout:"inline",r:1,units:C.radius}]}},dockbar:{label:"Docked bar",icon:"dockbar",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{mode:"external",action:"",method:"post",submit:"Send",aria:"Quick form",success:"",fields:[{type:"text",label:"Name",name:"name",required:1,ph:"Your name"},{type:"email",label:"Email",name:"email",required:1,ph:"you@example.com"},{type:"select",label:"Topic",name:"topic",required:0,opts:"General, Booking, Support"}]},css:{d:{width:"100%","--db-accent":x("brand"),"--db-on":mt(),"--db-surface":x("surface"),"--db-ink":x("ink"),"--db-muted":x("muted"),"--db-line":x("line"),"--db-radius":"2px"},t:{},m:{}}}),controls:{content:[{t:"fields",k:"fields",label:"Fields"},{t:"text",k:"submit",label:"Button label",ph:"Send"},{t:"area",k:"success",label:"Confirmation message",ph:"Thank you. Your submission has been received."},{t:"select",k:"mode",label:"Handling",opts:[["external","External HTTPS endpoint"],["wordpress","WordPress managed"]]},{t:"text",k:"action",label:"Where submissions go",ph:"Paste an HTTPS destination",note:"Paste your service\u2019s complete HTTPS URL. On Cloud, a blank POST form saves to Submissions.",when:e=>Ne()||e.props.mode!=="wordpress"},{t:"select",k:"method",label:"Method",layout:"inline",opts:[["post","POST"],["get","GET"]],when:e=>Ne()||e.props.mode!=="wordpress"},{t:"text",k:"aria",label:"Accessible name",ph:"Quick form"}],style:[{t:"color",c:"--db-accent",label:"Button & focus accent",r:1,layout:"inline"},{t:"color",c:"--db-on",label:"Text on accent",r:1,layout:"inline"},{t:"color",c:"--db-surface",label:"Bar surface",r:1,layout:"inline"},{t:"color",c:"--db-ink",label:"Text colour",r:1,layout:"inline"},{t:"color",c:"--db-muted",label:"Placeholder colour",r:1,layout:"inline"},{t:"color",c:"--db-line",label:"Divider line",r:1,layout:"inline"},{t:"unit",c:"--db-radius",label:"Corner radius",layout:"inline",r:1,units:C.radius}]}},arches:{label:"Fanned arches",icon:"arches",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{archSpread:"fan",items:[{src:"",alt:"",caption:""},{src:"",alt:"",caption:""},{src:"",alt:"",caption:""},{src:"",alt:"",caption:""},{src:"",alt:"",caption:""}]},css:{d:{width:"100%","--ar-frame":x("surface"),"--ar-bg":x("line")},t:{},m:{}}}),controls:{content:[{t:"qa",k:"items",label:"Arch frames (up to 5)",addLabel:"Add arch",max:5,rowFields:[{k:"src",label:"Image",ph:"asset:arch-1",def:"",img:1},{k:"alt",label:"Alt text",ph:"Describe image",def:"Arch frame"}]}],style:[{t:"color",c:"--ar-frame",label:"Frame border",r:1,layout:"inline"},{t:"color",c:"--ar-bg",label:"Placeholder fill",r:1,layout:"inline"}]}},reel:{label:"Reel slider",icon:"reel",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{ratio:"9 / 16",arrows:1,dots:1,reels:[{title:"Morning check-in",src:"",poster:"",alt:"Reel 1"},{title:"Studio walk",src:"",poster:"",alt:"Reel 2"},{title:"Plaza session",src:"",poster:"",alt:"Reel 3"},{title:"Big canvas",src:"",poster:"",alt:"Reel 4"},{title:"On the wheel",src:"",poster:"",alt:"Reel 5"}]},css:{d:{width:"100%","--rl-height":"480px","--rl-card-w":"220px","--rl-radius":"16px","--rl-stage-radius":"20px","--rl-bg":"#F3F3F3","--rl-accent":"#E04F3E","--rl-ink":"#FFFFFF"},t:{},m:{"--rl-height":"400px","--rl-card-w":"180px"}}}),controls:{content:[{t:"select",k:"ratio",label:"Reel ratio",opts:[["9 / 16","9:16 reel"],["3 / 4","3:4 portrait"],["4 / 5","4:5 vertical"],["1 / 1","Square"]]},{t:"toggle",k:"arrows",label:"Arrow buttons"},{t:"toggle",k:"dots",label:"Pagination dots"},{t:"qa",k:"reels",label:"Reels",addLabel:"Add reel",rowFields:[{k:"title",label:"Caption",ph:"Short reel label",def:"New reel"},{k:"src",label:"Photo or video",ph:"asset:photo or https://...mp4",def:"",img:1},{k:"poster",label:"Video poster",ph:"Optional poster image",def:"",img:1},{k:"alt",label:"Alt text",ph:"Describe the reel",def:""}]}],style:[{t:"unit",c:"--rl-height",label:"Stage height",layout:"inline",r:1,units:C.size},{t:"unit",c:"--rl-card-w",label:"Reel width",layout:"inline",r:1,units:C.size},{t:"unit",c:"--rl-radius",label:"Card radius",layout:"inline",r:1,units:C.radius},{t:"unit",c:"--rl-stage-radius",label:"Stage radius",layout:"inline",r:1,units:C.radius},{t:"color",c:"--rl-bg",label:"Stage surface",r:1,layout:"inline"},{t:"color",c:"--rl-accent",label:"Accent colour",r:1,layout:"inline"},{t:"color",c:"--rl-ink",label:"Caption colour",r:1,layout:"inline"}]}},grow:{label:"Grow carousel",icon:"grow",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{ratio:"3 / 4",speed:"36",cards:[{title:"Copper Light",subtitle:"Portrait series",src:"",alt:"Card 1"},{title:"Ribbon Fire",subtitle:"Motion study",src:"",alt:"Card 2"},{title:"Balance",subtitle:"CGI loop",src:"",alt:"Card 3"},{title:"Velvet Dusk",subtitle:"Editorial",src:"",alt:"Card 4"},{title:"Glass Bloom",subtitle:"Still life",src:"",alt:"Card 5"}]},css:{d:{width:"100%","--gc-height":"480px","--gc-card-w":"200px","--gc-gap":"12px","--gc-radius":"6px","--gc-stage-radius":"22px","--gc-bg":"#E4E4E4","--gc-ink":"#FFFFFF"},t:{},m:{"--gc-height":"380px","--gc-card-w":"160px"}}}),controls:{content:[{t:"select",k:"ratio",label:"Card ratio",opts:[["3 / 4","3:4 portrait"],["4 / 5","4:5 vertical"],["9 / 16","9:16 reel"],["1 / 1","Square"]]},{t:"text",k:"speed",label:"Scroll speed (px/s)",ph:"36"},{t:"qa",k:"cards",label:"Cards",addLabel:"Add card",rowFields:[{k:"title",label:"Title",ph:"Card title",def:"New card"},{k:"subtitle",label:"Subtitle",ph:"Short subtitle",def:""},{k:"src",label:"Photo",ph:"asset:photo",def:"",img:1},{k:"alt",label:"Alt text",ph:"Describe the image",def:""}]}],style:[{t:"unit",c:"--gc-height",label:"Stage height",layout:"inline",r:1,units:C.size},{t:"unit",c:"--gc-card-w",label:"Card width",layout:"inline",r:1,units:C.size},{t:"unit",c:"--gc-gap",label:"Card gap",layout:"inline",r:1,units:C.space},{t:"unit",c:"--gc-radius",label:"Card radius",layout:"inline",r:1,units:C.radius},{t:"unit",c:"--gc-stage-radius",label:"Stage radius",layout:"inline",r:1,units:C.radius},{t:"color",c:"--gc-bg",label:"Resting backdrop",r:1,layout:"inline"},{t:"color",c:"--gc-ink",label:"Caption colour",r:1,layout:"inline"}]}},deck:{label:"Card deck",icon:"deck",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{ratio:"4 / 5",arrows:1,deckCards:[{tag:"01 \xB7 Architecture",title:"Basalt & Cedar",src:"",alt:"Card 1"},{tag:"02 \xB7 Daylight",title:"Clerestory Light",src:"",alt:"Card 2"},{tag:"03 \xB7 Material",title:"Raw Flax Linen",src:"",alt:"Card 3"},{tag:"04 \xB7 Ritual",title:"Thermal Plunge",src:"",alt:"Card 4"}]},css:{d:{width:"100%","--dk-card-w":"320px","--dk-radius":"18px","--dk-bg":"#181A20","--dk-ink":"#FFFFFF","--dk-accent":x("brand"),"--dk-btn-bg":x("surface"),"--dk-btn-ink":x("ink"),"--dk-line":x("line")},t:{},m:{"--dk-card-w":"280px"}}}),controls:{content:[{t:"select",k:"ratio",label:"Card ratio",opts:[["4 / 5","4:5 portrait"],["3 / 4","3:4 portrait"],["1 / 1","Square"],["4 / 3","4:3 landscape"]]},{t:"toggle",k:"arrows",label:"Show controls"},{t:"qa",k:"deckCards",label:"Deck cards",addLabel:"Add card",rowFields:[{k:"tag",label:"Eyebrow tag",ph:"01 \xB7 Chapter",def:""},{k:"title",label:"Title",ph:"Card headline",def:"New card"},{k:"src",label:"Photo",ph:"asset:photo",def:"",img:1},{k:"alt",label:"Alt text",ph:"Describe the photo",def:""}]}],style:[{t:"unit",c:"--dk-card-w",label:"Card width",layout:"inline",r:1,units:C.size},{t:"unit",c:"--dk-radius",label:"Corner radius",layout:"inline",r:1,units:C.radius},{t:"color",c:"--dk-bg",label:"Card backdrop",r:1,layout:"inline"},{t:"color",c:"--dk-ink",label:"Caption colour",r:1,layout:"inline"},{t:"color",c:"--dk-accent",label:"Tag accent",r:1,layout:"inline"}]}},metrics:{label:"Odometer metrics",icon:"metrics",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{stats:[{prefix:"",value:"99.8",suffix:"%",label:"Uptime SLA",detail:"Verified across edge regions."},{prefix:"$",value:"4.2",suffix:"M",label:"Annual savings",detail:"Measured across client teams."},{prefix:"",value:"140",suffix:"+",label:"Studios shipped",detail:"Static HTML with zero lock-in."}]},css:{d:{width:"100%","--mt-cols":"3","--mt-gap":"18px","--mt-radius":"14px","--mt-bg":x("surface"),"--mt-line":x("line"),"--mt-accent":x("ink"),"--mt-ink":x("ink"),"--mt-muted":x("muted")},t:{"--mt-cols":"2"},m:{"--mt-cols":"1"}}}),controls:{content:[{t:"unit",c:"--mt-cols",label:"Columns",r:1,min:1,max:6,integer:1,units:[""]},{t:"qa",k:"stats",label:"Metrics",addLabel:"Add metric",rowFields:[{k:"prefix",label:"Prefix",ph:"$ or ~",def:""},{k:"value",label:"Number",ph:"120",def:"100"},{k:"suffix",label:"Suffix",ph:"+, %, k, M",def:""},{k:"label",label:"Label",ph:"Metric title",def:"New metric"},{k:"detail",label:"Caption",ph:"Optional footnote",def:""}]}],style:[{t:"unit",c:"--mt-gap",label:"Card gap",layout:"inline",r:1,units:C.space},{t:"unit",c:"--mt-radius",label:"Corner radius",layout:"inline",r:1,units:C.radius},{t:"color",c:"--mt-bg",label:"Card fill",r:1,layout:"inline"},{t:"color",c:"--mt-line",label:"Border line",r:1,layout:"inline"},{t:"color",c:"--mt-accent",label:"Number colour",r:1,layout:"inline"},{t:"color",c:"--mt-ink",label:"Label colour",r:1,layout:"inline"},{t:"color",c:"--mt-muted",label:"Caption colour",r:1,layout:"inline"}]}},spotlight:{label:"Spotlight cards",icon:"spotlight",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{tiles:[{tag:"Zero runtime bloat",title:"Static HTML export",detail:"Every page compiles to clean, self-contained HTML and CSS with no framework runtime.",href:"",linkLabel:""},{tag:"Design tokens",title:"Shared styles & variants",detail:"Update a single token or component definition and every instance stays in sync.",href:"",linkLabel:""},{tag:"Edge ready",title:"Instant global publish",detail:"Deploy immutable signed releases directly to Cloud or WordPress in one click.",href:"",linkLabel:""}]},css:{d:{width:"100%","--sp-cols":"3","--sp-gap":"18px","--sp-radius":"18px","--sp-bg":"#111318","--sp-line":"rgba(255,255,255,.1)","--sp-ink":"#F4F5F7","--sp-muted":"#9AA3B2","--sp-accent":"#38BDF8","--sp-glow":"rgba(56,189,248,.92)","--sp-sheen":"rgba(56,189,248,.18)"},t:{"--sp-cols":"3"},m:{"--sp-cols":"1"}}}),controls:{content:[{t:"unit",c:"--sp-cols",label:"Columns",r:1,min:1,max:4,integer:1,units:[""]},{t:"qa",k:"tiles",label:"Cards",addLabel:"Add card",rowFields:[{k:"tag",label:"Eyebrow tag",ph:"Feature category",def:""},{k:"title",label:"Title",ph:"Card headline",def:"New feature"},{k:"detail",label:"Description",ph:"Short explanation",def:"",area:1},{k:"href",label:"Link URL (optional)",ph:"https://...",def:""},{k:"linkLabel",label:"Link label",ph:"Learn more",def:""}]}],style:[{t:"unit",c:"--sp-gap",label:"Card gap",layout:"inline",r:1,units:C.space},{t:"unit",c:"--sp-radius",label:"Corner radius",layout:"inline",r:1,units:C.radius},{t:"color",c:"--sp-bg",label:"Card fill",r:1,layout:"inline"},{t:"color",c:"--sp-line",label:"Border line",r:1,layout:"inline"},{t:"color",c:"--sp-ink",label:"Title colour",r:1,layout:"inline"},{t:"color",c:"--sp-muted",label:"Body colour",r:1,layout:"inline"},{t:"color",c:"--sp-accent",label:"Accent & glow",r:1,layout:"inline"}]}},terminal:{label:"Command terminal",icon:"terminal",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{title:"pagecraft-cli \u2014 zsh",commands:[{label:"Install",cmd:"npx create-pagecraft@latest studio-site",output:`\u2713 Created studio-site in 1.2s
\u2713 Installed static compiler & tokens
\u2192 Ready: cd studio-site && npm run dev`,note:"Zero framework runtime \u2014 outputs clean HTML & CSS."},{label:"Build",cmd:"npm run build -- --target=static",output:`\u2713 Compiled 14 pages & 22 assets
\u2713 Tree-shook widget CSS (8.4 KB gzipped)
\u2713 Verified 0 broken links`,note:"Every page ships only the CSS and scripts it actually uses."},{label:"Deploy",cmd:"npx pagecraft deploy --prod",output:`\u2713 Signed immutable release v2.4.1
\u2713 Propagated to 38 edge regions in 410ms
\u2713 Live at https://studio.itspagecraft.com`,note:"Instant rollback to any previous signed release."}]},css:{d:{width:"100%","--tm-radius":"16px","--tm-bg":"#0D1016","--tm-line":"rgba(255,255,255,.11)","--tm-ink":"#E6EBF2","--tm-muted":"#8B95A5","--tm-accent":"#34D399"},t:{},m:{}}}),controls:{content:[{t:"text",k:"title",label:"Window title",ph:"terminal \u2014 zsh"},{t:"qa",k:"commands",label:"Commands",addLabel:"Add command",rowFields:[{k:"label",label:"Tab label",ph:"Install",def:"Step"},{k:"cmd",label:"Command",ph:"npm install ...",def:"npm run dev"},{k:"output",label:"Output lines",ph:"One line per output row",def:"\u2713 Done",area:1},{k:"note",label:"Footer note",ph:"Optional hint below terminal",def:""}]}],style:[{t:"unit",c:"--tm-radius",label:"Corner radius",layout:"inline",r:1,units:C.radius},{t:"color",c:"--tm-bg",label:"Surface",r:1,layout:"inline"},{t:"color",c:"--tm-line",label:"Border line",r:1,layout:"inline"},{t:"color",c:"--tm-ink",label:"Text colour",r:1,layout:"inline"},{t:"color",c:"--tm-muted",label:"Output colour",r:1,layout:"inline"},{t:"color",c:"--tm-accent",label:"Prompt & success",r:1,layout:"inline"}]}},tilt:{label:"3D tilt cards",icon:"tilt",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{ratio:"4 / 5",tiltCards:[{tag:"01 \xB7 Craft",title:"Cedar Courtyard",detail:"Hand-milled timber eaves framing the morning light.",src:K,alt:"Cedar Courtyard"},{tag:"02 \xB7 Material",title:"Basalt Basin",detail:"Thermal stone carved in a single continuous pour.",src:K,alt:"Basalt Basin"},{tag:"03 \xB7 Atmosphere",title:"Linen Pavilion",detail:"Acoustic plaster walls with quiet garden sightlines.",src:K,alt:"Linen Pavilion"}]},css:{d:{width:"100%","--tl-cols":"3","--tl-gap":"20px","--tl-radius":"18px","--tl-bg":"#12151C","--tl-line":"rgba(255,255,255,.12)"},t:{"--tl-cols":"3"},m:{"--tl-cols":"1"}}}),controls:{content:[{t:"unit",c:"--tl-cols",label:"Columns",r:1,min:1,max:4,integer:1,units:[""]},{t:"select",k:"ratio",label:"Card aspect",opts:[["3 / 4","Portrait 3:4"],["4 / 5","Portrait 4:5"],["1 / 1","Square 1:1"],["4 / 3","Landscape 4:3"]]},{t:"qa",k:"tiltCards",label:"Cards",addLabel:"Add card",rowFields:[{k:"src",label:"Image",img:1,def:""},{k:"tag",label:"Badge tag",ph:"01 \xB7 Craft",def:""},{k:"title",label:"Title",ph:"Card title",def:"New card"},{k:"detail",label:"Caption",ph:"Short caption",def:"",area:1},{k:"alt",label:"Alt text",ph:"Describe image",def:""}]}],style:[{t:"unit",c:"--tl-gap",label:"Card gap",layout:"inline",r:1,units:C.space},{t:"unit",c:"--tl-radius",label:"Corner radius",layout:"inline",r:1,units:C.radius},{t:"color",c:"--tl-bg",label:"Card backdrop",r:1,layout:"inline"},{t:"color",c:"--tl-line",label:"Border line",r:1,layout:"inline"}]}},flip:{label:"3D flip cards",icon:"flip",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{trigger:"click",ratio:"4 / 5",flipCards:[{tag:"Architecture",title:"Thermal Pavilion",frontNote:"Tap to inspect specs",backTitle:"Materials & footprint",detail:"420 m\xB2 of local basalt, untreated hinoki cedar, and radiant floor heating fed by natural spring water.",href:"#pavilion",linkLabel:"View floor plan",src:K,alt:"Thermal Pavilion"},{tag:"Hospitality",title:"Quiet Rest Rooms",frontNote:"Tap to inspect specs",backTitle:"Designed for stillness",detail:"Eight acoustic suites overlooking the cedar grove with woven flax drapery and zero ambient glare.",href:"#suites",linkLabel:"Explore suites",src:K,alt:"Quiet Rest Rooms"},{tag:"Botanical",title:"Evening Tisane Bar",frontNote:"Tap to inspect specs",backTitle:"Seasonal infusions",detail:"Wild-harvested mountain herbs steeped to order beside the central river-stone hearth.",href:"#tisane",linkLabel:"See menu",src:K,alt:"Evening Tisane Bar"}]},css:{d:{width:"100%","--fl-cols":"3","--fl-gap":"18px","--fl-radius":"18px","--fl-front-bg":"#13161D","--fl-back-bg":"#FFFFFF","--fl-ink":"#18181B","--fl-muted":"#52525B","--fl-line":"rgba(0,0,0,.1)","--fl-accent":"#2563EB"},t:{"--fl-cols":"3"},m:{"--fl-cols":"1"}}}),controls:{content:[{t:"unit",c:"--fl-cols",label:"Columns",r:1,min:1,max:4,integer:1,units:[""]},{t:"pick",k:"trigger",label:"Flip on",opts:[["click","Click / Tap"],["hover","Hover"]]},{t:"select",k:"ratio",label:"Card aspect",opts:[["3 / 4","Portrait 3:4"],["4 / 5","Portrait 4:5"],["1 / 1","Square 1:1"],["4 / 3","Landscape 4:3"]]},{t:"qa",k:"flipCards",label:"Cards",addLabel:"Add card",rowFields:[{k:"src",label:"Front image",img:1,def:""},{k:"tag",label:"Eyebrow tag",ph:"Category",def:""},{k:"title",label:"Front title",ph:"Card headline",def:"New card"},{k:"frontNote",label:"Front hint",ph:"Tap to flip",def:"Tap to flip"},{k:"backTitle",label:"Back heading",ph:"Back face headline",def:"Details"},{k:"detail",label:"Back description",ph:"Full explanation shown after flip",def:"",area:1},{k:"href",label:"Link URL (optional)",ph:"https://...",def:""},{k:"linkLabel",label:"Link label",ph:"Learn more",def:""},{k:"alt",label:"Alt text",ph:"Describe front image",def:""}]}],style:[{t:"unit",c:"--fl-gap",label:"Card gap",layout:"inline",r:1,units:C.space},{t:"unit",c:"--fl-radius",label:"Corner radius",layout:"inline",r:1,units:C.radius},{t:"color",c:"--fl-front-bg",label:"Front fill",r:1,layout:"inline"},{t:"color",c:"--fl-back-bg",label:"Back fill",r:1,layout:"inline"},{t:"color",c:"--fl-ink",label:"Back title",r:1,layout:"inline"},{t:"color",c:"--fl-muted",label:"Back body",r:1,layout:"inline"},{t:"color",c:"--fl-accent",label:"Accent",r:1,layout:"inline"}]}},chapters:{label:"Chapter frame",icon:"chapters",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{frameRatio:"16 / 9",autoSeconds:"6",chapters:[{chapterTitle:"First chapter",chapterSub:"",overlayText:"One sentence over the image.",src:"",alt:""},{chapterTitle:"Second chapter",chapterSub:"",overlayText:"One sentence over the image.",src:"",alt:""},{chapterTitle:"Third chapter",chapterSub:"",overlayText:"One sentence over the image.",src:"",alt:""}]},css:{d:{width:"100%","--ch-accent":x("brand"),"--ch-ink":x("ink"),"--ch-muted":x("muted"),"--ch-line":x("line"),"--ch-radius":"14px"},t:{},m:{}}}),controls:{content:[{t:"select",k:"frameRatio",label:"Frame ratio",opts:[["16 / 9","16:9"],["21 / 9","21:9"],["3 / 2","3:2"]]},{t:"text",k:"autoSeconds",label:"Auto-advance (seconds, 0=off)",ph:"6"},{t:"qa",k:"chapters",label:"Chapters",addLabel:"Add chapter",rowFields:[{k:"chapterTitle",label:"Chapter title",ph:"Chapter title",def:"New chapter"},{k:"chapterSub",label:"Subtitle",ph:"Optional subtitle",def:""},{k:"src",label:"Frame image",ph:"asset:chapter",def:"",img:1},{k:"alt",label:"Alt text",ph:"Describe chapter scene",def:""},{k:"overlayText",label:"Frame caption",ph:"One sentence overlaid on the frame",def:"",area:1}]}],style:[{t:"color",c:"--ch-accent",label:"Progress accent",r:1,layout:"inline"},{t:"color",c:"--ch-ink",label:"Title colour",r:1,layout:"inline"},{t:"color",c:"--ch-muted",label:"Subtitle colour",r:1,layout:"inline"},{t:"color",c:"--ch-line",label:"Track & border",r:1,layout:"inline"},{t:"unit",c:"--ch-radius",label:"Frame radius",layout:"inline",r:1,units:C.radius}]}},slotpicker:{label:"Booking request",icon:"slotpicker",level:4,caps:["spacing","decoration","effects","animation"],make:()=>({props:{mode:"external",action:"",method:"post",submit:"Request booking",aria:"Booking request",success:"",note:"We will confirm your booking by email.",currencySymbol:"$",showPrices:1,showTotal:1,showGuests:1,maxGuests:"4",showTimes:1,passHeading:"Choose a service",guestHeading:"Guests",slotHeading:"Preferred time",contactHeading:"Your details",serviceLabel:"Service",guestLabel:"Guests",timeLabel:"Time",summaryTitle:"Your request",totalLabel:"Estimated total",perGuestLabel:"/ guest",fixedLabel:"total",passes:[{passName:"First service",passMeta:"",unitPrice:"50",fixedTotal:0},{passName:"Second service",passMeta:"",unitPrice:"80",fixedTotal:0}],slots:[{time:"09:00"},{time:"12:00"},{time:"15:00"}],fields:ui()},css:{d:{width:"100%","--sp-accent":x("ink"),"--sp-on":x("bg"),"--sp-surface":x("surface"),"--sp-ink":x("ink"),"--sp-muted":x("muted"),"--sp-line":x("line"),"--sp-radius":"10px"},t:{},m:{}}}),controls:{content:[{t:"qa",k:"passes",label:"Services",addLabel:"Add service",rowFields:[{k:"passName",label:"Name",ph:"Service name",def:"New service"},{k:"passMeta",label:"Note",ph:"What is included",def:""},{k:"unitPrice",label:"Price",ph:"50",def:"50"},{k:"fixedTotal",label:"One price for the whole party",toggle:1}]},{t:"text",k:"currencySymbol",label:"Currency symbol",ph:"$"},{t:"toggle",k:"showPrices",label:"Show prices"},{t:"toggle",k:"showTotal",label:"Show and save an estimated total"},{t:"toggle",k:"showGuests",label:"Ask for guests"},{t:"unit",k:"maxGuests",label:"Most guests",integer:1,min:1,max:50,units:[""],when:e=>Number(e.props.showGuests)!==0},{t:"toggle",k:"showTimes",label:"Ask for a time"},{t:"qa",k:"slots",label:"Available times",addLabel:"Add time",when:e=>Number(e.props.showTimes)!==0,rowFields:[{k:"time",label:"Time",ph:"09:00",def:"10:00"}]},{t:"fields",k:"fields",label:"Contact fields"},{t:"text",k:"submit",label:"Button label",ph:"Request booking"},{t:"area",k:"note",label:"Note under the button",ph:"We will confirm your booking by email."},{t:"area",k:"success",label:"Confirmation message",ph:"Thank you. Your submission has been received."},{t:"select",k:"mode",label:"Handling",opts:[["external","External HTTPS endpoint"],["wordpress","WordPress managed"]]},{t:"text",k:"action",label:"Where submissions go",ph:"Paste an HTTPS destination",note:"Paste your service\u2019s complete HTTPS URL. On Cloud, a blank POST form saves to Submissions.",when:e=>Ne()||e.props.mode!=="wordpress"},{t:"select",k:"method",label:"Method",layout:"inline",opts:[["post","POST"],["get","GET"]],when:e=>Ne()||e.props.mode!=="wordpress"},{t:"text",k:"passHeading",label:"Services heading",ph:"Choose a service"},{t:"text",k:"guestHeading",label:"Guests heading",ph:"Guests"},{t:"text",k:"slotHeading",label:"Times heading",ph:"Preferred time"},{t:"text",k:"contactHeading",label:"Contact heading",ph:"Your details"},{t:"text",k:"summaryTitle",label:"Summary heading",ph:"Your request"},{t:"text",k:"serviceLabel",label:"Service label",ph:"Service"},{t:"text",k:"guestLabel",label:"Guests label",ph:"Guests"},{t:"text",k:"timeLabel",label:"Time label",ph:"Time"},{t:"text",k:"totalLabel",label:"Total label",ph:"Estimated total"},{t:"text",k:"perGuestLabel",label:"Price per guest label",ph:"/ guest"},{t:"text",k:"fixedLabel",label:"Single price label",ph:"total"},{t:"text",k:"aria",label:"Accessible name",ph:"Booking request"}],style:[{t:"color",c:"--sp-accent",label:"Selected accent",r:1,layout:"inline"},{t:"color",c:"--sp-on",label:"Text on accent",r:1,layout:"inline"},{t:"color",c:"--sp-surface",label:"Card surface",r:1,layout:"inline"},{t:"color",c:"--sp-ink",label:"Text colour",r:1,layout:"inline"},{t:"color",c:"--sp-muted",label:"Muted colour",r:1,layout:"inline"},{t:"color",c:"--sp-line",label:"Border line",r:1,layout:"inline"},{t:"unit",c:"--sp-radius",label:"Corner radius",layout:"inline",r:1,units:C.radius}]}}};function zo(e){for(let t of M.pages){if(t.collection)continue;let r=!1;if(ie(t.tree,a=>{a.type==="list"&&a.src===e&&(r=!0)}),r)return t}return null}function Wn(e,t={},r="Home"){if(!e)return[];let a=M.pages.find(bt)||null,i=[];if(a&&!bt(e)&&i.push({label:r||a.name,href:wi+".html"}),t.col&&t.item){let o=zo(t.col.id);return o&&i.push({label:o.name,href:o.slug+".html"}),i.push({label:Os(t.col,t.item)||t.item.slug,href:""}),i}let n=t.pageNo||1;return n>1?(i.push({label:e.name,href:e.slug+".html"}),i.push({label:`Page ${n}`,href:""}),i):(bt(e)?i.push({label:r||e.name,href:""}):i.push({label:e.name,href:""}),i)}function _o(e){let t=!1;return e.forEach(r=>ie(r,a=>{a.type==="crumbs"&&a.props.mode!=="manual"&&(t=!0)})),t}var yt={text:{label:"Plain text"},html:{label:"HTML",markup:1},css:{label:"CSS",block:["/*","*/"],keys:1,calls:1},js:{label:"JavaScript",line:"//",block:["/*","*/"],calls:1,words:"const let var function return if else for while of in new class extends super import export from default await async try catch finally throw typeof instanceof delete void yield switch case break continue do this null undefined true false"},ts:{label:"TypeScript",line:"//",block:["/*","*/"],calls:1,words:"const let var function return if else for while of in new class extends super import export from default await async try catch finally throw typeof instanceof delete void yield switch case break continue do this null undefined true false interface type enum implements readonly public private protected as satisfies keyof namespace declare"},json:{label:"JSON",keys:1,words:"true false null"},sh:{label:"Shell",line:"#",words:"if then elif else fi for in do done while until case esac function return export local readonly cd echo printf set unset source exit sudo"},py:{label:"Python",line:"#",calls:1,words:"def class return if elif else for while in not and or is None True False import from as with try except finally raise lambda yield pass break continue global nonlocal assert del await async match"}};function ye(e,t){return t.split(`
`).map(r=>r===""?"":`<span class="pc-c-${e}">${s(r)}</span>`).join(`
`)}function jo(e){let t=/^(<\/?)([A-Za-z][\w:-]*)([\s\S]*?)(\/?>)$/.exec(e);if(!t)return s(e);let r=t[3],a="",i=0,n,o=/([A-Za-z_:][\w:.-]*)(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)?/g;for(;n=o.exec(r);)n.index>i&&(a+=s(r.slice(i,n.index))),a+=ye("key",n[1])+s(n[2]||""),n[3]&&(a+=ye("str",n[3])),i=n.index+n[0].length;return s(t[1])+ye("kw",t[2])+a+s(r.slice(i))+s(t[4])}function Ho(e){let t=[],r=/<!\x2D\x2D[\s\S]*?\x2D\x2D>|<![A-Za-z][^>]*>|<\/?[A-Za-z][\w:-]*(?:"[^"]*"|'[^']*'|[^>"'])*\/?>/g,a=0,i;for(;i=r.exec(e);){i.index>a&&t.push(s(e.slice(a,i.index)));let n=i[0];t.push(n.startsWith("<!-")?ye("com",n):n.startsWith("<!")?ye("kw",n):jo(n)),a=i.index+n.length}return t.push(s(e.slice(a))),t.join("")}function Vo(e,t){let r=String(e??"").replace(/\r/g,""),a=yt[String(t||"text")]||yt.text;if(a.markup)return Ho(r);if(!a.line&&!a.block&&!a.words&&!a.keys)return s(r);let i=new Set((a.words||"").split(/\s+/).filter(Boolean)),n=[],o=0;for(;o<r.length;){let c=r.slice(o);if(a.block&&c.startsWith(a.block[0])){let w=r.indexOf(a.block[1],o+a.block[0].length),D=w<0?r.length:w+a.block[1].length;n.push(ye("com",r.slice(o,D))),o=D;continue}if(a.line&&c.startsWith(a.line)){let w=r.indexOf(`
`,o),D=w<0?r.length:w;n.push(ye("com",r.slice(o,D))),o=D;continue}let f=c[0];if(f==='"'||f==="'"||f==="`"){let w=o+1;for(;w<r.length;){if(r[w]==="\\"){w+=2;continue}if(r[w]===f){w++;break}w++}let D=Math.min(w,r.length),N=a.keys&&/^\s*:/.test(r.slice(D));n.push(ye(N?"key":"str",r.slice(o,D))),o=D;continue}let m=/^\d[\w.]*/.exec(c);if(m){n.push(ye("num",m[0])),o+=m[0].length;continue}let d=/^[A-Za-z_$@][\w$-]*/.exec(c);if(d){let w=d[0],D=c.slice(w.length);i.has(w)?n.push(ye("kw",w)):a.keys&&/^\s*:/.test(D)?n.push(ye("key",w)):a.calls&&/^\s*\(/.test(D)?n.push(ye("fn",w)):n.push(s(w)),o+=w.length;continue}let E=/^[^\w$@'"`]+/.exec(c),P=E?E[0]:c[0];if(E&&a.block){let w=P.indexOf(a.block[0]);w>0&&(P=P.slice(0,w))}if(E&&a.line){let w=P.indexOf(a.line);w>0&&(P=P.slice(0,w))}n.push(s(P)),o+=P.length}return n.join("")}var Wo=`<script>
(function(){var rm=matchMedia('(prefers-reduced-motion: reduce)');
Array.prototype.forEach.call(document.querySelectorAll('[data-slides]'),function(t){
function seek(left){t.scrollTo({left:left,behavior:rm.matches?'auto':'smooth'});}
t.addEventListener('keydown',function(event){if(event.target!==t||event.key!=='Home'&&event.key!=='End')return;
event.preventDefault();seek(event.key==='Home'?0:Math.max(0,t.scrollWidth-t.clientWidth));});});
Array.prototype.forEach.call(document.querySelectorAll('[data-slider]'),function(box){
var t=box.querySelector('[data-slides]'),p=box.querySelector('[data-slide-p]'),n=box.querySelector('[data-slide-n]'),d=box.querySelector('[data-slide-dots]');
var prog=box.querySelector('[data-slide-progress]'),fill=box.querySelector('[data-slide-progress-fill]');
var isProg=box.getAttribute('data-pagination')==='progress';
if(!t||!p||!n||!d)return;p.removeAttribute('hidden');n.removeAttribute('hidden');
if(isProg&&prog){prog.removeAttribute('hidden');d.setAttribute('hidden','');}else{d.removeAttribute('hidden');if(prog)prog.setAttribute('hidden','');}
function go(dir){t.scrollBy({left:dir*t.clientWidth*0.9,behavior:rm.matches?'auto':'smooth'});}
p.addEventListener('click',function(){go(-1);});n.addEventListener('click',function(){go(1);});
var slides=[].slice.call(t.children),targets=[],dots=[];
function positions(){var max=Math.max(0,t.scrollWidth-t.clientWidth),next=[];
slides.forEach(function(slide){var target=Math.min(max,Math.max(0,slide.offsetLeft-t.offsetLeft));
if(!next.some(function(value){return Math.abs(value-target)<3;}))next.push(target);});return next;}
function active(){if(!targets.length)return;var current=0,distance=Infinity;
targets.forEach(function(target,index){var delta=Math.abs(t.scrollLeft-target);if(delta<distance){distance=delta;current=index;}});
dots.forEach(function(dot,index){if(index===current)dot.setAttribute('aria-current','true');else dot.removeAttribute('aria-current');});
if(fill){var max=Math.max(0,t.scrollWidth-t.clientWidth);var pct=max>0?Math.max(8,Math.min(100,((t.scrollLeft/max)*100))):100;fill.style.width=pct.toFixed(1)+'%';}}
function rebuild(){targets=positions();d.replaceChildren();dots=targets.map(function(target,index){
var dot=document.createElement('button');function seek(){t.scrollTo({left:target,behavior:rm.matches?'auto':'smooth'});}
dot.type='button';dot.className='pagecraft-slider-dot';dot.setAttribute('aria-label','Go to carousel position '+(index+1)+' of '+targets.length);
if(t.id)dot.setAttribute('aria-controls',t.id);dot.addEventListener('click',seek);dot.addEventListener('keydown',function(event){
if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();seek();});d.appendChild(dot);return dot;});active();}
function update(){var max=t.scrollWidth-t.clientWidth-2;p.disabled=t.scrollLeft<=2;n.disabled=t.scrollLeft>=max;active();}
var drag=null,suppressClick=false;
t.addEventListener('pointerdown',function(e){
if(e.pointerType!=='mouse'||e.button!==0)return;
if(e.target&&e.target.closest&&e.target.closest('button,a,input,textarea,select'))return;
drag={startX:e.clientX,startScroll:t.scrollLeft,lastX:e.clientX,lastT:performance.now(),vel:0,moved:false,id:e.pointerId};
});
t.addEventListener('pointermove',function(e){
if(!drag)return;var dx=e.clientX-drag.startX;
if(!drag.moved&&Math.abs(dx)>4){drag.moved=true;t.setAttribute('data-dragging','1');try{t.setPointerCapture(drag.id);}catch(_){}}
if(!drag.moved)return;
var now=performance.now();drag.vel=(e.clientX-drag.lastX)/Math.max(1,now-drag.lastT);
drag.lastX=e.clientX;drag.lastT=now;
t.scrollLeft=drag.startScroll-dx;
});
function endDrag(){
if(!drag)return;var d0=drag;drag=null;t.removeAttribute('data-dragging');
try{t.releasePointerCapture(d0.id);}catch(_){}
if(!d0.moved)return;
suppressClick=true;setTimeout(function(){suppressClick=false;},60);
var max=Math.max(0,t.scrollWidth-t.clientWidth);
var proj=Math.max(0,Math.min(max,t.scrollLeft-d0.vel*180));
var best=proj,bestDist=Infinity;
targets.forEach(function(tg){var dist=Math.abs(tg-proj);if(dist<bestDist){bestDist=dist;best=tg;}});
t.scrollTo({left:best,behavior:rm.matches?'auto':'smooth'});
}
t.addEventListener('pointerup',endDrag);t.addEventListener('pointercancel',endDrag);
t.addEventListener('click',function(e){if(suppressClick){e.preventDefault();e.stopPropagation();}},true);
var queued=false;t.addEventListener('scroll',function(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;update();});},{passive:true});
addEventListener('resize',function(){rebuild();update();});addEventListener('load',function(){rebuild();update();},{once:true});rebuild();update();});})();
<\/script>
`,Uo=`<script>
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
`;function Yo(e){let t=String(e??"").replace(/\r/g,""),r=t.split(`
`).filter(o=>o.trim()!=="");if(!r.length)return[];let a=t.includes("	")?"	":"|",i=r.map(o=>o.split(a).map(c=>c.trim())),n=i.reduce((o,c)=>Math.max(o,c.length),0);return i.map(o=>o.concat(Array(n-o.length).fill("")))}function Ge(e,t){let r=[],a=i=>{if(!i)return;["d","t","m"].forEach(o=>r.push(i.css&&i.css[o]));let n=i.st||{};Object.keys(n).forEach(o=>["d","t","m"].forEach(c=>r.push(n[o]&&n[o][c])))};a(ks(e)),Me(e).forEach(i=>a(i));for(let i of r)if(i&&i[t])return String(i[t]);return""}var Kt=e=>!!(Ge(e,"background-image")||Ge(e,"background"));function ft(e){return!/^(absolute|fixed)$/.test(Ge(e,"position").trim())}function Go(e){return/^(cover|none)$/.test(Ge(e,"object-fit").trim())}function on(e){let t=St(e.id),r=t?ne(t):null;return!r||r.node.type!=="slider"}function Ko(e){let t=St(e.id);for(;t;){let r=ne(t);if(!r)break;if(r.node.type==="filter")return!0;t=r.parent?r.parent.id:null}return!1}var zc=[{g:"Spacing",cap:"spacing",items:[{t:"box",c:"padding",label:"Padding",r:1},{t:"box",c:"margin",label:"Margin",r:1,neg:1}]},{g:"Background",cap:"decoration",items:[{t:"color",c:"background-color",label:"Colour",r:1,paint:1},{t:"img",c:"background-image",label:"Image",r:1,bg:1},{t:"select",c:"background-size",label:"Size",r:1,when:Kt,opts:[["","Default"],["cover","Cover"],["contain","Contain"],["auto","Auto"]]},{t:"pick",c:"background-position",label:"Position",r:1,when:Kt,opts:[["left center","alignL"],["center center","alignC"],["right center","alignR"],["top center","vTop"],["bottom center","vBot"]]},{t:"select",c:"background-repeat",label:"Repeat",r:1,when:Kt,opts:[["","Default"],["no-repeat","No repeat"],["repeat","Repeat"]]}]},{g:"Border & shadow",cap:"decoration",items:[{t:"border",label:"Border"},{t:"unit",c:"border-radius",label:"Radius",r:1,units:C.radius},{t:"opt",c:"box-shadow",label:"Shadow",r:1,opts:Fo,ph:"0 20px 40px -12px rgba(17,19,17,.2)"}]},{g:"Effects",cap:"effects",items:[{t:"slider",c:"opacity",label:"Opacity",r:1,min:0,max:1,step:.01,raw:1},{t:"text",c:"transform",label:"Transform",r:1,ph:"translateY(-4px) rotate(2deg)"}]}];var Zo={desktop:"d",tablet:"t",mobile:"m"};function Jo(){return{mode:"page",dev:"desktop",sel:null,multi:[],tab:"add",atab:"widgets",stab:"content",target:"",lmode:null,open:{},collapsed:{},custom:{},zoom:"fit",pno:1,st:""}}var M={v:1,meta:{name:"Untitled project",maxWidth:"1200px",font:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",headFont:"",size:"16px",css:"",headHtml:"",lang:"en",baseUrl:"",ogImage:"",favicon:"",blocks:[],tokens:null},header:[],footer:[],pages:[],cur:0,ui:Jo()},Un=()=>({schemaVersion:fe,meta:M.meta,header:M.header,footer:M.footer,pages:M.pages}),Qt=()=>M.pages[M.cur]||M.pages[0];function Fe(e){return[e.tree,...Array.isArray(e.header)?[e.header]:[],...Array.isArray(e.footer)?[e.footer]:[]]}function de(e,t){return e?.[t]===null?[]:e?.[t]??M[t]}function Xo(e,t){return e[t]===void 0?"shared":e[t]===null?"hidden":"custom"}var Qo=()=>{if(M.ui.mode==="component"){let e=De(M.ui.cedit);return e?[e.node]:[]}return M.ui.mode==="header"||M.ui.mode==="footer"?de(Qt(),M.ui.mode):Qt().tree},Yn=()=>Zo[M.ui.dev];function ne(e,t=Qo(),r=null){for(let a=0;a<t.length;a++){if(t[a].id===e)return{node:t[a],list:t,parent:r,i:a};let i=ne(e,t[a].children||[],t[a]);if(i)return i}return null}function es(e){for(let[t,r]of[["header",M.header],["footer",M.footer]]){let a=ne(e,r,null);if(a)return{...a,mode:t}}for(let t=0;t<M.pages.length;t++)for(let[r,a]of[["page",M.pages[t].tree],["header",M.pages[t].header],["footer",M.pages[t].footer]]){let i=a&&ne(e,a,null);if(i)return{...i,mode:r,page:t}}return null}function ie(e,t,r=null,a=0){e.forEach((i,n)=>{t(i,r,n,a),ie(i.children||[],t,i,a+1)})}function ts(){let e=[];M.ui.sel&&e.push(M.ui.sel);for(let t of M.ui.multi||[])e.includes(t)||e.push(t);return e.filter(t=>ne(t))}function rs(e){let t=e.filter(a=>ne(a)),r=M.ui.sel;M.ui.sel=t.length?t[0]:null,M.ui.multi=t.slice(1),M.ui.sel!==r&&(M.ui.st="")}var sn={change(){},save(){},note(){}};function br(e,t=!1){let r=t?M.ui.mobileMenuOwner:null;M.meta=e.meta,M.header=e.header,M.footer=e.footer,M.pages=e.pages,M.ui.mobileMenuOwnerPending=null,M.ui.mobileMenuOwner=r,r&&Ei(r.menuComponentId),M.cur>=M.pages.length&&(M.cur=0),(M.ui.mode==="header"||M.ui.mode==="footer")&&Xo(Qt(),M.ui.mode)==="hidden"&&(M.ui.mode="page"),rs(ts()),sn.change(),sn.save()}function as(e){let t=new Map;return ie([e],r=>{let a=yo();t.set(r.id,a),r.id=a,r.adv&&(r.adv.htmlId="")}),ie([e],r=>{r.type==="tabs"&&Et(r).forEach(a=>{a.panelId&&t.has(a.panelId)&&(a.panelId=t.get(a.panelId))})}),e}function Et(e){return Array.isArray(e.props.items)?e.props.items:[]}function yr(e){return e.type==="tabs"&&(!!e.children.length||Et(e).some(t=>t?.panelId!==void 0))}function ns(e){if(e.type!=="tabs"||!yr(e))return null;let t=Et(e),r=new Set;if(!t.length||t.length!==e.children.length)return"Tab panels must match their labels.";for(let a of t){if(!a||typeof a.panelId!="string"||!a.panelId||r.has(a.panelId)||a.panel!==void 0)return"Each tab must reference one unique editable panel.";if(!e.children.some(i=>i.type==="box"&&i.id===a.panelId))return"A tab references a missing panel Box.";r.add(a.panelId)}return null}function is(e){return Et(e).map(t=>e.children.find(r=>r.id===t.panelId)).filter(t=>!!t)}var Gn={d:["d"],t:["t","d"],m:["m","t","d"]};function vt(e,t,r){for(let a of Gn[t]||["d"]){let i=((e.css||{})[a]||{})[r];if(i!==void 0&&i!=="")return i;let n=Me(e);for(let o=n.length-1;o>=0;o--){let c=((n[o].css||{})[a]||{})[r];if(c!==void 0&&c!=="")return c}}return""}function Kn(e,t){if(!e||e.type!=="row")return"flex-start";let r=vt(e,t,"align-items");return r==="center"||r==="flex-end"?r:"flex-start"}function os(e){let t=es(e.id),r=Kn(t&&t.parent?t.parent:null,Yn());return r==="center"?"Center":r==="flex-end"?"Bottom":"Top"}var x=e=>`var(--c-${e})`;var ss=e=>{let t=String(e||"").trim().match(/^var\(--c-([\w-]+)\)$/);return t?t[1]:null},Zn=()=>M.meta.tokens&&M.meta.tokens.colors||[],vr=()=>M.meta.tokens&&M.meta.tokens.text||[];var At=()=>M.meta.tokens&&M.meta.tokens.classes||[],Ke=e=>Zn().find(t=>t.id===e)||null,er=e=>vr().find(t=>t.id===e)||null,ls=e=>At().find(t=>t.id===e)||null,Me=e=>{let t=Array.isArray(e.cls)?e.cls:[];return At().filter(r=>t.includes(r.id))},ln=e=>{let t=ss(e);if(!t)return String(e||"");let r=Ke(t)||(t==="brand"?Ke("accent"):null);return r?r.value:""},cs=()=>!Ke("brand")&&!!Ke("accent");function cn(e={}){return{classes:[],colors:[{id:"text",name:"Body text",value:e.color||"#111311"},{id:"bg",name:"Page background",value:e.bg||"#f8f6ef"},{id:"brand",name:"Craft Green",value:e.accent||"#b7f34a"},{id:"ink",name:"Ink",value:"#111311"},{id:"muted",name:"Slate (on Paper)",value:"#5f6660"},{id:"muted-i",name:"Slate (on Ink)",value:"#b0b7b1"},{id:"slate",name:"Slate (brand)",value:"#6f7771"},{id:"line",name:"Hairline",value:"#e5e1d6"},{id:"surface",name:"White",value:"#ffffff"}],text:[{id:"display",name:"Display",tag:"h1",css:{d:{"font-size":"58px","font-weight":"600","line-height":".96","letter-spacing":"-.04em",color:x("ink")},t:{"font-size":"44px"},m:{"font-size":"33px"}}},{id:"title",name:"Section title",tag:"h2",css:{d:{"font-size":"38px","font-weight":"600","line-height":"1.05","letter-spacing":"-.035em",color:x("ink")},t:{"font-size":"32px"},m:{"font-size":"27px"}}},{id:"subtitle",name:"Card title",tag:"h3",css:{d:{"font-size":"19px","font-weight":"700","line-height":"1.3",color:x("ink")},t:{},m:{"font-size":"18px"}}},{id:"lead",name:"Lead paragraph",tag:"p",css:{d:{"font-size":"18px","line-height":"1.65",color:x("muted")},t:{},m:{"font-size":"16px"}}},{id:"body",name:"Body",tag:"p",css:{d:{"font-size":"16px","line-height":"1.7",color:x("text")},t:{},m:{"font-size":"15px"}}},{id:"small",name:"Small",tag:"p",css:{d:{"font-size":"14px","line-height":"1.65",color:x("muted")},t:{},m:{}}},{id:"eyebrow",name:"Eyebrow",tag:"div",css:{d:{"font-family":"'DM Sans',system-ui,sans-serif","font-size":"12px","font-weight":"500","letter-spacing":".04em","text-transform":"uppercase",color:x("muted")},t:{},m:{}}},{id:"btn",name:"Button label",css:{d:{"font-size":"15px","font-weight":"600","letter-spacing":"0em"},t:{},m:{}}}]}}function us(){let e=Zn().map(r=>`--c-${r.id}:${r.value}`);cs()&&e.push(`--c-brand:${x("accent")}`);let t=e.join(";");return t?`:root{${t}}`:""}var ds=e=>e==="background"||e==="background-color"||e==="background-image"||/^border(?:-|$)/.test(e)||/^padding(?:-|$)/.test(e),xt="--pc-authored-button-",Ze="--pc-button-variant-owns-",Zt=["top","right","bottom","left"],ps=["top-left","top-right","bottom-right","bottom-left"],rt=e=>{if(e==="background")return["background-color","background-image"];if(e==="background-color"||e==="background-image")return[e];if(e==="padding")return Zt.map(a=>`padding-${a}`);if(/^padding-(?:top|right|bottom|left)$/.test(e))return[e];if(e==="border-radius")return ps.map(a=>`border-${a}-radius`);if(/^border-(?:top-left|top-right|bottom-right|bottom-left)-radius$/.test(e))return[e];if(e==="border")return Zt.flatMap(a=>["width","style","color"].map(i=>`border-${a}-${i}`));let t=e.match(/^border-(width|style|color)$/);if(t)return Zt.map(a=>`border-${a}-${t[1]}`);let r=e.match(/^border-(top|right|bottom|left)$/);return r?["width","style","color"].map(a=>`border-${r[1]}-${a}`):/^border-(?:top|right|bottom|left)-(?:width|style|color)$/.test(e)?[e]:[]},fs=e=>{let t=[],r="",a=0,i="",n=!1;for(let o of e.trim()){if(n){r+=o,n=!1;continue}if(o==="\\"){r+=o,n=!0;continue}if(i){r+=o,o===i&&(i="");continue}if(o==='"'||o==="'"){i=o,r+=o;continue}o==="("&&a++,o===")"&&(a=Math.max(0,a-1)),/\s/.test(o)&&!a?r&&(t.push(r),r=""):r+=o}return r&&t.push(r),t},Jn=e=>{let t=fs(e);return!t.length||t.length>4||e.includes("/")?null:t.length===1?[t[0],t[0],t[0],t[0]]:t.length===2?[t[0],t[1],t[0],t[1]]:t.length===3?[t[0],t[1],t[2],t[1]]:[t[0],t[1],t[2],t[3]]},gs=e=>{let t={};for(let[r,a]of Object.entries(e)){let i=rt(r);if(i.length===1)t[i[0]]=a;else if(r==="padding"||r==="border-width"||r==="border-style"||r==="border-color"||r==="border-radius"){let n=Jn(a);n&&i.forEach((o,c)=>{t[o]=n[c]})}}return t},Xn=e=>e==="border"?0:/^border-(width|style|color)$/.test(e)?1:/^border-(top|right|bottom|left)$/.test(e)?2:/^border-(top|right|bottom|left)-(width|style|color)$/.test(e)?3:4,un=(e,t)=>{let r=null;for(let[a,i]of Object.entries(e)){if(a.startsWith(xt)||a.startsWith(Ze)||i===""||!rt(a).includes(t))continue;let o=Xn(a);(!r||o>=r.rank)&&(r={property:a,value:i,rank:o})}return r},dn=(e,t)=>{let r=rt(e.property);if(r.length===1)return{property:t,value:e.value};if(e.property==="padding"||e.property==="border-width"||e.property==="border-style"||e.property==="border-color"||e.property==="border-radius"){let a=Jn(e.value);if(a)return{property:t,value:a[r.indexOf(t)]}}return{property:e.property,value:e.value}},ms=(e,t)=>{let r=new Set;for(let a of Gn[t])for(let i of Me(e))Object.keys(i.css[a]).forEach(n=>rt(n).forEach(o=>r.add(o)));return r};var hs=e=>new Set(Object.keys(e).filter(t=>t.startsWith(Ze)&&e[t]==="1").map(t=>t.slice(Ze.length)));var Qn=e=>`${e}:where(.pagecraft-gallery):has(:where(.pagecraft-gallery-frame):focus-visible)`,ei=e=>`${e}:where(.pagecraft-nav-menu):has(:focus-visible)`,xr=e=>`${e}:where(.pagecraft-wysiwyg):has(:where(a):focus-visible)`,ti=e=>`${e}:where(.pagecraft-video):has(:where(.pagecraft-video-play,video,iframe):focus-visible,:where(iframe[data-pagecraft-keyboard-focus]):focus-within)`,ri=e=>`${e}:where(.pagecraft-tabs):has(>:where(.pagecraft-tablist)>:where(.pagecraft-tab):focus-visible)`,ai=e=>`${e}:where(.pagecraft-accordion):has(>:where(.pagecraft-accordion-item)>:where(.pagecraft-accordion-q):focus-visible)`,ni=e=>`${e}:where(.pagecraft-form):has(>:where(.pagecraft-field)>:where(input,textarea,select):focus-visible,>:where(.pagecraft-field)>:where(.pc-select)>:where(.pc-select-button):focus-visible,>:where(.pagecraft-field)>:where(.pc-date)>:where(.pc-date-control)>:where(.pc-date-input,.pc-date-trigger):focus-visible,>:where(.pagecraft-form-button):focus-visible)`,ii=e=>`${e}:where(.pagecraft-code):has(>:where(.pagecraft-code-head)>:where(.pagecraft-code-copy):focus-visible)`,Ct=(e,t="")=>`${e}:where(.pagecraft-wysiwyg)${t} a`,wr=(e,t,r)=>t==="focus"?`${xr(e)} a`:Ct(e,r),oi=(e,t=null,r=new Set,a=new Set)=>{let i={};for(let[n,o]of Object.entries(e))!ds(n)||a.has(n)||t&&Object.prototype.hasOwnProperty.call(t,n)&&t[n]===o&&!r.has(n)||(i[n]=o);return i};function wt(e){let t=e==="nowrap";return`--pc-list-item-shrink:${t?"0":"1"};--pc-list-overflow-x:${t?"auto":"visible"};--pc-list-min-width:${t?"0":"auto"};--pc-list-max-width:${t?"100%":"none"};--pc-list-padding:${t?"8px":"0"}`}function pn(e){return[e,...Me(e)].some(t=>[t.css,...Object.values(t.st||{})].some(r=>["d","t","m"].some(a=>r?.[a]?.["flex-wrap"]==="nowrap")))}function si(){let e={d:"",t:"",m:""};return vr().forEach(t=>["d","t","m"].forEach(r=>{let a=Z(t.css&&t.css[r]||{});a&&(e[r]+=`.ts-${t.id}{${a}}`)})),At().forEach(t=>["d","t","m"].forEach(r=>{let a=t.css&&t.css[r]||{},i=Z(a);i&&(e[r]+=`.c-${t.id}{${i}}`),a["flex-wrap"]&&(e[r]+=`.c-${t.id}:where(.pagecraft-list){${wt(a["flex-wrap"])}}`);let n=Z({color:a["--link"]});n&&(e[r]+=`${Ct(`.c-${t.id}`)}{${n}}`);let o=Z(oi(a));o&&(e[r]+=`.c-${t.id}.pagecraft-button{${o}}`),kr.forEach(([c,,f])=>{let m=t.st&&t.st[c]&&t.st[c][r]||{},d=Z(m);if(d){e[r]+=`.c-${t.id}${f}{${d}}`,m["flex-wrap"]&&(e[r]+=`.c-${t.id}${f}:where(.pagecraft-list){${wt(m["flex-wrap"])}}`),c==="focus"&&(e[r]+=`${Qn(`.c-${t.id}`)}{${d}}`,e[r]+=`${ei(`.c-${t.id}`)}{${d}}`,e[r]+=`${xr(`.c-${t.id}`)}{${d}}`,e[r]+=`${ti(`.c-${t.id}`)}{${d}}`,e[r]+=`${ri(`.c-${t.id}`)}{${d}}`,e[r]+=`${ai(`.c-${t.id}`)}{${d}}`,e[r]+=`${ni(`.c-${t.id}`)}{${d}}`,e[r]+=`${ii(`.c-${t.id}`)}{${d}}`);let E=Z({color:m["--link"]});if(E){let P=wr(`.c-${t.id}`,c,f);e[r]+=`${P}{${E}}`}}})})),e}function bs(){return[M.header,M.footer,...M.pages.flatMap(Fe),...Si().map(e=>[e.node])]}function li(e,t){return String(e&&e.name||"").trim()||zn(e&&e.label)||"field-"+(t+1)}function ys(e){let t=new Set(e),r=new Map;for(let i of e)r.set(i,(r.get(i)||0)+1);let a=new Map;return e.map(i=>{if(r.get(i)===1)return i;let n=a.get(i)||1;for(;t.has(i+"-"+n);)n++;return a.set(i,n+1),i+"-"+n})}var vs=["form","dockbar","slotpicker"],fn=e=>vs.includes(e),kt=e=>[...new Set(e.map(t=>String(t??"").replace(/\s*,\s*/g," ").trim()).filter(Boolean))];function ci(e,t){return e==="dockbar"&&(!Array.isArray(t.fields)&&Array.isArray(t.items)&&(t.fields=t.items.filter(Boolean).map(r=>({type:r.fieldType==="select"&&String(r.choices||"").trim()?"select":"text",label:String(r.fieldLabel||"Field"),name:"",required:0,...r.fieldType==="select"?{opts:String(r.choices||"")}:{ph:String(r.ph||"")}}))),t.submit===void 0&&t.submitLabel!==void 0&&(t.submit=t.submitLabel),t.aria===void 0&&t.ariaLabel!==void 0&&(t.aria=t.ariaLabel),["items","submitLabel","ariaLabel","destHref"].forEach(r=>delete t[r])),e==="slotpicker"&&(!Array.isArray(t.slots)&&t.timeSlots!==void 0&&(t.slots=String(t.timeSlots).split(",").map(r=>({time:r.trim()})).filter(r=>r.time)),t.submit===void 0&&t.confirmLabel!==void 0&&(t.submit=t.confirmLabel),t.note===void 0&&t.phoneNote!==void 0&&(t.note=t.phoneNote),["timeSlots","confirmLabel","confirmHref","phoneNote"].forEach(r=>delete t[r]),Array.isArray(t.fields)||(t.fields=ui())),t}var ui=()=>[{type:"date",label:"Date",name:"date",required:1,ph:""},{type:"text",label:"Name",name:"name",required:1,ph:""},{type:"email",label:"Email",name:"email",required:1,ph:""}],at=(e,t)=>e==="form"?t:ci(e,{...t});function di(e){let t=at("slotpicker",e),r=c=>c===void 0||Number(c)===1||c===!0,a=[],i=kt((Array.isArray(t.passes)?t.passes:[]).map(c=>c?.passName));i.length&&a.push({key:"service",label:String(t.serviceLabel||"Service"),heading:String(t.passHeading??"Choose a service"),values:i});let n=Math.max(1,Math.min(50,Math.round(Number(t.maxGuests)||2)));r(t.showGuests)&&a.push({key:"guests",label:String(t.guestLabel||"Guests"),heading:String(t.guestHeading??"Guests"),values:Array.from({length:n},(c,f)=>String(f+1))});let o=kt((Array.isArray(t.slots)?t.slots:[]).map(c=>c?.time));return r(t.showTimes)&&o.length&&a.push({key:"time",label:String(t.timeLabel||"Time"),heading:String(t.slotHeading??"Preferred time"),values:o}),a}var pi=e=>Number.isInteger(e)?String(e):e.toFixed(2);function xs(e,t,r){let a=at("slotpicker",e);if(a.showTotal!==void 0&&!Number(a.showTotal))return"";let i=(Array.isArray(a.passes)?a.passes:[]).find(c=>kt([c?.passName])[0]===t),n=parseFloat(String(i?.unitPrice??""));if(!i||!Number.isFinite(n))return"";let o=Number(i.fixedTotal)?1:Math.max(1,parseInt(r,10)||1);return String(a.currencySymbol??"\u20AC")+pi(n*o)}function gn(e,t){let r=at(e,t),a=Array.isArray(r.fields)?r.fields:[];return e!=="slotpicker"?a:[...di(r).map(i=>({type:"select",label:i.label,name:"booking-"+i.key,required:1,opts:i.values.join(",")})),...a]}function mn(e,t){if(e.kind!=="external"||e.method!=="get")return[];let r=new Set(t.map(li));return Array.from(new URL(e.action).searchParams).filter(([a])=>!r.has(a))}function ws(e){return BigInt(Math.round(e)).toString()}var kr=[["hover","Hover",":hover"],["focus","Focus",":focus-visible"]];function ks(e){let t=M.ui.target,r=t?ls(t):null;return r&&(e.cls||[]).includes(t)?r:e}var Sr="val:";var fi=/asset:([A-Za-z0-9][A-Za-z0-9._:-]*)(?:@(\d+))?/g;var Ss=[480,768,1024,1440,1920];function $s(e){let t=Math.round(parseFloat(String(e||""))||0);if(!(t>0))return[];let r=Ss.filter(a=>a<=t-Es);return r.length?[...r,t]:[]}var Es=160;function As(e){let t=Ps(e),r=t.find(f=>f.type==="section"),a=[...t].reverse().find(f=>f.type==="row"||f.type==="list"),i=[...t].reverse().find(f=>f.type==="column"),o=r&&r.props.width==="full"?0:parseFloat(String(M.meta.maxWidth||"1200"))||1200;if(o&&r&&(o-=(parseFloat(String((r.css.d||{})["padding-left"]||"0"))||0)+(parseFloat(String((r.css.d||{})["padding-right"]||"0"))||0)),!o)return"100vw";if(a&&i){let f=a.children||[],m=P=>parseFloat(String((P.css.d||{})["flex-grow"]||""))||0,d=f.reduce((P,w)=>P+m(w),0),E=m(i);if(d>0&&E>0){let P=parseFloat(String((a.css.d||{}).gap||"0"))||0;o=(o-P*Math.max(0,f.length-1))*(E/d)}}return`(max-width: 767px) 100vw, min(100vw, ${Math.max(1,Math.round(o))}px)`}var gt=(e,t,r)=>e<t?t:e>r?r:e,Cs=e=>{let t=String(e??"").trim(),r=t.match(/^#([0-9a-f]{3,8})$/i);if(r){let n=r[1],o=n.length===3||n.length===4?n.split("").map(m=>m+m).join(""):n;if(o.length!==6&&o.length!==8)return null;let c=parseInt(o.slice(0,6),16),f=o.length===8?parseInt(o.slice(6),16)/255:1;return{r:c>>16&255,g:c>>8&255,b:c&255,a:f}}let a=t.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)?/i);if(!a)return null;let i=a[4]===void 0?1:a[4].endsWith("%")?parseFloat(a[4])/100:parseFloat(a[4]);return{r:gt(Math.round(+a[1]),0,255),g:gt(Math.round(+a[2]),0,255),b:gt(Math.round(+a[3]),0,255),a:gt(isNaN(i)?1:i,0,1)}};var hn=e=>{let t=Cs(e);return t?[t.r,t.g,t.b]:null},bn=e=>{let t=e.map(r=>(r/=255,r<=.03928?r/12.92:Math.pow((r+.055)/1.055,2.4)));return .2126*t[0]+.7152*t[1]+.0722*t[2]};function Jt(e,t){let r=hn(ln(e)),a=hn(ln(t));if(!r||!a)return null;let i=bn(r),n=bn(a);return(Math.max(i,n)+.05)/(Math.min(i,n)+.05)}function Ps(e){let t=[];for(let r=St(e);r;r=St(r)){let a=ne(r);if(!a)break;t.push(a.node)}return t.reverse()}var _c=(()=>{let e=new Uint32Array(256);for(let t=0;t<256;t++){let r=t;for(let a=0;a<8;a++)r=r&1?3988292384^r>>>1:r>>>1;e[t]=r>>>0}return e})();var pe={css:null,st:null,cls:null,ts:"",adv:"",from:""},$r=null,Er=[],Ar=null,Cr=[],Je="pagecraft.styleClip",gi=1;var Pr="";var mi=()=>{try{return typeof localStorage>"u"?null:localStorage}catch{return null}};function Ts(){let e=mi();if(e)try{if(!pe.css){e.removeItem(Je);return}e.setItem(Je,JSON.stringify({v:gi,project:Pr,clip:pe,source:$r,classes:Er,textStyle:Ar,colors:Cr}))}catch{}}var $e=e=>!!e&&typeof e=="object"&&!Array.isArray(e),Ls=e=>$e(e)&&Object.values(e).every(t=>typeof t=="string"),ht=e=>$e(e)&&["d","t","m"].every(t=>Ls(e[t])),yn=e=>e===null||$e(e)&&Object.values(e).every(t=>t===void 0||ht(t)),Ms=e=>Array.isArray(e)&&e.every(t=>typeof t=="string");function hi(){let e=mi();if(!e)return!1;let t=null;try{t=e.getItem(Je)}catch{return!1}if(!t)return!1;let r;try{r=JSON.parse(t)}catch{r=null}let a=r&&r.clip,i=r&&r.source;if(!($e(r)&&r.v===gi&&typeof r.project=="string"&&$e(a)&&ht(a.css)&&yn(a.st??null)&&Ms(a.cls)&&typeof a.ts=="string"&&typeof a.adv=="string"&&typeof a.from=="string"&&$e(i)&&typeof i.id=="string"&&typeof i.type=="string"&&Array.isArray(r.classes)&&r.classes.every(f=>$e(f)&&typeof f.id=="string"&&ht(f.css)&&yn(f.st??null))&&(r.textStyle===null||$e(r.textStyle)&&typeof r.textStyle.id=="string"&&ht(r.textStyle.css))&&Array.isArray(r.colors)&&r.colors.every(f=>$e(f)&&typeof f.id=="string"&&typeof f.literal=="string"))){try{e.removeItem(Je)}catch{}return!1}let o=r.clip,c=r.source;return pe.css=o.css,pe.st=o.st??null,pe.cls=o.cls,pe.ts=o.ts,pe.adv=o.adv,pe.from=o.from,$r={id:c.id,type:c.type,props:{},css:o.css,st:o.st??void 0,cls:o.cls,hide:{},adv:{htmlId:"",cls:"",css:""},children:[]},Er=r.classes,Ar=r.textStyle,Cr=r.colors,Pr=r.project,!0}function Is(){pe.css=null,pe.st=null,pe.cls=null,pe.ts="",pe.adv="",pe.from="",$r=null,Er=[],Ar=null,Cr=[],Pr="",Ts()}hi();try{typeof window<"u"&&window.addEventListener&&window.addEventListener("storage",e=>{e.key===Je&&!hi()&&e.newValue===null&&Is()})}catch{}var Ds=()=>M.meta.collections||(M.meta.collections=[]),ke=e=>Ds().find(t=>t.id===e)||null,nt=(e,t)=>e&&(e.fields||[]).find(r=>r.id===t)||null,bi=(e,t)=>e&&(e.items||[]).find(r=>r.id===t)||null;var Rs=e=>e&&(e.fields||[]).find(t=>t.type==="text")||null,Os=(e,t)=>{let r=Rs(e);return String(r&&t.values[r.id]||"").trim()||"Untitled"};var yi=e=>(e&&e.items||[]).filter(t=>!t.draft);function Ns(e,t,r,a,i){let n=r?nt(e,r):null;if(!n)return!0;let o=String(t.values[n.id]??"").trim(),c=String(i??"").trim();if(a==="set")return o!=="";if(a==="unset")return o==="";if(c==="")return!0;if(a==="has")return o.toLowerCase().includes(c.toLowerCase());let f=d=>{let E=d.toLowerCase();return["1","true","yes"].includes(E)?!0:["0","false","no"].includes(E)?!1:null},m=n.type==="number"?parseFloat(o)===parseFloat(c):n.type==="bool"?(()=>{let d=f(o),E=f(c);return d!==null&&E!==null?d===E:o.toLowerCase()===c.toLowerCase()})():o.toLowerCase()===c.toLowerCase();return a==="not"?!m:m}function vi(e,t){let r=e.props,a=yi(t).filter(c=>Ns(t,c,r.where,r.op,r.val)),i=e.props.sort?nt(t,e.props.sort):null;i&&a.sort((c,f)=>{let m=c.values[i.id]??"",d=f.values[i.id]??"";return i.type==="number"?(parseFloat(m)||0)-(parseFloat(d)||0):String(m).localeCompare(String(d))}),e.props.dir==="desc"&&a.reverse();let n=parseInt(String(e.props.per||""),10),o=parseInt(e.props.limit||"",10);return o>0&&!(n>0)?a.slice(0,o):a}function ue(e,t){let r=String(e||"");if(r==="cms:item"){if(!t||!t.col||!t.item)return"";r=t.col.slug+"/"+t.item.slug+".html"}let a=Bn(r);return a?ko(a):r.startsWith(Nn)?"":(r=xe(r),!r||!t||!t.rel||/^([a-z][\w+.-]*:|\/\/|\/|#)/i.test(r)?r:t.rel+r)}function vn(e,t){return!!e.decorative&&!!ue(e.link,t)&&!String(e.label||"").trim()&&!!String(e.caption||"").trim()}var xi=e=>{let t=e.anim;return t&&t.name&&Vr.includes(t.name)?t:null};function Fs(e){let t=xi(e);if(!t)return{cls:"",at:""};let r=(a,i)=>i?` ${a}="${s(i)}"`:"";return{cls:` bp-animate ${"pc-"}${t.name}`,at:r("bp-duration",t.dur)+r("bp-delay",t.delay)+r("bp-easing",t.ease)+(t.once?' bp-animation-once="true"':"")}}var tr=e=>{let t=!1;return[...e,...it(e).map(r=>[r.node])].forEach(r=>ie(r,a=>{!t&&xi(a)&&(t=!0)})),t},Bs="html:has(.bp-animate:not(.bp-is-done-animating)){overflow-x:clip}",rr="@media (prefers-reduced-motion:reduce){.bp-animate,.bp-animate.bp-is-hidden{opacity:1 !important;transform:none !important;animation:none !important}}"+Bs;var wi="index",bt=e=>e.slug===wi;var qs="404",xn=e=>e.slug===qs;var Tr=(e,t)=>t<=1?e+".html":`${e}/page-${t}.html`;function zs(e,t){let r=parseInt(String(e.props.per||""),10);return r>0?Math.max(1,Math.ceil(vi(e,t).length/r)):1}function _s(e){let t=null;return ie(e.tree,r=>{if(r.type!=="list")return;let a=parseInt(String(r.props.per||""),10),i=r.src?ke(r.src):null;!(a>0)||!i||(t?t.extra++:t={node:r,col:i,extra:0})}),t}var js=e=>!!(e.collection&&ke(e.collection));var Xe=(e,t)=>(e.bind||{})[t]||null;var Lr=(e,t)=>{let r=Xe(e,t);return r&&r.src==="field"?r.path:""};var Hs=e=>(M.ui.item||(M.ui.item={}))[e]||0;function Vs(e){return!e||!e.items.length?null:e.items[Math.min(Hs(e.id),e.items.length-1)]}var Ws=(e,t,r,a)=>a&&t===e?r:Vs(e),ki=4,Pt=(e,t,r,a=0)=>{if(!e||!t)return"";let i=String(r||"").split("."),n=nt(e,i[0]);if(!n)return"";let o=t.values[n.id],c=o??"";if(i.length===1)return c;if(n.type!=="ref"||!n.ref||a>=ki)return"";let f=ke(n.ref),m=f?bi(f,c):null;return m&&!m.draft?Pt(f,m,i.slice(1).join("."),a+1):""},Qe=(e,t,r=0)=>{if(!e)return null;let a=String(t||"").split("."),i=nt(e,a[0]);return!i||a.length===1?i||null:i.type!=="ref"||!i.ref||r>=ki?null:Qe(ke(i.ref),a.slice(1).join("."),r+1)};var Us=(e,t)=>(((Le[e]||{}).controls||{}).content||[]).some(r=>r.t==="rich"&&r.k===t),wn=(e,t)=>t&&t.type==="rich"?He(e):$t(e);function Ys(e,t,r,a,i){if(!e.bind)return e.props;let n={...e.props},o=(c,f)=>(Le[e.type]?.controls.content||[]).some(m=>m.k===c&&m.t==="toggle")?+!["","0","false"].includes(String(f??"")):f;for(let[c,f]of Object.entries(e.bind)){let m=Us(e.type,c);if(f.src==="prop"){if(!a)continue;let E=Pi(a,i||null,f.path,t,r),P=t?Lr(a,Sr+f.path):"";n[c]=m?P?wn(E,Qe(t,P)):(Mr(i||null,f.path)||{t:""}).t==="rich"?E:$t(E):o(c,E),e.type==="image"&&c==="src"&&el(n,e.props,a,i||null,f.path,!!P);let w=Ai(e,c);w&&(n[w.tk||"target"]=Ci(a,i||null,f.path,e));continue}if(f.src!=="field"||!t||!r)continue;let d=Pt(t,r,f.path);n[c]=m?wn(d,Qe(t,f.path)):o(c,d)}return e.type==="accordion"&&a&&n.open==="all"&&Xe(e,"open")?.src==="prop"&&!Xe(e,"single")&&(n.single=0),n}function Gs(e,t,r,a,i){if(e.bind.src==="prop")return a?Pi(a,i||null,e.bind.path,t,r):"";if(!t||!r)return"";let n=Pt(t,r,e.bind.path);return n==null?"":String(n)}function Ks(e,t,r,a){if(e.bind.src==="field")return Qe(t,e.bind.path)?.type;if(!r)return;let i=Lr(r,Sr+e.bind.path);return i&&t?Qe(t,i)?.type:Mr(a||null,e.bind.path)?.t}function kn(e,t,r,a,i){let n=e.showIf;if(!n||!n.bind||!n.bind.path)return!0;let o=Gs(n,t,r,a,i).trim(),c=Ks(n,t,a,i),f=c==="rich",m=f?jt(o):o,d=String(n.value==null?"":n.value).trim();if(n.op==="set")return m!=="";if(n.op==="empty")return m==="";let E=o===d||m===(f?d.replace(/\s+/g," "):d);if(c==="bool"){let P=N=>/^(1|true|yes)$/i.test(N)?!0:/^(0|false|no)$/i.test(N)?!1:null,w=P(o),D=P(d);w!==null&&D!==null&&(E=w===D)}return n.op==="eq"?E:n.op==="ne"?!E:!0}function Si(){return M.meta.components||(M.meta.components=[])}function De(e){return e&&Si().find(t=>t.id===e)||null}var Zs=e=>e.props.mobileMenuMode==="follow"||e.props.mobileMenuMode==="custom"?e.props.mobileMenuMode:e.props.mobileMenuComponent?"custom":"follow",$i=(e,t=Zs(e))=>t==="follow"?e.props.mobileMenuFollowComponent:e.props.mobileMenuComponent,Sn=e=>De($i(e));var Js=(e,t)=>e.type==="nav"&&(e.props.mobileMenuFollowComponent===t||e.props.mobileMenuComponent===t);function Ei(e){let t=M.ui.mobileMenuOwner;if(!t||t.menuComponentId!==e||!De(e))return t?.menuComponentId===e&&(M.ui.mobileMenuOwner=null),null;let r=null;if(t.mode==="header"||t.mode==="footer"){let a=t.page===void 0?M[t.mode]:de(M.pages[t.page],t.mode);r=ne(t.nodeId,a)}else if(t.mode==="page"&&t.page!==void 0)r=ne(t.nodeId,M.pages[t.page]?.tree||[]);else if(t.mode==="component"&&t.ownerComponentId){let a=De(t.ownerComponentId);a&&(r=ne(t.nodeId,[a.node]))}return!r||!Js(r.node,e)?(M.ui.mobileMenuOwner=null,null):{node:r.node,mode:t.mode,page:t.page,componentId:t.ownerComponentId}}var Mr=(e,t)=>e&&(e.props||[]).find(r=>r.k===t)||null,Xs=e=>e&&e.variants||[],Ir=(e,t)=>t&&Xs(e).find(r=>r.id===t)||null,$n=e=>"@image-size:"+e;function Qs(e,t){if(typeof e!="string")return null;try{let r=JSON.parse(e);return!r||typeof r!="object"||Array.isArray(r)||Object.keys(r).sort().join(",")!=="h,src,w"||r.src!==t||!/^asset:[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(r.src)||!Number.isSafeInteger(r.w)||r.w<=0||!Number.isSafeInteger(r.h)||r.h<=0?null:{w:r.w,h:r.h}}catch{return null}}function el(e,t,r,a,i,n){let o=Ir(a,r.variant),c=nr(r.vals,i)?r.vals?.[$n(i)]:o?.values[$n(i)],f=n?null:Qs(c,e.src);f?(e.w=String(f.w),e.h=String(f.h)):e.src!==t.src&&(delete e.w,delete e.h)}var ar="@link-target:",tl=e=>ar+e,nr=(e,t)=>!!e&&Object.prototype.hasOwnProperty.call(e,t),Ai=(e,t)=>(Le[e.type]?.controls.content||[]).find(r=>r.k===t&&r.t==="link")||null,ir=(e,t)=>{let r=[];return e&&ie([e.node],a=>Object.entries(a.bind||{}).forEach(([i,n])=>{let o=Ai(a,i);o&&n.src==="prop"&&n.path===t&&r.push({node:a,target:o.tk||"target"})})),r},rl=(e,t,r)=>{if(!t||(t.props||[]).filter(o=>o.t==="link").length!==1||!ir(t,r).length||(Le[t.node.type]?.controls.content||[]).filter(o=>o.t==="link"&&o.k).some(o=>{let c=Xe(t.node,o.k);return c?c.src!=="prop"||c.path!==r:!!String(t.node.props[o.k]||"").trim()||!!String(e.props[o.k]||"").trim()}))return"";let n=String(t.node.props.target||"");return e.props.target==="_blank"&&n!=="_blank"?"_blank":""};function Ci(e,t,r,a){let i=tl(r),n=e.vals&&nr(e.vals,i)?e.vals[i]:void 0;if(n!==void 0)return n==="_blank"?"_blank":"";let o=Ir(t,e.variant),c=o&&nr(o.values,i)?o.values[i]:void 0;if(c!==void 0)return c==="_blank"?"_blank":"";let f=rl(e,t,r);if(f)return f;let m=ir(t,r).find(d=>!a||d.node===a)||ir(t,r)[0];return m&&m.node.props[m.target]==="_blank"?"_blank":""}function Pi(e,t,r,a,i){if(r.startsWith(ar))return Ci(e,t,r.slice(ar.length));let n=Lr(e,Sr+r);if(n&&a)return Pt(a,i||null,n);let o=e.vals?e.vals[r]:void 0;if(o!==void 0)return o;let c=Ir(t,e.variant);if(c&&c.values[r]!==void 0)return c.values[r];let f=Mr(t,r);return f?f.def:""}function al(e){if(!e)return[];let t=[];return ie([e.node],r=>{r.slot&&Le[r.type].level<4&&t.push({k:r.slot,node:r})}),t}function nl(e,t,r){let a=al(t),i=a.length?a[0].k:"";return(e.children||[]).filter(n=>(n.slot||i)===r)}var St=e=>{let t=ne(e);return t&&t.parent?t.parent.id:null};var fe=17;function Ti(e){if(!e||!e.pages||!e.pages.length)return null;let t=e.schemaVersion,r=e.v;if(t!==void 0&&(!Number.isInteger(t)||t<1))throw new Error("invalid document schemaVersion");if(r!==void 0&&(!Number.isInteger(r)||r<1))throw new Error("invalid legacy document version");if(t!==void 0&&r!==void 0&&t!==r)throw new Error("conflicting document schema versions");let a=t??r??1;if(a>fe)return null;for(let n of e.pages)for(let o of["header","footer"]){if(n[o]!==void 0&&a<16)throw new Error("Page "+o+" overrides require document schema 16.");if(n[o]!==void 0&&n[o]!==null&&!Array.isArray(n[o]))throw new Error("invalid page "+o+" override")}let i=n=>{let o=c=>{n(c),(c.children||[]).forEach(o)};(e.header||[]).forEach(o),(e.footer||[]).forEach(o),(e.pages||[]).forEach(c=>Fe(c).forEach(f=>(f||[]).forEach(o))),((e.meta||{}).blocks||[]).forEach(c=>{c.node&&o(c.node)}),((e.meta||{}).components||[]).forEach(c=>{c.node&&o(c.node)})};if(i(n=>{if(n?.type!=="tabs"||!yr(n))return;if(a<15)throw new Error("Editable tab panels require document schema 15.");let o=ns(n);if(o)throw new Error(o)}),a<3&&(e.meta=e.meta||{},e.meta.tokens||(e.meta.tokens=cn(e.meta)),delete e.meta.color,delete e.meta.bg,delete e.meta.accent),a<4&&(e.meta=e.meta||{},e.meta.tokens=e.meta.tokens||cn(e.meta),Array.isArray(e.meta.tokens.classes)||(e.meta.tokens.classes=[])),a<5){let n={display:"h1",title:"h2",subtitle:"h3",lead:"p",body:"p",small:"p",eyebrow:"div"};((e.meta.tokens||{}).text||[]).forEach(o=>{let c=n;!o.tag&&c[o.id]&&(o.tag=c[o.id])})}if(a<6&&(e.meta=e.meta||{},Array.isArray(e.meta.blocks)||(e.meta.blocks=[])),a<7&&(e.meta=e.meta||{},Array.isArray(e.meta.collections)||(e.meta.collections=[])),a<8&&i(n=>["d","t","m"].forEach(o=>{let c=n.css&&n.css[o];if(!c)return;let f=c["--hover-bg"],m=c["--hover-fg"];if(delete c["--hover-bg"],delete c["--hover-fg"],!f&&!m)return;n.st=n.st||{};let d=n.st.hover=n.st.hover||{d:{},t:{},m:{}};d[o]=d[o]||{},f&&(d[o]["background-color"]=f),m&&(d[o].color=m,d[o]["border-color"]=m)})),a<9&&i(n=>{if(n.bind)for(let[o,c]of Object.entries(n.bind))typeof c=="string"&&(n.bind[o]={src:"field",path:c})}),a<10&&(e.meta=e.meta||{},Array.isArray(e.meta.components)||(e.meta.components=[])),a<11){let n=(e.meta||{}).blocks||[],o=n.filter(c=>c&&c.sync&&c.node);if(o.length){e.meta.components=Array.isArray(e.meta.components)?e.meta.components:[];let c=f=>JSON.stringify(f,(m,d)=>{if(m!=="id"){if(m==="adv"&&d){let{block:E,...P}=d;return P}return d}});for(let f of o){let m={id:f.id,name:f.name,node:as(qe(f.node)),props:[]},d=c(f.node);i(E=>{!E.adv||E.adv.block!==f.id||(delete E.adv.block,c(E)===d&&(E.use=f.id,E.children=[],E.css={d:{},t:{},m:{}},E.cls=[],E.hide={},E.adv={htmlId:"",cls:"",css:""},delete E.st,delete E.anim,delete E.bind,delete E.src))}),ie([m.node],E=>{let P=E.adv;P&&P.block===f.id&&delete P.block}),e.meta.components.push(m)}e.meta.blocks=n.filter(f=>!(f&&f.sync))}((e.meta||{}).blocks||[]).forEach(c=>{c&&delete c.sync})}if(a<12){let n=((e.meta||{}).tokens||{}).classes||[],o=(c,f,m)=>{let d=Array.isArray(c.cls)?c.cls:[],E="";for(let P of n){if(!P||!d.includes(P.id))continue;let w=P.css&&P.css[f]&&P.css[f][m];w!==void 0&&w!==""&&(E=w)}return E};i(c=>{if(!(!c||c.type!=="column")){c.css=c.css||{d:{},t:{},m:{}};for(let f of["d","t","m"]){let m=c.css[f]=c.css[f]||{},d=m["justify-content"];if(d!==void 0&&d!=="")m[we]=f==="d"&&d==="flex-start"?"follow":d,delete m["justify-content"];else if(!m[we]){let E=o(c,f,"justify-content");E&&(m[we]=E)}}c.css.d[we]||(c.css.d[we]="follow")}})}return a<13&&i(n=>{!n||n.type!=="form"||(n.props=n.props||{},n.props.mode!=="wordpress"&&(n.props.mode="external"))}),i(n=>{n&&n.props&&(n.type==="dockbar"||n.type==="slotpicker")&&ci(n.type,n.props)}),r!==void 0||t===void 0?e.v=fe:delete e.v,e.schemaVersion=fe,e}var mt=()=>{let e=x("brand");for(let n of["ink","paper","bg","surface"])if(Ke(n)&&(Jt(x(n),e)||0)>=4.5)return x(n);let t="#000000",r="#ffffff",a=Jt(t,e),i=Jt(r,e);return a==null||i==null?x("ink"):a>=i?t:r};var K="data:image/svg+xml;charset=utf-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#f1eee3"/><g fill="none" stroke="#c2beb0" stroke-width="10"><circle cx="300" cy="180" r="42"/><path d="M120 380l150-130 120 104 100-86 190 162z" stroke-linejoin="round"/></g></svg>'),Be={t:"@media (max-width:1024px)",m:"@media (max-width:767px)"},En={d:"@media (min-width:1025px)",t:"@media (min-width:768px) and (max-width:1024px)"},Li=()=>({d:"",t:"",m:"",vd:"",vt:"",vm:""});function Z(e){let t="",r=Object.keys(e).map((a,i)=>({k:a,i,rank:Xn(a)})).sort((a,i)=>a.rank-i.rank||a.i-i.i);for(let{k:a}of r){let i=e[a];if(!(i===""||i==null)){if(a==="--g-cols"||a==="z-index"){let o=String(i).trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:px)?$/i),c=o?Number(o[1]):NaN;Number.isFinite(c)&&(i=ws(a==="--g-cols"?Math.max(1,Math.round(c)):c))}t+=`${a}:${i};`}}return t}var Mi="pagecraft-",il=e=>e==="text"?"wysiwyg":zn(Le[e]&&Le[e].label||e),or=e=>Mi+String(e.id).replace(/^n/,""),ol=e=>`${Mi}${il(e.type)}-${String(e.id).replace(/^n/,"")}`,An={progress:["p"],hotspot:["hs"],switcher:["sw-t","sw-p"],roster:["panel","tab"],qapills:["pill","ans"],chapters:["ch-p","ch-b"]},Ii=e=>e.adv&&e.adv.htmlId?e.adv.htmlId:ol(e),B=e=>"."+or(e),Di=new Set(["height","object-fit","border-radius","opacity","filter"]),sr=new Set([...Di,"object-position"]),et=sr,sl=17;function Ri(e,t){et=(e??fe)<sl?Di:sr;try{return t()}finally{et=sr}}function Xt(e,t,r,a=null,i=!1){let n={...e.css[t]||{}},o=new Set,c=hs(n);if(Object.keys(n).forEach(w=>{w.startsWith(xt)?(n[w]==="1"&&o.add(w.slice(xt.length)),delete n[w]):w.startsWith(Ze)&&delete n[w]}),e.type==="column"){let w=vt(e,t,we),D=e.use?De(e.use):null,N=D&&D.node.type==="column"?vt(D.node,t,we):"",R=w||N||"follow";delete n[we];let F=!!e.use&&!w&&!!N&&N!=="follow";!(i&&R==="follow")&&!F&&(n["justify-content"]=R==="follow"?Kn(a,t):R)}let f=e.type==="image",m=f&&!!(e.props.caption||e.props.link),d={};if(f){for(let w of et)n[w]!==void 0&&(d[w]=n[w],m&&delete n[w]);n.width&&(d.width="100%")}let E=Z(n),P=[];if(E&&P.push(`${B(e)}{${E}}`),e.type==="button"){if(c.has("background")){let N=$o[String(e.props.variant)]||{},R=ms(e,t),F={};N["background-color"]!==void 0&&!R.has("background-color")&&(F["background-color"]=N["background-color"]),N["background-image"]!==void 0&&!R.has("background-image")&&(F["background-image"]=N["background-image"]);let V=Z(F);V&&P.push(`${B(e)}.pagecraft-button{${V}}`)}let D=Z(oi(n,t==="d"?gr:null,o,c));D&&P.push(`${B(e)}.pagecraft-button{${D}}`)}if(f&&Z(d)){let w={};d.height!==void 0&&(w.height="auto"),d["object-fit"]!==void 0&&(w["object-fit"]="initial"),d["object-position"]!==void 0&&(w["object-position"]="initial"),d["border-radius"]!==void 0&&(w["border-radius"]="0"),d.opacity!==void 0&&(w.opacity="1"),d.filter!==void 0&&(w.filter="none");let D=Z(w);D&&P.push(`${B(e)}.pagecraft-figure{${D}}`),P.push(`${B(e)} .pagecraft-image{${Z(d)}}`)}if((e.type==="box"||e.type==="list")&&n["flex-wrap"]&&(P.push(`${B(e)}.${e.type==="box"?"pagecraft-box":"pagecraft-list"}{flex-wrap:${n["flex-wrap"]}}`),e.type==="list"&&P.push(`${B(e)}.pagecraft-list{${wt(n["flex-wrap"])}}`)),kr.forEach(([w,,D])=>{let N={...e.st&&e.st[w]&&e.st[w][t]||{}};e.type==="list"&&N["flex-wrap"]&&P.push(`${B(e)}${D}{${wt(N["flex-wrap"])}}`);let R={};if(f)for(let W of et)N[W]!==void 0&&(R[W]=N[W],m&&delete N[W]);let F=Z(N),V=w==="focus"&&e.type==="gallery"?Qn(B(e)):w==="focus"&&e.type==="nav"?ei(B(e)):w==="focus"&&e.type==="text"?xr(B(e)):w==="focus"&&e.type==="video"?ti(B(e)):w==="focus"&&e.type==="tabs"?ri(B(e)):w==="focus"&&e.type==="accordion"?ai(B(e)):w==="focus"&&e.type==="form"?ni(B(e)):w==="focus"&&e.type==="code"?ii(B(e)):`${B(e)}${D}`;if(F&&P.push(`${V}{${F}}`),e.type==="text"){let W=Z({color:N["--link"]});if(W){let H=wr(B(e),w,D);P.push(`${H}{${W}}`)}}let U=Z(R);if(U){let W={};R.height!==void 0&&(W.height="auto"),R["object-fit"]!==void 0&&(W["object-fit"]="initial"),R["object-position"]!==void 0&&(W["object-position"]="initial"),R["border-radius"]!==void 0&&(W["border-radius"]="0"),R.opacity!==void 0&&(W.opacity="1"),R.filter!==void 0&&(W.filter="none");let H=Z(W);H&&P.push(`${B(e)}.pagecraft-figure${D}{${H}}`),P.push(`${B(e)}${D} .pagecraft-image{${U}}`)}}),e.type==="text"){let w=Z({color:n["--link"]});w&&P.push(`${Ct(B(e))}{${w}}`)}return P.join("")}function Cn(e,t){let r=e.css&&e.css[t]||{},a=t==="t"?{...e.css&&e.css.d||{}}:{...e.css&&e.css.d||{},...e.css&&e.css.t||{}},i=[er(e.props.ts),...Me(e)].filter(Boolean),n=new Set;i.forEach(D=>Object.keys(D.css&&D.css[t]||{}).forEach(N=>n.add(N)));let o={};n.forEach(D=>{(r[D]===void 0||r[D]==="")&&a[D]!==void 0&&a[D]!==""&&(o[D]=a[D])});let c={};if(e.type==="button"){let D=gs(gr),N=t==="m"?[{bp:"t",map:e.css.t},{bp:"d",map:e.css.d}]:[{bp:"d",map:e.css.d}];for(let R of n){let F=rt(R);if(F.length){delete o[R];for(let V of F){if(un(r,V))continue;let U=null;for(let be of N){let L=un(be.map,V);if(L){U={...be,supplier:L};break}}if(!U||U.map[Ze+U.supplier.property]==="1")continue;let W=U.supplier.property===R?{property:R,value:U.supplier.value}:dn(U.supplier,V),H=dn(U.supplier,V),Ee=U.map[xt+U.supplier.property]==="1";U.bp==="d"&&H.property===V&&D[V]===H.value&&!Ee||(c[W.property]=W.value)}}}}let f=e.type==="image"&&!!(e.props.caption||e.props.link),m={};if(f)for(let D of et)o[D]!==void 0&&(m[D]=o[D],delete o[D]);let d=Z(o),E=Z(c),P=Z(m),w=e.type==="text"?Z({color:o["--link"]}):"";return(d?`${B(e)}{${d}}`:"")+(E?`${B(e)}.pagecraft-button{${E}}`:"")+(P?`${B(e)} .pagecraft-image{${P}}`:"")+(w?`${Ct(B(e))}{${w}}`:"")}function Pn(e,t){return e.type!=="text"?"":kr.map(([r,,a])=>{let i=e.st&&e.st[r]&&e.st[r][t]||{},n=t==="t"?{...e.st&&e.st[r]&&e.st[r].d||{}}:{...e.st&&e.st[r]&&e.st[r].d||{},...e.st&&e.st[r]&&e.st[r].t||{}},o=Me(e).some(m=>{let d=m.st&&m.st[r]&&m.st[r][t];return d&&d["--link"]!==void 0&&d["--link"]!==""}),c=n["--link"];if(!o||i["--link"]!==void 0&&i["--link"]!==""||c===void 0||c==="")return"";let f=Z({color:c});return f?`${wr(B(e),r,a)}{${f}}`:""}).join("")}var Tn=e=>`${B(e)}.pagecraft-nav-enhanced>.pagecraft-nav-toggle{display:flex}${B(e)}.pagecraft-nav-enhanced>.pagecraft-nav-list{display:none}${B(e)}:not(.pagecraft-nav-enhanced)>.pagecraft-nav-list{flex-wrap:wrap;min-width:0}${B(e)}:not(.pagecraft-nav-enhanced) .sub-menu{display:block;position:static;min-width:0;box-shadow:none}`;function tt(e,t,r,a=null,i=!1){if(r.d+=Xt(e,"d",t,a,i),e.type==="spacer"&&(r.m+=`:where(${B(e)}){height:32px}`),e.type==="form"&&e.props.fields?.some(o=>[100,50,33,25,20].includes(Number(o.width)))){let o=B(e);r.d+=`${o}.pagecraft-form-percent{display:var(--f-layout,flex)}${o}>.pagecraft-field{flex:0 0 100%;min-width:0}`;for(let[c,f]of[[50,2],[33,3],[25,4],[20,5]])r.d+=`${o}>.field-width-${c}{flex-basis:calc((100% - var(--f-gap,16px) * ${f-1}) / ${f})}`}if(e.type==="list"&&e.props.collectionLayout==="slider"){let o=B(e);r.d+=`${o}{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto;scroll-snap-type:x mandatory}${o}>*{flex:0 0 calc(50% - 12px);scroll-snap-align:start}`,r.m+=`${o}>*{flex-basis:80%}`}if(e.type==="nav"&&e.props.managedMobileLinks){let o=B(e);r.d+=`${o}.pagecraft-mobile-nav-links{display:block}${o}>.pagecraft-nav-list{display:flex;position:static;flex-direction:column;align-items:stretch;gap:var(--nav-gap,4px);min-width:0;width:100%;padding:0;margin:0;box-shadow:none;background:transparent}${o}>.pagecraft-nav-list a{padding:12px 0;min-height:44px;box-sizing:border-box}${o} .sub-menu{display:flex;position:static;flex-direction:column;min-width:0;padding:0 0 0 20px;box-shadow:none;background:transparent;font-size:.85em}`}else if(e.type==="nav"){let o=e.props.collapse;if(o==="tablet")r.t+=Tn(e);else if(o!=="never")r.m+=Tn(e);else{let c=B(e);r.m+=`${c}.pagecraft-nav-menu{min-width:0;max-width:100%}${c}>.pagecraft-nav-list{min-width:0;max-width:100%;flex-wrap:wrap;justify-content:inherit}`}}r.t+=Xt(e,"t",t,a,i),r.t+=Cn(e,"t"),r.t+=Pn(e,"t"),r.m+=Xt(e,"m",t,a,i),r.m+=Cn(e,"m"),r.m+=Pn(e,"m"),e.adv&&e.adv.css&&(r.d+=e.adv.css.replace(/&/g,B(e)));let n=t?"opacity:.32;outline:1px dashed #f0a132;outline-offset:2px;":"display:none !important;";return e.hide?.d&&(r.vd=(r.vd||"")+`${B(e)}{${n}}`),e.hide?.t&&(r.vt=(r.vt||"")+`${B(e)}{${n}}`),e.hide?.m&&(r.vm=(r.vm||"")+`${B(e)}{${n}}`),(e.children||[]).forEach(o=>tt(o,t,r,e)),r}function Oi(e){return(e.vd?`${En.d}{${e.vd}}`:"")+(e.vt?`${En.t}{${e.vt}}`:"")}function it(e){let t=new Set,r=[],a=i=>ie(i,n=>{for(let o of[n.use,n.type==="nav"&&n.props.mobileMenu!=="fullscreen"?$i(n):null]){if(!o||t.has(o))continue;let c=De(o);c&&(t.add(o),r.push(c),a([c.node]))}});return e.forEach(a),r}function Ln(e,t){let r=Li();return it(e).forEach(a=>tt(a.node,t,r,null,!0)),e.forEach(a=>a.forEach(i=>tt(i,t,r))),r.d+(r.t?`${Be.t}{${r.t}}`:"")+(r.m||r.vm?`${Be.m}{${r.m}${r.vm}}`:"")+Oi(r)}function ll(e){let t=si();return Bi(e)+t.d+(t.t?`${Be.t}{${t.t}}`:"")+(t.m?`${Be.m}{${t.m}}`:"")}var Ni=`.pagecraft-lightbox .pagecraft-lightbox-error{
  max-width:64ch;margin:0;color:#f2f2ee;font:400 16px/1.5 system-ui,sans-serif;
  text-align:center;overflow-wrap:anywhere;
}
.pagecraft-lightbox .pagecraft-lightbox-error strong,.pagecraft-lightbox .pagecraft-lightbox-error span{display:block}
.pagecraft-lightbox .pagecraft-lightbox-error strong{font-weight:600}
.pagecraft-lightbox .pagecraft-lightbox-retry{
  min-height:44px;margin-top:12px;padding:8px 16px;border:1px solid currentColor;border-radius:6px;
  background:transparent;color:inherit;font:600 16px/1.25 system-ui,sans-serif;cursor:pointer;
}
.pagecraft-lightbox .pagecraft-lightbox-retry[aria-disabled=true]{cursor:wait;opacity:.72}
.pagecraft-lightbox .pagecraft-lightbox-retry:focus-visible{outline:2px solid #fff;outline-offset:3px}`;function cl(e,t){let r=Li();it(e).forEach(i=>tt(i.node,t,r,null,!0)),e.forEach(i=>i.forEach(n=>tt(n,t,r)));let a=si();return Bi(t)+a.d+r.d+(a.t||r.t?`${Be.t}{${a.t}${r.t}}`:"")+(a.m||r.m||r.vm?`${Be.m}{${a.m}${r.m}${r.vm}}`:"")+Oi(r)}function Mn(e){let t=!1,r=!1;return[...it(e).map(i=>[i.node]),...e].forEach(i=>ie(i,n=>{if(n.type!=="form"&&n.type!=="slotpicker")return;let o=at(n.type,n.props).fields||[];o.some(c=>c.type==="select")&&(t=!0),o.some(c=>c.type==="date")&&(r=!0)})),{select:t,date:r}}function In(e){return(e.select?`
${Vt}`:"")+(e.date?`
${Wt}`:"")}var ul=`.pagecraft-video-lightbox-stage{
  width:100%;height:100%;display:flex;align-items:center;justify-content:center;
  padding:clamp(16px,5vw,64px);box-sizing:border-box;
}
.pagecraft-video-lightbox-frame{
  position:relative;width:min(100%,1120px,calc((100vh - 96px) * var(--pc-vr,16 / 9)));
  aspect-ratio:var(--pc-vr,16 / 9);background:#000;border-radius:12px;overflow:hidden;
  box-shadow:0 28px 80px rgba(0,0,0,.65);
}
.pagecraft-video-lightbox-frame>iframe,.pagecraft-video-lightbox-frame>video{
  position:absolute;inset:0;width:100%;height:100%;border:0;display:block;
}`;function lr(e){let t=!1,r=!1,a=!1,i=!1,n=!1,o=!1,c=!1,f=!1,m=!1,d=!1,E=!1,P=!1,w=!1,D=!1,N=!1,R=!1,F=!1,V=!1,U=!1,W=!1,H=!1,Ee=!1,be=!1,L=!1,re=!1,st=!1,lt=!1,se=!1,l=!1,Ae=!1;return[...it(e).map(h=>[h.node]),...e].forEach(h=>ie(h,p=>{p.type==="section"&&(p.props.floating||p.bind?.floating)?o=!0:p.type==="audio"?t=!0:p.type==="countdown"?r=!0:p.type==="marquee"?a=!0:p.type==="filter"?i=!0:p.type==="compare"?c=!0:p.type==="timeline"?f=!0:p.type==="progress"?m=!0:p.type==="hotspot"?d=!0:p.type==="strips"?E=!0:p.type==="switcher"?P=!0:p.type==="exhibit"?w=!0:p.type==="scrolly"?D=!0:p.type==="clocks"?N=!0:p.type==="roster"?R=!0:p.type==="tiers"?F=!0:p.type==="qapills"?V=!0:p.type==="dockbar"?U=!0:p.type==="arches"?W=!0:p.type==="chapters"?H=!0:p.type==="slotpicker"?Ee=!0:p.type==="reel"?be=!0:p.type==="grow"?L=!0:p.type==="deck"?re=!0:p.type==="metrics"?st=!0:p.type==="spotlight"?lt=!0:p.type==="terminal"?se=!0:p.type==="tilt"?l=!0:p.type==="flip"?Ae=!0:p.type==="video"&&(p.props.lightbox||p.bind?.lightbox)&&(n=!0)})),{audio:t,countdown:r,marquee:a,filter:i,videoLightbox:n,floating:o,compare:c,timeline:f,progress:m,hotspot:d,strips:E,switcher:P,exhibit:w,scrolly:D,clocks:N,roster:R,tiers:F,qapills:V,dockbar:U,arches:W,chapters:H,slotpicker:Ee,reel:be,grow:L,deck:re,metrics:st,spotlight:lt,terminal:se,tilt:l,flip:Ae}}function cr(e){return(e.floating?`
${na}`:"")+(e.audio?`
${ia}`:"")+(e.countdown?`
${sa}`:"")+(e.marquee?`
${ca}`:"")+(e.filter?`
${ua}`:"")+(e.compare?`
${pa}`:"")+(e.timeline?`
${ga}`:"")+(e.progress?`
${ma}`:"")+(e.hotspot?`
${ha}`:"")+(e.strips?`
${ya}`:"")+(e.switcher?`
${xa}`:"")+(e.exhibit?`
${ka}`:"")+(e.scrolly?`
${$a}`:"")+(e.clocks?`
${Aa}`:"")+(e.roster?`
${Pa}`:"")+(e.tiers?`
${La}`:"")+(e.qapills?`
${Ia}`:"")+(e.dockbar?`
${Ra}`:"")+(e.arches?`
${Oa}`:"")+(e.chapters?`
${Na}`:"")+(e.slotpicker?`
${Ba}`:"")+(e.reel?`
${za}`:"")+(e.grow?`
${ja}`:"")+(e.deck?`
${Va}`:"")+(e.metrics?`
${Ua}`:"")+(e.spotlight?`
${Ga}`:"")+(e.terminal?`
${Za}`:"")+(e.tilt?`
${Xa}`:"")+(e.flip?`
${en}`:"")+(e.videoLightbox?`
${ul}`:"")}function Fi(e,t){return Ri(t,()=>dl(e))}function dl(e){let t=[M.header,M.footer],r=tr(t),a=tr(Fe(e)),i=Mn(t),n=Mn(Fe(e)),o=lr(t),c=lr(Fe(e));return{global:pr(ll(!1)+Ln(t,!1)+In(i)+cr(o)+(r?`
${pt}
${rr}`:"")),page:pr(Ln(Fe(e),!1)+In({select:n.select&&!i.select,date:n.date&&!i.date})+cr({floating:c.floating&&!o.floating,audio:c.audio&&!o.audio,countdown:c.countdown&&!o.countdown,marquee:c.marquee&&!o.marquee,filter:c.filter&&!o.filter,compare:c.compare&&!o.compare,timeline:c.timeline&&!o.timeline,progress:c.progress&&!o.progress,hotspot:c.hotspot&&!o.hotspot,strips:c.strips&&!o.strips,switcher:c.switcher&&!o.switcher,exhibit:c.exhibit&&!o.exhibit,scrolly:c.scrolly&&!o.scrolly,clocks:c.clocks&&!o.clocks,roster:c.roster&&!o.roster,tiers:c.tiers&&!o.tiers,qapills:c.qapills&&!o.qapills,dockbar:c.dockbar&&!o.dockbar,arches:c.arches&&!o.arches,chapters:c.chapters&&!o.chapters,slotpicker:c.slotpicker&&!o.slotpicker,reel:c.reel&&!o.reel,grow:c.grow&&!o.grow,deck:c.deck&&!o.deck,metrics:c.metrics&&!o.metrics,spotlight:c.spotlight&&!o.spotlight,terminal:c.terminal&&!o.terminal,tilt:c.tilt&&!o.tilt,flip:c.flip&&!o.flip,videoLightbox:c.videoLightbox&&!o.videoLightbox})+(a&&!r?`
${pt}
${rr}`:""))}}function Bi(e){let t=M.meta;return`
${us()}
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
.pagecraft-list{--pc-list-item-shrink:1;--pc-list-overflow-x:visible;--pc-list-min-width:auto;--pc-list-max-width:none;--pc-list-padding:0}
:where(.pagecraft-list:not(.pagecraft-slider)){overflow-x:var(--pc-list-overflow-x,visible);min-width:var(--pc-list-min-width,auto);max-width:var(--pc-list-max-width,none);padding:var(--pc-list-padding,0)}
.pagecraft-list:where(:not(.pagecraft-slider))>:where(*){flex-shrink:var(--pc-list-item-shrink,1)}
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
.pagecraft-button[data-variant=outline],.pagecraft-button[data-variant=ghost],.pagecraft-button[data-variant=link]{background-image:none}
.pagecraft-button svg{width:1em;height:1em;flex:0 0 auto}
.pagecraft-figure{margin:0;display:flex;flex-direction:column}
.pagecraft-figure>a{display:block;width:100%;max-width:100%}
.pagecraft-image{display:block;width:100%;height:auto}
.pagecraft-caption{font-size:.82em;opacity:.7;margin-top:.55em}
.pagecraft-slider-box{position:relative;width:100%;min-width:0;max-width:100%}
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
.pagecraft-slider[data-dragging]{cursor:grabbing;scroll-snap-type:none;-webkit-user-select:none;user-select:none}
.pagecraft-slider-progress{height:3px;width:min(240px,64%);margin:18px auto 0;border-radius:999px;background:color-mix(in srgb,currentColor 16%,transparent);overflow:hidden}
.pagecraft-slider-progress[hidden]{display:none}
.pagecraft-slider-progress-fill{display:block;height:100%;width:16%;border-radius:999px;background:var(--c-brand,currentColor);transition:width .24s cubic-bezier(.22,1,.36,1)}
.controls-bottom>.pagecraft-slider-progress{grid-column:2;grid-row:2;margin-top:0;width:min(220px,46vw)}
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
.controls-bottom>.pagecraft-slider-dots{grid-column:2;grid-row:2;margin-top:0;min-width:0;flex-wrap:wrap}
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
.pagecraft-tabs{width:100%;overflow-wrap:anywhere}
.pagecraft-tablist{position:relative;display:flex;flex-wrap:wrap;gap:var(--tb-gap,22px);justify-content:var(--tb-align,flex-start);border-bottom:1px solid var(--tb-line,#e5e1d6)}
.pagecraft-tab-indicator{position:absolute;left:0;top:0;height:2px;border-radius:999px;background:var(--tb-on,#111311);pointer-events:none;opacity:0;transition:transform .36s cubic-bezier(.22,1.18,.36,1),width .36s cubic-bezier(.22,1.18,.36,1),opacity .18s ease}
.pagecraft-tab-indicator[data-tab-ind-ready]{opacity:1}
.pagecraft-tab-indicator[data-tab-ind-init]{transition:none}
.pagecraft-tab{
  background:none;border:0;cursor:pointer;min-width:0;max-width:100%;padding:var(--tb-pad,10px 2px);margin-bottom:-1px;
  font:inherit;font-size:var(--tb-size,15px);font-weight:var(--tb-weight,500);
  color:var(--tb-off,#5f6660);border-bottom:2px solid transparent;transition:color .16s,border-color .16s;
}
.pagecraft-tab.on{color:var(--tb-on,#111311);border-bottom-color:var(--tb-on,#111311)}
.pagecraft-tablist[data-tabs-spring] .pagecraft-tab.on{border-bottom-color:transparent}
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
.pagecraft-nav-list .sub-menu.is-flipped{left:auto;right:0}
.pagecraft-nav-list .sub-menu .sub-menu.is-flipped{left:auto;right:100%}
.pagecraft-nav-list a{display:block;text-decoration:none;color:inherit;transition:color .15s ease,background-color .15s ease}
.pagecraft-nav-list a:hover{color:var(--nav-hover,inherit)}
.pagecraft-nav-toggle{display:none;align-items:center;justify-content:center;width:40px;height:40px;margin:-8px -8px -8px 0;padding:0;border:0;background:none;color:inherit;cursor:pointer}
.pagecraft-mobile-menu{position:fixed;inset:var(--nav-top,0px) 0 auto;width:100%;max-width:none;max-height:var(--nav-height,calc(100dvh - var(--nav-top,0px)));margin:0;padding:20px clamp(20px,5vw,48px);border:0;border-radius:0;background:var(--nav-panel,#fff);color:inherit;font:inherit;overflow:auto;box-sizing:border-box;overscroll-behavior:contain}
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
  grid-column:1 / -1;
  font:inherit;font-weight:600;cursor:pointer;border:0;align-self:var(--f-button-align,flex-start);flex:0 0 auto;
  background:var(--f-btn-bg,#111);color:var(--f-btn-fg,#fff);
  border-radius:var(--f-radius,8px);padding:var(--f-pad,11px 13px);padding-left:26px;padding-right:26px;
  max-width:100%;min-width:0;white-space:normal;overflow-wrap:anywhere;
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
.pagecraft-gallery-masonry{display:block;columns:var(--g-cols,3);column-gap:var(--g-gap,12px)}
.pagecraft-gallery-masonry .pagecraft-gallery-item{display:block;break-inside:avoid;margin:0 0 var(--g-gap,12px)}
.pagecraft-gallery-masonry .pagecraft-gallery-frame{aspect-ratio:auto}
.pagecraft-gallery-masonry .pagecraft-gallery-img{height:auto}
.pagecraft-gallery-item{margin:0;display:flex;flex-direction:column;min-width:0}
.pagecraft-gallery-frame{
  display:block;position:relative;overflow:hidden;
  border-radius:var(--g-radius,10px);background:rgba(17,19,17,.05);
}
.pagecraft-gallery-img{display:block;width:100%;height:auto}
.pagecraft-gallery a.pagecraft-gallery-frame .pagecraft-gallery-img{transition:transform .38s cubic-bezier(.22,1,.36,1)}
.pagecraft-gallery a.pagecraft-gallery-frame:hover .pagecraft-gallery-img{transform:scale(1.035)}
.pagecraft-gallery-fixed .pagecraft-gallery-frame{aspect-ratio:var(--g-ratio,4 / 3)}
.pagecraft-gallery-fixed .pagecraft-gallery-img{height:100%;object-fit:var(--g-fit,cover)}
.pagecraft-gallery-caption{font-size:.82em;opacity:.7;margin-top:.5em}
@keyframes pc-lb-backdrop{from{opacity:0}to{opacity:1}}
.pagecraft-lightbox{
  padding:0;border:0;background:transparent;width:100%;height:100%;
  max-width:100vw;max-height:100vh;overflow:hidden;
}
.pagecraft-lightbox::backdrop{background:rgba(10,12,10,.93)}
.pagecraft-lightbox[open]::backdrop{animation:pc-lb-backdrop .22s ease}
.pagecraft-lightbox-fig{
  margin:0;width:100%;height:100%;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:16px;padding:clamp(16px,4vw,48px);
}
.pagecraft-lightbox-img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;opacity:0;transform:scale(.93);transition:transform .32s cubic-bezier(.22,1,.36,1),opacity .22s ease}
.pagecraft-lightbox-img[data-lb-ready]{opacity:1;transform:scale(1)}
.pagecraft-lightbox-cap{margin:0;color:#f2f2ee;font-size:14px;line-height:1.5;text-align:center;max-width:64ch}
${Ni}
.pagecraft-lightbox-btn{
  position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;
  display:grid;place-items:center;border:0;border-radius:50%;cursor:pointer;
  font:400 22px/1 system-ui,sans-serif;
}
.pagecraft-lightbox .pagecraft-lightbox-btn{background:rgba(10,12,10,.72);color:#fff}
.pagecraft-lightbox .pagecraft-lightbox-btn:hover{background:rgba(10,12,10,.88);color:#fff}
.pagecraft-lightbox-prev{left:14px}
.pagecraft-lightbox-next{right:14px}
.pagecraft-lightbox-close{position:absolute;top:14px;right:14px;transform:none}
.pagecraft-lightbox-btn[hidden]{display:none}

.pagecraft-button:focus-visible,.pagecraft-form-button:focus-visible,
.pagecraft-nav-list a:focus-visible,.pagecraft-nav-toggle:focus-visible,
.pagecraft-heading a:focus-visible,.pagecraft-wysiwyg a:focus-visible,
.pagecraft-figure:focus-visible,.pagecraft-icon:focus-visible,
.pagecraft-gallery-frame:focus-visible,.pagecraft-accordion-q:focus-visible{outline:3px solid currentColor;outline-offset:3px}
.pagecraft-lightbox .pagecraft-lightbox-btn:focus-visible{
  outline:2px solid #fff;outline-offset:2px;box-shadow:0 0 0 5px rgba(10,12,10,.92);
}
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
/* Empty rich content needs a canvas target; a pseudo-element cannot leak into inline edits. */
.s-rich-empty::after{content:"";display:block;height:24px;pointer-events:none}
[data-t=section]:hover,[data-t=row]:hover,[data-t=column]:hover{outline:1px dashed #6f7771;outline-offset:-1px}
/* Keep an empty Column available as a drop target without giving real content an editor-only
   containing-block height. Percentage children must see the same layout context as Preview. */
.s-column-empty{min-height:40px}
[data-t=tabs] [data-tab-idle]{display:none}
.pagecraft-video>iframe,.pagecraft-video>video{pointer-events:none}
.pagecraft-button,.pagecraft-heading a,.pagecraft-wysiwyg a{cursor:default}
.s-empty{
  display:flex;align-items:center;justify-content:center;gap:7px;min-height:76px;width:100%;
  border:1px dashed #cbd2d8;border-radius:8px;color:#6f7771;
  font:500 ${ce.label} "DM Sans",system-ui,sans-serif;background:#f5f7f880;
}
.s-icon-missing{
  display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;
  width:var(--icon-size,30px);height:var(--icon-size,30px);min-width:18px;min-height:18px;
  border:1px dashed #cbd2d8;border-radius:6px;color:#6f7771;background:#f5f7f880;
  font:600 ${ce.label} "DM Sans",system-ui,sans-serif;
}
.s-held{
  display:block;margin-top:8px;padding:7px 10px;border-radius:6px;
  background:#f5f7f8;border:1px dashed #cbd2d8;color:#6f7771;
  font:500 ${ce.label} "DM Sans",system-ui,sans-serif;
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
/* the active badge names the component but has no action; let canvas clicks reach its root */
.s-region[data-state=edit]:hover>.s-lockbar{pointer-events:none}
/* nothing stays pinned over the canvas \u2014 the way out lives in the chrome */
.s-lockchip,.s-lockopen{
  display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:6px;
  font:500 ${ce.label} "DM Sans",system-ui,sans-serif;white-space:nowrap;
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
  min-height:60vh;color:#6f7771;font:500 ${ce.body} "DM Sans",system-ui,sans-serif;
  text-align:center;padding:40px;
}
.s-canvas-empty b{font-size:16px;color:#111311;font-weight:600;font-family:"Manrope",system-ui,sans-serif}
.s-openadd{
  margin-top:4px;padding:7px 14px;border-radius:8px;cursor:pointer;border:0;
  background:#111311;color:#f5f7f8;font:600 ${ce.label} "Manrope",system-ui,sans-serif;
}
.s-openadd:hover{background:#2a2e2a}
.s-startheroes{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin:4px 0 12px}
.s-starthero{display:flex;flex-direction:column;gap:6px;width:168px;padding:8px;border:1px solid #dfe3dd;border-radius:10px;background:#fff;cursor:pointer;color:#111311;font:600 ${ce.label}/1.2 "Manrope",system-ui,sans-serif;transition:border-color .12s,box-shadow .12s}
.s-starthero:hover,.s-starthero:focus-visible{border-color:#b7f34a;box-shadow:0 0 0 3px rgba(183,243,74,.35);outline:none}
.s-starthero .pvw{display:block;width:100%;height:auto;border-radius:6px;background:#f3f5f1}
.s-starthero .pv-b{fill:#d5dad3}.s-starthero .pv-l{fill:#adb7bf}.s-starthero .pv-h{fill:#8f9a90}.s-starthero .pv-g{fill:#b7f34a}

/* selection: green outline plus the eight handles from the product screens */
/* As wide as the page and clipped across it: handles past an edge that touches the frame
   must not widen the canvas page (a phone canvas grew a sideways scrollbar). Height stays 0
   and visible, so nothing is clipped vertically. */
#s-hud{position:absolute;top:0;left:0;width:100%;height:0;overflow-x:clip;z-index:9998;pointer-events:none}
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
  font:500 ${ce.label} "DM Sans",system-ui,sans-serif;
}
#s-hud .qa{position:absolute;pointer-events:auto;width:22px;height:22px;margin:-11px 0 0 -11px;padding:0;border:2px solid #111311;border-radius:50%;background:#b7f34a;color:#111311;display:grid;place-items:center;cursor:pointer;transform:scale(calc(1 / var(--z,1)));box-shadow:0 2px 6px rgba(0,0,0,.25);z-index:2}
#s-hud .qa[data-side=top]{transform:scale(calc(1 / var(--z,1))) translateY(-15px)}
#s-hud .qa[data-side=bottom]{transform:scale(calc(1 / var(--z,1))) translateY(15px)}
#s-hud .qa[data-side=left]{transform:scale(calc(1 / var(--z,1))) translateX(-15px)}
#s-hud .qa[data-side=right]{transform:scale(calc(1 / var(--z,1))) translateX(15px)}
#s-hud .qa[data-side=left].inside{transform:scale(calc(1 / var(--z,1))) translateX(15px)}
#s-hud .qa[data-side=right].inside{transform:scale(calc(1 / var(--z,1))) translateX(-15px)}
#s-hud .qa:hover,#s-hud .qa:focus-visible{background:#fff;outline:none}
#s-hud .qa svg{width:12px;height:12px;stroke-width:2.2}
#s-hud .qa-line{position:absolute;background:#b7f34a;pointer-events:none;border-radius:2px;box-shadow:0 0 0 1px rgba(17,19,17,.35)}
#s-hud .qa-line.top,#s-hud .qa-line.bottom{height:calc(4px / var(--z,1));margin-top:calc(-2px / var(--z,1))}
#s-hud .qa-line.left,#s-hud .qa-line.right{width:calc(4px / var(--z,1));margin-left:calc(-2px / var(--z,1))}
#s-hud .rev-chip{position:absolute;display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:0 0 6px 6px;background:#111311;color:#b7f34a;font:600 ${ce.label}/1.2 system-ui,sans-serif;pointer-events:auto;white-space:nowrap;transform:scale(calc(1 / var(--z,1)));transform-origin:0 0}
#s-hud .rev-chip svg{width:11px;height:11px}
#s-hud .bar{
  position:absolute;display:flex;flex-wrap:wrap;align-items:center;gap:1px;background:#111311;color:#f5f7f8;
  box-sizing:border-box;width:max-content;max-width:calc(100vw * var(--z,1) - 8px);
  border-radius:6px 6px 0 0;padding:3px 3px 3px 8px;pointer-events:auto;white-space:nowrap;
  transform:scale(calc(1 / var(--z,1)));transform-origin:0 0;
  font:500 ${ce.label} "DM Sans",system-ui,sans-serif;
}
#s-hud .bar .nm{padding-right:6px}
#s-hud .bar button{
  width:20px;height:20px;border:0;background:none;color:#f5f7f8;display:grid;place-items:center;
  border-radius:4px;cursor:pointer;padding:0;opacity:.75;
}
#s-hud .bar button:hover{background:#ffffff26;opacity:1;color:#b7f34a}
#s-hud .bar button.g{cursor:grab}
#s-drop{position:absolute;z-index:9999;pointer-events:none;background:#b7f34a;border-radius:2px;box-shadow:0 0 0 calc(1px / var(--z,1)) #11131126}
#s-drop-label{position:absolute;z-index:10000;pointer-events:none;box-sizing:border-box;width:max-content;max-width:calc(100vw * var(--z,1) - 8px);padding:5px 8px;border-radius:4px;background:#111311;color:#f5f7f8;font:500 ${ce.label} "DM Sans",system-ui,sans-serif;transform:scale(calc(1 / var(--z,1)));transform-origin:0 0;white-space:normal}
#s-drop.box{background:#b7f34a24;border:1.5px solid #b7f34a;border-radius:8px;box-shadow:none}
`:"")}function pl(e){let t=String(e.src||"").trim();if(!t)return{kind:"none",url:""};if(/^[\\/]{2}/.test(t)||/[\u0000-\u001f\u007f]/.test(t)||/^(?:%(?:0[0-9a-f]|1[0-9a-f]|7f))/i.test(t))return{kind:"invalid",url:""};if(/^asset:[A-Za-z0-9][A-Za-z0-9._:-]*(?:@\d+)?$/.test(t)||/^data:audio\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(t))return{kind:"valid",url:t};let r=/^([A-Za-z][A-Za-z0-9+.-]*):/.exec(t);if(r){if(!/^https?$/i.test(r[1])||!/^https?:\/\//i.test(t))return{kind:"invalid",url:""};try{let a=new URL(t);return!["http:","https:"].includes(a.protocol)||a.username||a.password?{kind:"invalid",url:""}:{kind:"valid",url:t}}catch{return{kind:"invalid",url:""}}}return/\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)(\?|#|$)/i.test(t)||/^\/[^/]/.test(t)?{kind:"valid",url:t}:{kind:"invalid",url:""}}function fl(e){return e.replace(/\s+id=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,"").replace(/\s+tabindex=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,"").replace(/<(a|button|input|select|textarea|summary)(?=[\s>])/gi,'<$1 tabindex="-1"')}function Dn(e){let t=new Set,r=[];for(let a of String(e??"").split(",")){let i=a.trim(),n=i.toLowerCase();i&&!t.has(n)&&(t.add(n),r.push(i))}return r}function gl(e){let t=Dn(e.props.tags);if(t.length)return t;let r=new Set,a=[],i=n=>{for(let o of n){if(o.type==="box"&&o.props.tags)for(let c of Dn(o.props.tags)){let f=c.toLowerCase();r.has(f)||(r.add(f),a.push(c))}o.children?.length&&i(o.children)}};return i(e.children||[]),a}function ml(e){let t=String(e??"").trim();if(!t)return{valid:!1,done:!1,d:"--",h:"--",m:"--",s:"--"};let r=Date.parse(t);if(!Number.isFinite(r))return{valid:!1,done:!1,d:"--",h:"--",m:"--",s:"--"};let a=r-Date.now();if(a<=0)return{valid:!0,done:!0,d:"0",h:"00",m:"00",s:"00"};let i=Math.floor(a/1e3),n=o=>o<10?"0"+o:String(o);return{valid:!0,done:!1,d:String(Math.floor(i/86400)),h:n(Math.floor(i%86400/3600)),m:n(Math.floor(i%3600/60)),s:n(i%60)}}function ze(e){let t=String(e.src||"").trim();if(!t)return{kind:"none",id:""};if(/^[\\/]{2}/.test(t)||/[\u0000-\u001f\u007f]/.test(t)||/^(?:%(?:0[0-9a-f]|1[0-9a-f]|7f))/i.test(t))return{kind:"invalid",id:""};let r=n=>n&&/^[\w-]{6,}$/.test(n)?n:"",a=n=>/\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i.test(n);if(/^asset:[A-Za-z0-9][A-Za-z0-9._:-]*(?:@\d+)?$/.test(t)||/^data:video\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(t))return{kind:"file",id:t};if(t.startsWith("//"))return{kind:"invalid",id:""};let i=/^([A-Za-z][A-Za-z0-9+.-]*):/.exec(t);if(i&&!/^https?$/i.test(i[1]))return{kind:"invalid",id:""};if(i){if(!/^https?:\/\//i.test(t))return{kind:"invalid",id:""};try{let n=new URL(t);if(!["http:","https:"].includes(n.protocol)||n.username||n.password)return{kind:"invalid",id:""};let o=n.hostname.toLowerCase(),c=n.pathname.split("/").filter(Boolean),f=new Set(["youtube.com","www.youtube.com","m.youtube.com","music.youtube.com"]),m="";if(f.has(o)?n.pathname==="/watch"?m=r(n.searchParams.get("v")):["embed","shorts","live"].includes(c[0])&&(m=r(c[1]||"")):(o==="youtu.be"||o==="www.youtu.be")&&(m=r(c[0]||"")),m)return{kind:"youtube",id:m};if(new Set(["vimeo.com","www.vimeo.com"]).has(o)||o==="player.vimeo.com"){let E=c[0]==="video"?c[1]:o==="player.vimeo.com"?"":c[0];if(E&&/^\d+$/.test(E))return{kind:"vimeo",id:E}}return{kind:a(t)?"file":"other",id:t}}catch{return{kind:"invalid",id:""}}}return a(t)?{kind:"file",id:t}:{kind:"invalid",id:""}}function hl(e){return e.poster||""}var ur=e=>{let t=ze(e),r=[];return e.autoplay&&r.push("autoplay=1"),(e.muted||e.autoplay)&&r.push("mute=1","muted=1"),e.loop&&r.push("loop=1"),e.controls||r.push("controls=0"),t.kind==="youtube"?`https://www.youtube.com/embed/${t.id}?${r.concat(e.loop?["playlist="+t.id]:[]).join("&")}`:t.kind==="vimeo"?`https://player.vimeo.com/video/${t.id}?${r.join("&")}`:t.id},bl=e=>e.facade&&!e.autoplay&&["youtube","vimeo"].includes(ze(e).kind),yl=e=>!!e.lightbox&&!["none","invalid"].includes(ze(e).kind);function vl(e){let t=ze(e);return t.kind==="youtube"?`<iframe src="${s(ur(e))}" title="Video" allow="accelerometer;autoplay;clipboard-write;encrypted-media;picture-in-picture" allowfullscreen loading="lazy"></iframe>`:t.kind==="vimeo"?`<iframe src="${s(ur(e))}" title="Video" allow="autoplay;fullscreen;picture-in-picture" allowfullscreen loading="lazy"></iframe>`:t.kind==="file"?`<video src="${s(t.id)}"${e.controls?" controls":""}${e.autoplay?" autoplay":""}${e.muted||e.autoplay?" muted playsinline":""}${e.loop?" loop":""}${e.poster?` poster="${s(e.poster)}"`:""}></video>`:t.kind==="none"?'<div style="position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#94a3b8;font:500 13px sans-serif">Add a video URL</div>':t.kind==="invalid"?'<div style="position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#94a3b8;font:500 13px sans-serif">Unsupported video URL</div>':`<iframe src="${s(t.id)}" title="Video" allowfullscreen loading="lazy"></iframe>`}function $t(e){let t=String(e??"").replace(/\r\n?/g,`
`).trim();return t?t.split(/\n{2,}/).map(r=>`<p>${s(r).replace(/\n/g,"<br>")}</p>`).join(""):""}function Ve(e){let t=String(e??""),r=t.toLowerCase(),a=new Set(["script","style","textarea","title","xmp","iframe","noembed","noframes","plaintext"]),i=m=>{let d="";for(let E=m;E<t.length;E++){let P=t[E];if(d)P===d&&(d="");else if(P==='"'||P==="'")d=P;else if(P===">")return E}return-1},n=(m,d)=>{let E=d;for(;(E=r.indexOf(`</${m}`,E))>=0;){let P=r[E+m.length+2]||"";if(!P||/[\s/>]/.test(P))return E;E+=m.length+2}return-1},o=m=>m.replace(/^(<\s*\/?\s*)main\b/i,"$1div"),c="",f=0;for(;f<t.length;){let m=t.indexOf("<",f);if(m<0){c+=t.slice(f);break}if(c+=t.slice(f,m),t[m+1]==="!"&&t[m+2]==="-"&&t[m+3]==="-"){let F=t.indexOf("-->",m+4),V=F<0?t.length:F+3;c+=t.slice(m,V),f=V;continue}let d=i(m+1);if(d<0){c+=t.slice(m);break}let E=t.slice(m,d+1),P=E.match(/^<\s*(\/?)\s*([a-z][\w:-]*)\b/i),w=!!(P&&P[1]),D=P?P[2].toLowerCase():"";if(!D||w||!a.has(D)||/\/\s*>$/.test(E)){c+=D==="main"?o(E):E,f=d+1;continue}let N=n(D,d+1);if(N<0){c+=E+t.slice(d+1);break}let R=i(N+2+D.length);if(R<0){c+=E+t.slice(d+1);break}c+=E+t.slice(d+1,R+1),f=R+1}return c}var xl={arrow:je.arrow,check:je.check,plus:je.plus};function wl(e,t,r,a){let i=a.col&&a.item&&a.col.id===e.collection&&js(e)?a.col.slug+"/"+a.item.slug:e.slug,n=m=>s((a.rel||"")+Tr(i,m)),o=m=>m===t?`<span class="pagecraft-page on" aria-current="page">${m}</span>`:`<a class="pagecraft-page" href="${n(m)}">${m}</a>`,c=(m,d,E)=>m>=1&&m<=r?`<a class="pagecraft-page ${E}" href="${n(m)}" rel="${E}">${d}</a>`:`<span class="pagecraft-page ${E} off" aria-hidden="true">${d}</span>`,f=Array.from({length:r},(m,d)=>o(d+1)).join("");return'<nav class="pagecraft-pager" aria-label="Pages">'+c(t-1,"Previous","prev")+f+c(t+1,"Next","next")+"</nav>"}var kl=["section","div","header","footer","main","article","aside","nav"],Sl=["div","article","aside","nav","header","footer","main","section","ul","ol","li"],ae=e=>{let t=String(e??"").trim();return/^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?$/.test(t)?t:""};function $l(e,t){return t&&e.at(-1)===t.id?e.slice(0,-1):e}function Ye(e,t){if(!t.edit&&!t.publicIds)return Dr([[e]],t)[0];if(t.formRouting?.count(),!Le[e.type])return"";if(e.use&&!(t.inst&&t.inst===e)){let u=De(e.use),h=[...t.placementPath||[],e.id],p=s(e.id+(t.edit?(t.placementPath||[]).map(k=>"-"+k.replace(/^n/,"")).join(""):"")),b=(h?.length||0)>1?"":` data-id="${s(e.id)}" data-t="${s(e.type)}"`;return u&&(t.stack||[]).includes(e.use)?t.edit?`<div id="${p}"${b} class="s-missing">${s(u.name)} contains itself</div>`:"":u?Ye(u.node,{...t,inst:e,cdef:u,placementPath:h,stack:[...t.stack||[],e.use]}):t.edit?`<div id="${p}"${b} class="s-missing">Missing component: ${s(e.use)}</div>`:""}let a=t.inst&&t.cdef&&e===t.cdef.node?t.inst:null,i=!!t.inst&&!a,n=a||e,o=n.props.ts&&er(n.props.ts)?" ts-"+n.props.ts:e.props.ts&&er(e.props.ts)?" ts-"+e.props.ts:"",c=Me(n).map(u=>" c-"+u.id).join("")+(a?Me(e).map(u=>" c-"+u.id).join(""):""),f=t.edit?{cls:"",at:""}:Fs(n),m="",d=u=>`class="${u} ${s(or(e))}${a?" "+s(or(a)):""}${o}${c}${f.cls}${m}${n.adv&&n.adv.cls?" "+s(n.adv.cls):""}"`,E=t.repeat&&t.item?"-"+t.item.slug:"",P=i&&t.inst?"-"+String(t.inst.id).replace(/^n/,""):"",w=n.src||e.src,D=w?ke(w):null,N=D?{...t,col:D,item:Ws(D,t.col||null,t.item||null,!!t.repeat)}:t;if(!t.edit&&e.showIf&&!kn(e,N.col||null,N.item||null,t.inst||null,t.cdef||null))return"";let R=(t.inst?(t.placementPath||[]).slice(0,-1):t.placementPath||[]).map(u=>"-"+u.replace(/^n/,"")).join(""),F=Ii(n)+E+P,V=!n.adv?.htmlId&&(t.placementPath?.length||0)>1,U=u=>{let h=[u];if(e.type==="nav"&&!l.managedMobileLinks)h.push(u+"-menu"),l.mobileMenu!=="fullscreen"&&Sn({...e,props:l})&&h.push(u+"-menu-content");else if(e.type==="tabs"&&Array.isArray(l.items))l.items.forEach((p,b)=>h.push(u+"-t"+b,u+"-p"+b));else if(fn(e.type))gn(e.type,l).forEach((p,b)=>h.push(u+"-f"+b)),Ut(l,String(n.id||e.id).replace(/[^A-Za-z0-9_-]/g,"")).action||h.push(u+"-status");else if(e.type==="image"&&vn(l,t))h.push(u+"-caption");else if(An[e.type]){let p=e.type==="chapters"?l.chapters:l.items;Array.isArray(p)&&p.forEach((b,k)=>An[e.type].forEach(y=>h.push(`${u}-${y}-${k}`)))}return h},W,H=()=>{if(W!==void 0)return W;let u=F;if(!t.edit&&t.publicIds){let h=t.publicIds;if(h.reserving)V||U(F).forEach(p=>h.reserved.add(p));else{let p=b=>U(b).some(k=>h.used.has(k)||h.reserved.has(k));if(V&&p(u)){let b=F+R;u=b;let k=2;for(;p(u);)u=b+"-"+k++}U(u).forEach(b=>h.used.add(b))}}return W=s(t.edit?(t.repIndex?n.id+E+P:n.id+P)+R:u)},Ee=t.edit&&!i&&t.repeat&&N.col&&N.item&&bi(N.col,N.item.id)?` data-cms-col="${s(N.col.id)}" data-cms-item="${s(N.item.id)}"`:"",be=i||(t.placementPath?.length||0)>1?"":` data-id="${s(n.id)}" data-t="${s(n.type)}"${Ee}${M.ui.sel===n.id?" data-sel":""}`,L=()=>`id="${H()}"${t.edit?be:""}${f.at}`,re=e.slot&&t.inst?nl(t.inst,t.cdef||null,e.slot):null,st=re&&re.length?re:e.children||[],lt=re&&re.length?{...N,inst:null,cdef:null,stack:$l(t.stack||[],t.cdef),placementPath:(t.placementPath?.length||0)>1?t.placementPath:void 0}:N,se=e.type==="list"?"":st.map(u=>Ye(u,lt)).join("");if(t.formRouting&&e.type!=="list"&&e.type!=="nav"&&!fn(e.type))return"";let l=Ys(e,N.col||null,N.item||null,t.inst||null,t.cdef||null),Ae=l.target==="_blank"?' target="_blank" rel="noopener"':"";switch(t.edit&&e.showIf&&!kn(e,N.col||null,N.item||null,t.inst||null,t.cdef||null)&&(m=" s-cond-off"),e.type){case"section":{let u=l.tag&&kl.includes(l.tag)?l.tag:"section",h=se||(t.edit?`<div class="s-empty">${J("plus",12)} Drop a Row or component here</div>`:""),p=l.floating?` data-floating="1"${t.edit?' data-floating-edit="1"':""}`:"";return`<${u} ${L()} ${d("pagecraft-section")}${p}><div class="pagecraft-container${l.width==="full"?" full":""}">${h}</div></${u}>`}case"row":return`<div ${L()} ${d("pagecraft-row")}>${se||(t.edit?`<div class="s-empty">${J("plus",12)} Drop a Column</div>`:"")}</div>`;case"box":{let u=l.layout==="flex"||l.layout==="grid"?" l-"+l.layout:"",h=ue(l.link,t),p=String(l.tags==null?"":l.tags).trim(),b=p?` data-filter-tags="${s(p)}"`:"",k=e.css.d?.position==="absolute"&&!!(e.css.d?.["background-image"]||e.css.d?.["background-color"]||e.css.d?.background),y=se||(t.edit&&!k?`<div class="s-empty">${J("plus",12)} Drop anything here</div>`:"");if(h)return`<a ${L()} ${d("pagecraft-box"+u)} href="${s(h)}"${Ae}${b}>${y}</a>`;let S=l.tag&&Sl.includes(l.tag)?l.tag:"div";return`<${S} ${L()} ${d("pagecraft-box"+u)}${b}>${y}</${S}>`}case"slider":{let u=`<div ${L()} ${d("pagecraft-slider")} data-slides role="group" aria-label="${s(String(l.aria||"Slides"))}" tabindex="0">`+(se||(t.edit?`<div class="s-empty">${J("plus",12)} Drop a Column \u2014 it becomes a slide</div>`:""))+"</div>";if(!l.arrows)return u;let h=(p,b)=>`<button type="button" class="pagecraft-slide-btn ${p}" data-slide-${p} aria-label="${b}" hidden><svg class="" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">${je.caret}</svg></button>`;return`<div class="pagecraft-slider-box${l.controlsPosition==="bottom"?" controls-bottom":""}" data-slider${l.pagination==="progress"?' data-pagination="progress"':""}>${u}`+h("p","Previous slides")+h("n","Next slides")+'<div class="pagecraft-slider-dots" data-slide-dots role="group" aria-label="Choose a slide" hidden></div><div class="pagecraft-slider-progress" data-slide-progress aria-hidden="true" hidden><span class="pagecraft-slider-progress-fill" data-slide-progress-fill></span></div></div>'}case"list":{let u=e.src?ke(e.src):null,h=e.children||[];if(!u)return t.edit?`<div ${L()} ${d("pagecraft-list")}><div class="s-empty">${J("plus",12)} Pick a collection for this list</div></div>`:"";if(!h.length)return t.edit?`<div ${L()} ${d("pagecraft-list")}><div class="s-empty">${J("plus",12)} Drop a Column \u2014 it becomes the card</div></div>`:"";t.formRouting?.count(u.items.length);let p=vi(e,u);if(!p.length){let I=!!nt(u,l.where)&&_n.some(([q])=>q===l.op)&&(l.op==="set"||l.op==="unset"||String(l.val??"").trim()!==""),O=u.items.length?I&&yi(u).length?"No items match these filters.":"No items to display.":`${s(u.name)} has no items yet`;return t.edit?`<div ${L()} ${d("pagecraft-list")}><div class="s-empty">${O}</div></div>`:""}let b=parseInt(String(l.per||""),10),k=b>0&&t.pg?_s(t.pg):null,y=!!k&&k.node.id===e.id,S=y?zs(e,u):1,v=y?Math.min(Math.max(1,t.pageNo||1),S):1,$=(y?p.slice((v-1)*b,v*b):p).map((I,O)=>{let q=t.formRouting&&{...t.formRouting,items:[...t.formRouting.items,[u.id,I.id]]};return h.map(z=>Ye(z,{...t,col:u,item:I,repeat:!0,repIndex:O,formRouting:q})).join("")}).join("");if(t.formRouting)return"";let A=pn(e)||a&&pn(a)?` role="group" aria-label="${s(u.name)}" tabindex="0"`:"",T=l.collectionLayout==="slider"?`<div class="pagecraft-slider-box controls-bottom" data-slider><div ${L()} ${d("pagecraft-list pagecraft-slider")} data-slides role="group" aria-label="${s(u.name)}" tabindex="0">${$}</div><button type="button" class="pagecraft-slide-btn p" data-slide-p aria-label="Previous slides" hidden>${J("caret",15)}</button><button type="button" class="pagecraft-slide-btn n" data-slide-n aria-label="Next slides" hidden>${J("caret",15)}</button><div class="pagecraft-slider-dots" data-slide-dots role="group" aria-label="Choose a slide" hidden></div></div>`:`<div ${L()} ${d("pagecraft-list")}${A}>${$}</div>`;return y&&S>1?T+wl(t.pg,v,S,t):T}case"column":return`<div ${L()} ${d("pagecraft-column"+(t.edit&&!se?" s-column-empty":""))}>${se||(t.edit?`<div class="s-empty">${J("plus",12)} Drop a component</div>`:"")}</div>`;case"heading":{let u=l.level&&/^(h[1-6]|p|div)$/.test(l.level)?l.level:"h2",h=s(l.text).replace(/\n/g,"<br>"),p=ue(l.link,t),b=p?`<a href="${s(p)}"${Ae}>${h}</a>`:h;return`<${u} ${L()} ${d("pagecraft-heading")}>${b}</${u}>`}case"text":return`<div ${L()} ${d("pagecraft-wysiwyg"+(t.edit&&!jt(l.html)?" s-rich-empty":""))}>${He(l.html)||(t.edit?"<p></p>":"")}</div>`;case"quote":{let u=`<p>${s(l.text).replace(/\n/g,"<br>")}</p>`,h=xe(l.source),p=h?` cite="${s(h)}"`:"",b=String(l.by||"").trim();if(!b)return`<blockquote ${L()}${p} ${d("pagecraft-quote")}>${u}</blockquote>`;let k=h?`<a href="${s(h)}">${s(b)}</a>`:s(b);return`<figure ${L()} ${d("pagecraft-quote")}><blockquote${p}>${u}</blockquote><figcaption class="pagecraft-attrib">${k}</figcaption></figure>`}case"image":{let u=s(l.src||K),h=!t.edit&&l.lazy?' loading="lazy" decoding="async"':"",p=l.w&&l.h?` width="${parseInt(l.w,10)}" height="${parseInt(l.h,10)}"`:l.src?"":' width="800" height="500"',b=` alt="${l.decorative?"":s(l.alt)}"`,k=ue(l.link,t),y=String(l.label||"").trim(),v=vn(l,t)?H()+"-caption":"",g=l.decorative&&y?` aria-label="${s(y)}"`:v?` aria-labelledby="${v}"`:"",$=t.variants&&!t.edit&&/^asset:[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(String(l.src||""))?$s(l.w).map(T=>`${l.src}@${T} ${T}w`):[],A=$.length?` srcset="${s($.join(", "))}" sizes="${s(As(e.id))}"`:"";if(l.caption){let T=`<img src="${u}"${A}${b}${p}${h} class="pagecraft-image">`;return`<figure ${L()} ${d("pagecraft-figure")}>${k?`<a href="${s(k)}"${Ae}${g}>${T}</a>`:T}<figcaption${v?` id="${v}"`:""} class="pagecraft-caption">${s(l.caption)}</figcaption></figure>`}return k?`<a ${L()} ${d("pagecraft-figure")} href="${s(k)}"${Ae}${g}><img src="${u}"${A}${b}${p}${h} class="pagecraft-image"></a>`:`<img ${L()} src="${u}"${A}${b}${p}${h} ${d("pagecraft-image")}>`}case"video":{let u=ae(l.ratio)||"16 / 9",h=`${L()} ${d("pagecraft-video")} style="aspect-ratio:${s(u)}"`,p=yl(l);if(!p&&!bl(l))return`<div ${h}>${vl(l)}</div>`;let b=hl(l),k=ze(l),y=p&&k.kind==="file"?`data-video-src="${s(k.id)}"${l.controls?' data-video-controls=""':""}${l.loop?' data-video-loop=""':""}${l.muted?' data-video-muted=""':""}`:`data-embed="${s(ur(p?{...l,autoplay:0}:l))}"`;return`<div ${h}${p?` data-video-lightbox data-ratio="${s(u)}"`:" data-facade"}><button class="pagecraft-video-play" type="button" ${y} aria-label="${p?"Play video in lightbox":"Play video"}">`+(b?`<img src="${s(b)}" alt="" loading="lazy" decoding="async">`:"")+'<span class="pagecraft-video-icon" aria-hidden="true"></span></button></div>'}case"button":{let u=l.icon&&l.icon!=="none"?`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${xl[l.icon]||""}</svg>`:"",h=ue(l.link,t),p=h?"a":"button",b=String(l.rel||"").trim().split(/\s+/).filter(Boolean);l.target==="_blank"&&!b.includes("noopener")&&b.push("noopener");let k=h?`href="${s(h)}"${l.target==="_blank"?' target="_blank"':""}${b.length?` rel="${s(b.join(" "))}"`:""}`:'type="button"',y=["outline","ghost","link"].includes(String(l.variant))?String(l.variant):"solid";return`<${p} ${L()} ${d("pagecraft-button")} data-variant="${y}" ${k}><span>${s(l.text)}</span>${u}</${p}>`}case"nav":{let u=l.managedMobileLinks&&t.edit&&M.ui.mode==="component"&&M.ui.cedit?Ei(M.ui.cedit):null,h=l.managedMobileLinks?t.mobileMenuItems||(Array.isArray(u?.node.props.items)?u.node.props.items:[]):Array.isArray(l.items)?l.items:[],p=s(l.aria||"Main"),b=H()+"-menu",k=/^[a-z0-9_-]+$/.test(String(l.menuLocation||""))?` data-pagecraft-menu-location="${s(String(l.menuLocation))}"`:"",y=new Map(h.filter(A=>A.id).map(A=>[String(A.id),A])),S=(A,T)=>h.filter(I=>{let O=String(I.parentId||"");return A?O===A:!O||!y.has(O)}).map(I=>{let O=String(I.id||"");if(O&&T.has(O))return"";let q=String(I.cls||"").trim().split(/\s+/).filter(Boolean),z=new Set(T);O&&z.add(O);let _=O?S(O,z):"";_&&q.push("menu-item-has-children");let X=q.length?` class="${s(Array.from(new Set(q)).join(" "))}"`:"",G=String(I.rel||"").trim().split(/\s+/).filter(Boolean);I.target==="_blank"&&!G.includes("noopener")&&G.push("noopener");let ge=I.target==="_blank"?' target="_blank"':"",me=G.length?` rel="${s(G.join(" "))}"`:"";return`<li${X}><a href="${s(ue(I.href,t)||"#")}"${ge}${me}>${s(I.label||"")}</a>`+(_?`<ul class="sub-menu">${_}</ul>`:"")+"</li>"}).join("");if(l.managedMobileLinks)return`<div ${L()} ${d("pagecraft-nav-menu pagecraft-mobile-nav-links")}><ul class="pagecraft-nav-list pagecraft-managed-mobile-links">${S("",new Set)}</ul></div>`;let v=l.mobileMenu!=="fullscreen"?Sn({...e,props:l}):null,g=v?{...v.node,id:n.id+"-mobile",use:v.id,children:[],css:{d:{},t:{},m:{}},cls:[],adv:{htmlId:"",cls:"",css:""}}:null,$=g?`<div id="${b}-content" data-nav-content hidden>${Ye(g,{...t,inst:void 0,cdef:void 0,mobileMenuItems:h})}</div>`:"";return t.formRouting?"":`<nav ${L()} ${d("pagecraft-nav-menu")} data-nav data-mobile-menu="${l.mobileMenu==="fullscreen"?"fullscreen":"dropdown"}"${k} aria-label="${p}"><button class="pagecraft-nav-toggle" data-nav-t type="button" aria-expanded="false" aria-controls="${g?b+"-content":b}" aria-label="${p} menu"><span class="pagecraft-nav-icon"></span></button><ul class="pagecraft-nav-list" id="${b}" data-nav-l>`+S("",new Set)+`</ul>${$}</nav>`}case"form":case"dockbar":case"slotpicker":{let u=at(e.type,l),h=gn(e.type,u),p=e.type==="slotpicker"?di(u):[],b=e.type==="dockbar"?" pagecraft-dockbar":e.type==="slotpicker"?" pagecraft-slotpicker":"",k=e.type==="dockbar"?" data-dockbar":e.type==="slotpicker"?` data-slotpicker${t.edit?" data-ready":""}`:"",S=e.type!=="dockbar"&&h.slice(p.length).some(j=>j.type==="date"||j.type==="select")?" data-pagecraft-controls":"",v=j=>H()+"-f"+j,g=String(n.id||e.id).replace(/[^A-Za-z0-9_-]/g,"");if(t.formRouting){let j=Q=>{let he=Ut(u,g,Q);return{...he,fixedQuery:mn(he,h)}};return t.formRouting.visit({placement:JSON.stringify([t.formRouting.region,...t.placementPath||[],e.id]),context:JSON.stringify(t.formRouting.items),cloud:j("pagecraft:cloud-form"),portable:j("")}),""}let $=Ut(u,g),A=$.action,T=A?"":" disabled",I=mn($,h).map(([j,Q])=>`<input type="hidden" name="${s(j)}" value="${s(Q)}">`).join(""),O=h.some(j=>[100,50,33,25,20].includes(Number(j.width))),q=h.map(li),z=$.kind==="cloud"?ys(q):q,_=h.map((j,Q)=>{let he=s(z[Q]),ve=j.required?" required":"",ct=j.ph?` placeholder="${s(j.ph)}"`:"",Zi=[100,50,33,25,20].includes(Number(j.width))?Number(j.width):j.half?50:100,ut=O?" field-width-"+Zi:j.half?" half":"",dt=`<label for="${v(Q)}">${s(j.label||he)}${j.required?' <span aria-hidden="true">*</span>':""}</label>`;if(Q<p.length){let le=p[Q],Qi=le.values.map((Ie,eo)=>{let Re=le.key==="service"?u.passes.find(Rt=>kt([Rt?.passName])[0]===Ie):null,Dt=parseFloat(String(Re?.unitPrice??"")),Nr=Number(Re?.fixedTotal)===1,to=p.some(Rt=>Rt.key==="guests"),Fr=Nr?String(u.fixedLabel??"total"):to?String(u.perGuestLabel??"/ guest"):"",Br=Re&&Number.isFinite(Dt)?` data-price="${Dt}" data-fixed="${Nr?1:0}"`:"",qr=`type="button" data-sp-value="${s(Ie)}"${Br} aria-pressed="${eo===0?"true":"false"}"${T}`;return Re?`<button class="pagecraft-sp-pass" ${qr}><span class="pagecraft-sp-pass-name">${s(Ie)}</span>`+(Re.passMeta?`<span class="pagecraft-sp-pass-meta">${s(String(Re.passMeta))}</span>`:"")+(Br&&Number(u.showPrices??1)?`<span class="pagecraft-sp-pass-price">${s(String(u.currencySymbol??"\u20AC"))}${pi(Dt)}${Fr?" "+s(Fr):""}</span>`:"")+"</button>":`<button class="pagecraft-sp-pill" ${qr}>${s(Ie)}</button>`}).join("");return`<div class="pagecraft-sp-group" data-sp-choice="${le.key}">`+(le.heading?`<p class="pagecraft-sp-step-h" id="${v(Q)}-h">${s(le.heading)}</p>`:"")+`<div class="pagecraft-field pagecraft-sp-native">${dt}<select id="${v(Q)}" name="${he}"${ve}${T}>`+le.values.map(Ie=>`<option value="${s(Ie)}">${s(Ie)}</option>`).join("")+`</select></div><div class="pagecraft-sp-buttons ${le.key==="service"?"pagecraft-sp-passes":"pagecraft-sp-pills"}" role="group" ${le.heading?`aria-labelledby="${v(Q)}-h"`:`aria-label="${s(le.label)}"`}>${Qi}</div></div>`}if(j.type==="checkbox")return`<div class="pagecraft-field pagecraft-field-check${ut}"><input id="${v(Q)}" name="${he}" type="checkbox"${ve}${T}><label for="${v(Q)}">${s(j.label||he)}</label></div>`;if(j.type==="textarea")return`<div class="pagecraft-field${ut}">${dt}<textarea id="${v(Q)}" name="${he}" rows="4"${ve}${ct}${T}></textarea></div>`;if(j.type==="select")return`<div class="pagecraft-field${ut}">${dt}<select id="${v(Q)}" name="${he}"${e.type==="dockbar"?"":" data-pagecraft-select"}${ve}${T}>`+String(j.opts||"").split(",").map(le=>le.trim()).filter(Boolean).map(le=>`<option value="${s(le)}">${s(le)}</option>`).join("")+"</select></div>";let Ji=j.type==="date"&&e.type!=="dockbar"?" data-pagecraft-date":"",Xi=j.type==="date"&&t.edit?" readonly":"";return`<div class="pagecraft-field${ut}">${dt}<input id="${v(Q)}" name="${he}" type="${s(j.type||"text")}"${Ji}${Xi}${ve}${ct}${T}></div>`}),X=H()+"-status",G=`<button type="${A?"submit":"button"}" class="pagecraft-form-button"${A?"":" disabled"}>${s(u.submit||"Send")}</button>`,ge=$.kind==="cloud"?'<div hidden aria-hidden="true"><label>Leave empty<input name="_pc_trap" tabindex="-1" autocomplete="off"></label></div>':"",me=A?"":`<p class="pagecraft-form-status" id="${X}">This form is not configured to receive submissions.</p>`,Ce;if(e.type==="slotpicker"){let j=ve=>p.find(ct=>ct.key===ve)?.values[0]||"",Q=xs(u,j("service"),j("guests")||"1"),he=_.slice(p.length).join("");Ce='<div class="pagecraft-sp-steps">'+_.slice(0,p.length).join("")+(he?`<div class="pagecraft-sp-group">${u.contactHeading===""?"":`<p class="pagecraft-sp-step-h">${s(String(u.contactHeading??"Your details"))}</p>`}<div class="pagecraft-sp-contact${O?" pagecraft-sp-percent":""}">${he}</div></div>`:"")+'</div><div class="pagecraft-sp-summary">'+(u.summaryTitle===""?"":`<h3 class="pagecraft-sp-sum-title">${s(String(u.summaryTitle??"Your request"))}</h3>`)+(p.length?'<div class="pagecraft-sp-rows">'+p.map(ve=>`<div class="pagecraft-sp-row"><span>${s(ve.label)}</span><strong data-sp-out="${ve.key}">${s(ve.values[0])}</strong></div>`).join("")+"</div>":"")+(Q?`<div class="pagecraft-sp-total-row" aria-live="polite"><span>${s(String(u.totalLabel??"Estimated total"))}</span><span class="pagecraft-sp-total" data-sp-total data-sym="${s(String(u.currencySymbol??"\u20AC"))}">${s(Q)}</span></div>`:"")+ge+G+(u.note?`<p class="pagecraft-sp-note">${s(String(u.note))}</p>`:"")+me+"</div>"}else Ce=_.join("")+ge+G+me;let Se="pagecraft-form"+(O?" pagecraft-form-percent":"")+b;if(!A)return`<div ${L()} ${d(Se)} role="group" aria-label="${s(u.aria||"Form")}" aria-describedby="${X}" data-disabled${S}${k}>${Ce}</div>`;let Ki=$.kind==="wordpress"?` data-pagecraft-form-mode="wordpress" data-pagecraft-form-id="${s(g)}"`:"";return`<form ${L()} ${d(Se)} aria-label="${s(u.aria||"Form")}" action="${s(A)}" method="${$.method}"${Ki}${S}${k}>`+I+Ce+"</form>"+($.kind==="cloud"&&!t.edit?"<script>(function(f){var ns='__pagecraftFormRequests',a=f.getAttribute('action')||'',n=0,forms=document.forms,x;for(x=0;x<forms.length;x++){if(forms[x]===f)break;if((forms[x].getAttribute('action')||'')===a)n++}var k=a+'#'+n,valid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;function uuid(){var c=window.crypto,b=new Uint8Array(16),j;if(c&&typeof c.randomUUID==='function')try{return c.randomUUID()}catch(e){}if(c&&typeof c.getRandomValues==='function')try{c.getRandomValues(b)}catch(e){for(j=0;j<16;j++)b[j]=Math.random()*256}else for(j=0;j<16;j++)b[j]=Math.random()*256;b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;var h=Array.from(b,function(v){return v.toString(16).padStart(2,'0')}).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)}function objectState(){var s=history.state;return s&&typeof s==='object'&&!Array.isArray(s)?s:null}function remember(v){var current=history.state;if(current!==null&&(!current||typeof current!=='object'||Array.isArray(current)))return;var next=Object.assign({},current||{}),prior=next[ns],requests=prior&&typeof prior==='object'&&!Array.isArray(prior)?Object.assign({},prior):{};requests[k]=v;next[ns]=requests;try{history.replaceState(next,'')}catch(e){}}var state=objectState(),requests=state&&state[ns]&&typeof state[ns]==='object'&&!Array.isArray(state[ns])?state[ns]:null,stored=requests&&requests[k],token=typeof stored==='string'&&valid.test(stored)?stored:uuid(),i=document.createElement('input');i.type='hidden';i.name='_pc_request';i.value=token;f.appendChild(i);if(stored!==token)remember(token);f.addEventListener('input',function(){i.value=uuid();remember(i.value)});window.addEventListener('pageshow',function(){var b=f.querySelector('button[type=submit]');if(b)b.disabled=false});f.addEventListener('submit',function(){setTimeout(function(){var b=f.querySelector('button[type=submit]');if(b)b.disabled=true},0)})})(document.currentScript.previousElementSibling)<\/script>":"")}case"crumbs":{let u=l.mode==="manual",h=u?(Array.isArray(l.items)?l.items:[]).map((b,k,y)=>({...b,label:String(b.label||""),href:k===y.length-1?"":String(b.href||"")})):Wn(t.pg,t,String(l.home==null?"Home":l.home));if(!h.length||!u&&t.pg&&bt(t.pg)&&h.length<2)return t.edit?`<nav ${L()} ${d("pagecraft-crumbs")}><div class="s-empty">${J("crumbs",12)}`+(u?" Add a crumb in the panel":" The front page shows no trail")+"</div></nav>":"";let p=h.map((b,k)=>{let y=k===h.length-1,S=s(b.label),v=y?"":ue(b.href,t),g=u?String(b.cls||"").trim():"",$=g?` class="${s(g)}"`:"",A=u?String(b.rel||"").trim().split(/\s+/).filter(Boolean):[],T=u&&b.target==="_blank"?' target="_blank"':"";T&&!A.includes("noopener")&&A.push("noopener");let I=A.length?` rel="${s(A.join(" "))}"`:"";return`<li${$}>`+(y||!v?`<span aria-current="page">${S}</span>`:`<a href="${s(v)}"${T}${I}>${S}</a>`)+"</li>"}).join("");return`<nav ${L()} ${d("pagecraft-crumbs")} aria-label="Breadcrumb" data-sep="${s(String(l.sep||"chevron"))}"><ol>${p}</ol></nav>`}case"code":{let u=String(l.body==null?"":l.body);if(!u.trim())return t.edit?`<div ${L()} ${d("pagecraft-code")}><div class="s-empty">${J("codeblock",12)} Paste the code in the panel</div></div>`:"";let h=String(l.lang||"text"),p=Vo(u,h);l.numbers&&(p=p.split(`
`).map(y=>`<span class="pagecraft-code-line">${y}</span>`).join(`
`));let b=String(l.title==null?"":l.title).trim(),k=b||l.copy?`<figcaption class="pagecraft-code-head">${b?`<span>${s(b)}</span>`:"<span></span>"}`+(l.copy?'<button type="button" class="pagecraft-code-copy" data-copy hidden>Copy</button>':"")+"</figcaption>":"";return`<figure ${L()} ${d("pagecraft-code")}${l.softwrap?" data-wrap":""}${l.numbers?" data-numbers":""}>`+k+`<pre><code class="language-${s(h)}">${p}</code></pre></figure>`}case"table":{let u=Yo(l.body);if(!u.length)return t.edit?`<div ${L()} ${d("pagecraft-table-wrap")}><div class="s-empty">${J("plus",12)} Paste or type the rows in the panel</div></div>`:"";let h=String(l.caption==null?"":l.caption).trim(),p=l.head&&u.length>1?u[0]:null,b=p?u.slice(1):u,k=(v,g)=>l.rowhead&&g===0?`<th scope="row">${s(v)}</th>`:`<td>${s(v)}</td>`,y=p?`<thead><tr>${p.map(v=>`<th scope="col">${s(v)}</th>`).join("")}</tr></thead>`:"",S=`<tbody>${b.map(v=>`<tr>${v.map(k).join("")}</tr>`).join("")}</tbody>`;return`<div ${L()} ${d("pagecraft-table-wrap")}><table class="pagecraft-table" data-rules="${s(String(l.rules||"rows"))}"${l.zebra?" data-zebra":""}>`+(h?`<caption>${s(h)}</caption>`:"")+y+S+"</table></div>"}case"tabs":{let u=Array.isArray(l.items)?l.items:[];if(!u.length)return t.edit?`<div ${L()} ${d("pagecraft-tabs")}><div class="s-empty">${J("plus",12)} Add a tab in the panel</div></div>`:"";let h=yr(e),p=!h&&t.edit&&M.ui.sel===e.id,b=h&&t.edit?Math.max(0,is(e).findIndex(g=>!!M.ui.sel&&!!ne(M.ui.sel,[g]))):0,k=g=>`${H()}-t${g}`,y=g=>`${H()}-p${g}`,S=u.map((g,$)=>`<button type="button" role="tab" id="${k($)}" aria-controls="${y($)}" aria-selected="${$===b?"true":"false"}" tabindex="${$===b?"0":"-1"}" class="pagecraft-tab${$===b?" on":""}">${s(g.label||"Tab "+($+1))}</button>`).join(""),v=u.map((g,$)=>`<div role="tabpanel" id="${y($)}" aria-labelledby="${k($)}"${$===b||p?"":" data-tab-idle"} class="pagecraft-tabpanel">${h?dr(e.children.filter(A=>A.id===g.panelId),t):$t(g.panel)}</div>`).join("");return`<div ${L()} ${d("pagecraft-tabs")} data-tabs><div class="pagecraft-tablist" role="tablist">${S}</div>${v}</div>`}case"accordion":{let u=Array.isArray(l.items)?l.items:[];if(!u.length)return t.edit?`<div ${L()} ${d("pagecraft-accordion")}><div class="s-empty">${J("plus",12)} Add a question in the panel</div></div>`:"";let h=l.single?` name="${H()}-ac"`:"",p=l.marker==="none"?"":'<span class="pagecraft-accordion-mark" aria-hidden="true"></span>',b=t.edit&&M.ui.sel===e.id,k=u.map((y,S)=>{let v=l.open==="all"||l.open==="first"&&S===0,g=b||(l.single?v&&S===0:v);return`<details class="pagecraft-accordion-item"${h}${g?" open":""}><summary class="pagecraft-accordion-q"><span>${s(String(y.q==null?"":y.q)).replace(/\n/g," ")}</span>${p}</summary><div class="pagecraft-accordion-a">${$t(y.a)}</div></details>`}).join("");return`<div ${L()} ${d("pagecraft-accordion")} data-marker="${s(l.marker||"plus")}">${k}</div>`}case"embed":{let u=String(l.html==null?"":l.html),h=e.bind&&e.bind.html?s(u):u,p=ae(l.ratio),b=p?` style="aspect-ratio:${s(p)}"`:"",k="pagecraft-embed"+(p?" pagecraft-embed-ratio":"");if(!h.trim())return t.edit?`<div ${L()} ${d("pagecraft-embed")}><div class="s-empty">${J("code",12)} Paste embed HTML in the panel</div></div>`:"";if(!t.edit&&!t.canvas)return`<div ${L()} ${d(k)}${b}>${h}</div>`;if(!t.edit){let $='<!doctype html><meta charset="utf-8"><style>'+("html,body{margin:0}body{display:flow-root}body>*{box-sizing:border-box;max-width:100%}"+(p?"html,body{height:100%}body{position:relative}body>iframe,body>video,body>embed,body>object{position:absolute;inset:0;width:100%;height:100%;border:0}":""))+"</style>"+h+(p?"":`<script>${Ll}<\/script>`);return`<div ${L()} ${d(k)}${b}><iframe sandbox="allow-scripts" srcdoc="${s($)}" title="Embed preview" data-embed-frame${p?"":' style="display:block;width:100%;height:150px;border:0"'}></iframe></div>`}let{html:y,stripped:S}=ta(h),v=S?`<div class="s-held">${S} script${S===1?"":"s"} held back here \u2014 ${S===1?"it runs":"they run"} on the exported page</div>`:"";return`<div ${L()} ${d(k)}${b}>${y}${v}${y.trim()?"":'<div class="s-empty">Nothing to draw without its script</div>'}</div>`}case"icon":{let u=!!(l.name&&_e[l.name]);if(!u&&Xe(e,"name")){if(!t.edit)return"";let k=String(l.name==null?"":l.name).trim(),y=k?`\u201C${k}\u201D is not an icon name`:"No icon for this item";return`<span ${L()} ${d("pagecraft-icon s-icon-missing")} role="img" aria-label="${s(y)}" title="${s(y)}">?</span>`}let h=u?String(l.name):"check",p=String(l.label==null?"":l.label).trim(),b=ue(l.link,t);return b?`<a ${L()} ${d("pagecraft-icon")} href="${s(b)}"${Ae}${p?` aria-label="${s(p)}"`:""}>${Ot(h,'class="pagecraft-icon-glyph" aria-hidden="true"')}</a>`:Ot(h,`${L()} ${d("pagecraft-icon pagecraft-icon-glyph")} ${p?`role="img" aria-label="${s(p)}"`:'aria-hidden="true"'}`)}case"gallery":{let u=(Array.isArray(l.items)?l.items:[]).filter(Boolean);if(!u.length)return t.edit?`<div ${L()} ${d("pagecraft-gallery")}><div class="s-empty">${J("image",12)} Add images in the panel</div></div>`:"";let h=!t.edit&&l.lazy?' loading="lazy" decoding="async"':"",p=u.map((y,S)=>{let v=y.w&&y.h?` width="${parseInt(y.w,10)}" height="${parseInt(y.h,10)}"`:"",g=s(y.src||K),$=String(y.alt==null?"":y.alt),A=`<img src="${g}" alt="${s($)}"${v}${h} class="pagecraft-gallery-img">`,T=$.trim()?$:String(y.caption==null?"":y.caption).trim()||`Open image ${S+1}`;return`<figure class="pagecraft-gallery-item">${l.lightbox?`<a class="pagecraft-gallery-frame" href="${g}" data-lb="${S}" aria-label="${s(T)}">${A}</a>`:`<span class="pagecraft-gallery-frame">${A}</span>`}${l.captions&&y.caption?`<figcaption class="pagecraft-gallery-caption">${s(y.caption)}</figcaption>`:""}</figure>`}).join(""),b=l.galleryLayout==="masonry",k=b?"":ae(l.ratio);return`<div ${L()} ${d("pagecraft-gallery"+(b?" pagecraft-gallery-masonry":k?" pagecraft-gallery-fixed":""))}${l.lightbox?" data-lightbox":""}${k?` style="--g-ratio:${s(k)};--g-fit:${l.fit==="contain"?"contain":"cover"}"`:` style="--g-fit:${l.fit==="contain"?"contain":"cover"}"`}>${p}</div>`}case"audio":{let u=pl(l),h=u.kind==="valid",p=String(l.title==null?"":l.title).trim(),b=String(l.subtitle==null?"":l.subtitle).trim(),k=String(l.artwork==null?"":l.artwork).trim(),y=l.controls===0,S='<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 3.2v9.6l8-4.8z"/></svg>',v='<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3.5" y="3" width="3.2" height="10" rx=".8"/><rect x="9.3" y="3" width="3.2" height="10" rx=".8"/></svg>',g=k?`<img class="pagecraft-audio-art" src="${s(k)}" alt="" loading="lazy" decoding="async">`:"",$=p||b?`<div class="pagecraft-audio-head">${p?`<div class="pagecraft-audio-title">${s(p)}</div>`:""}${b?`<div class="pagecraft-audio-sub">${s(b)}</div>`:""}</div>`:"",A=h?"":" disabled",T=p?`Play ${p}`:"Play audio",I=h?`<audio class="pagecraft-audio-native" preload="metadata" src="${s(u.url)}"${l.loop?" loop":""}${l.autoplay&&!t.edit?" autoplay":""} controls></audio>`:"";return`<div ${L()} ${d("pagecraft-audio")} data-audio${t.edit?" data-audio-edit":""}${y?" data-audio-compact":""}${p?` data-audio-title="${s(p)}"`:""}>`+g+`<div class="pagecraft-audio-main">${$}<div class="pagecraft-audio-bar"><button type="button" class="pagecraft-audio-btn" data-audio-toggle aria-label="${s(T)}" aria-pressed="false"${A}><span class="pagecraft-audio-ic-play" aria-hidden="true">${S}</span><span class="pagecraft-audio-ic-pause" aria-hidden="true">${v}</span></button><div class="pagecraft-audio-track"><input type="range" class="pagecraft-audio-range" data-audio-seek min="0" max="100" value="0" aria-label="Seek audio position"${A}><div class="pagecraft-audio-times"><span class="pagecraft-audio-cur" data-audio-cur>0:00</span><span class="pagecraft-audio-dur" data-audio-dur>0:00</span></div></div><button type="button" class="pagecraft-audio-rate" data-audio-rate aria-label="Playback speed: 1x"${A}>1x</button></div>${I}</div></div>`}case"countdown":{let u=String(l.target==null?"":l.target).trim(),h=String(l.done==null||l.done===""?"Event started":l.done),p=l.showSeconds!==0,b=ml(u),k=b.done&&!t.edit,y=(v,g,$)=>`<div class="pagecraft-countdown-unit"><span class="pagecraft-countdown-val" data-cd-unit="${v}">${s(g)}</span><span class="pagecraft-countdown-lbl">${s($)}</span></div>`,S="pagecraft-countdown"+((l.display??l.layout)==="inline"?" pagecraft-countdown-inline":"");return`<div ${L()} ${d(S)} data-countdown="${s(u)}" data-cd-done="${s(h)}" role="timer" aria-live="off"><div class="pagecraft-countdown-grid" data-cd-grid${k?" hidden":""}>`+y("d",b.d,String(l.lblDays||"Days"))+y("h",b.h,String(l.lblHours||"Hours"))+y("m",b.m,String(l.lblMins||"Mins"))+(p?y("s",b.s,String(l.lblSecs||"Secs")):"")+`</div><div class="pagecraft-countdown-done" data-cd-ended${k?"":" hidden"}>${s(h)}</div></div>`}case"marquee":{let u=l.dir==="right"?"right":"left",h=l.pause===0?"0":"1",p=l.fade!==0,b=String(l.speed||"").trim(),k=/^\d+(?:\.\d+)?(?:ms|s)$/i.test(b)?b:"28s",y=String(l.gap||"").trim(),S=/^\d+(?:\.\d+)?(?:px|rem|em|vw|%)$/i.test(y)?y:"",v=[`--mq-speed:${k}`,...S&&!Ge(e,"--mq-gap")?[`--mq-gap:${S}`]:[]],g="pagecraft-marquee"+(p?" pagecraft-marquee-fade":"");return se?t.edit?`<div ${L()} ${d(g)} data-marquee-edit data-marquee-dir="${u}" data-marquee-pause="${h}" style="${s(v.join(";"))}"><div class="pagecraft-marquee-track">${se}</div></div>`:`<div ${L()} ${d(g)} data-marquee data-marquee-dir="${u}" data-marquee-pause="${h}" style="${s(v.join(";"))}"><div class="pagecraft-marquee-track">${se}</div><div class="pagecraft-marquee-track pagecraft-marquee-dup" aria-hidden="true">${fl(se)}</div></div>`:t.edit?`<div ${L()} ${d(g)} data-marquee-edit data-marquee-dir="${u}" data-marquee-pause="${h}" style="${s(v.join(";"))}"><div class="s-empty">${J("plus",12)} Drop logos, badges, or cards here</div></div>`:""}case"filter":{let u=String(l.group==null||l.group===""?"default":l.group).trim()||"default",h=String(l.all==null||l.all===""?"All":l.all),p=l.align==="center"?"center":l.align==="end"?"flex-end":"flex-start",b=gl(e),k=[`<button type="button" class="pagecraft-filter-btn is-active" role="tab" aria-selected="true" tabindex="0" data-filter-btn data-filter-tag="*">${s(h)}</button>`,...b.map(S=>`<button type="button" class="pagecraft-filter-btn" role="tab" aria-selected="false" tabindex="-1" data-filter-btn data-filter-tag="${s(S)}">${s(S)}</button>`)].join(""),y=se||(t.edit?`<div class="s-empty">${J("plus",12)} Drop Boxes or cards here and set Filter tags</div>`:"");return`<div ${L()} ${d("pagecraft-filter")} data-filter-group="${s(u)}"><div class="pagecraft-filter-bar" role="tablist" aria-label="Filter items" style="justify-content:${p}">${k}</div><div class="pagecraft-filter-grid">${y}</div><p class="pagecraft-filter-empty" data-filter-empty role="status" hidden>No matching items.</p></div>`}case"compare":{let u=parseFloat(String(l.position??"50")),h=Number.isFinite(u)?Math.max(0,Math.min(100,u)):50,p=ae(l.ratio)||"16 / 9",b=s(String(l.beforeSrc||K)),k=s(String(l.afterSrc||K)),y=s(String(l.beforeAlt??"Before comparison view")),S=s(String(l.afterAlt??"After comparison view")),v=l.labels!==0&&l.labels!==!1,g=v?String(l.beforeLabel??"").trim():"",$=v?String(l.afterLabel??"").trim():"",A=t.edit?"":' loading="lazy" decoding="async"';return`<div ${L()} ${d("pagecraft-compare")} data-compare${t.edit?" data-compare-edit":""} style="--cmp-pos:${h}%;--cmp-ratio:${s(p)}"><img class="pagecraft-compare-img pagecraft-compare-after" src="${k}" alt="${S}"${A} draggable="false"><img class="pagecraft-compare-img pagecraft-compare-before" src="${b}" alt="${y}"${A} draggable="false">`+(g?`<span class="pagecraft-compare-tag" data-side="before"${h<30?' data-off="1"':""}>${s(g)}</span>`:"")+($?`<span class="pagecraft-compare-tag" data-side="after"${h>70?' data-off="1"':""}>${s($)}</span>`:"")+`<svg class="pagecraft-compare-line" aria-hidden="true"><path d=""/></svg><div class="pagecraft-compare-handle" aria-hidden="true"><span class="pagecraft-compare-knob"><svg width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 1 1 5l4 4M11 1l4 4-4 4"/></svg></span></div><input type="range" class="pagecraft-compare-range" data-compare-range min="0" max="100" value="${h}" aria-label="Comparison split percentage" aria-valuetext="${Math.round(h)}%"></div>`}case"timeline":{let u=(Array.isArray(l.items)?l.items:[]).filter(Boolean);if(!u.length)return t.edit?`<div ${L()} ${d("pagecraft-timeline")}><div class="s-empty">${J("plus",12)} Add milestones in the panel</div></div>`:"";let h=l.orientation==="horizontal"?"horizontal":"vertical",p=l.marker==="dots"?"dots":"numbers",b=u.map(k=>{let y=String(k.tag||"").trim(),S=String(k.title||"").trim(),v=String(k.detail||"").trim();return'<li class="pagecraft-timeline-item"><span class="pagecraft-timeline-mark" aria-hidden="true"></span><div class="pagecraft-timeline-card">'+(y?`<span class="pagecraft-timeline-tag">${s(y)}</span>`:"")+(S?`<h3 class="pagecraft-timeline-title">${s(S)}</h3>`:"")+(v?`<p class="pagecraft-timeline-detail">${s(v)}</p>`:"")+"</div></li>"}).join("");return`<ol ${L()} ${d("pagecraft-timeline")} data-orientation="${h}" data-marker="${p}">${b}</ol>`}case"progress":{let u=(Array.isArray(l.items)?l.items:[]).filter(Boolean);if(!u.length)return t.edit?`<div ${L()} ${d("pagecraft-progress")}><div class="s-empty">${J("plus",12)} Add progress metrics in the panel</div></div>`:"";let h=l.showValue!==0,p=l.rounded===0?"0":"1",b=H(),k=u.map((y,S)=>{let v=parseFloat(String(y.value??"0")),g=Number.isFinite(v)?Math.max(0,Math.min(100,v)):0,$=String(y.unit??"%"),A=String(y.label||`Metric ${S+1}`),T=`${b}-p-${S}`;return`<div class="pagecraft-progress-item"><div class="pagecraft-progress-head"><label class="pagecraft-progress-label" for="${T}">${s(A)}</label>`+(h?`<span class="pagecraft-progress-val">${s(String(g))}${s($)}</span>`:"")+`</div><progress id="${T}" class="pagecraft-progress-bar" value="${g}" max="100"></progress></div>`}).join("");return`<div ${L()} ${d("pagecraft-progress")} data-rounded="${p}">${k}</div>`}case"hotspot":{let u=s(String(l.src||K)),h=s(String(l.alt||"Interactive diagram")),p=ae(l.ratio),b=t.edit?"":' loading="lazy" decoding="async"',k=l.w&&l.h?` width="${parseInt(String(l.w),10)}" height="${parseInt(String(l.h),10)}"`:"",y=(Array.isArray(l.items)?l.items:[]).filter(Boolean),S=H(),v=y.map(($,A)=>{let T=parseFloat(String($.x??"50")),I=parseFloat(String($.y??"50")),O=Number.isFinite(T)?Math.max(0,Math.min(100,T)):50,q=Number.isFinite(I)?Math.max(0,Math.min(100,I)):50,z=String($.label||String(A+1)),_=String($.title||`Detail ${A+1}`),X=String($.detail||""),G=`${S}-hs-${A}`;return`<button type="button" class="pagecraft-hotspot-pin" style="left:${O}%;top:${q}%" popovertarget="${G}" popovertargetaction="toggle" aria-controls="${G}" aria-expanded="false" aria-label="${s(_)}"><span>${s(z)}</span></button><div id="${G}" class="pagecraft-hotspot-card" popover="auto"><div class="pagecraft-hotspot-card-head"><strong>${s(_)}</strong><button type="button" class="pagecraft-hotspot-close" popovertarget="${G}" popovertargetaction="hide" aria-label="Close">\xD7</button></div>`+(X?`<p class="pagecraft-hotspot-card-body">${s(X)}</p>`:"")+"</div>"}).join(""),g=p?` data-fixed-ratio="1" style="aspect-ratio:${s(p)}"`:"";return`<div ${L()} ${d("pagecraft-hotspot")} data-hotspot${t.edit?" data-hotspot-edit":""}><div class="pagecraft-hotspot-stage"${g}><img class="pagecraft-hotspot-img" src="${u}" alt="${h}"${k}${b}>`+v+"</div></div>"}case"strips":{let u=(Array.isArray(l.items)?l.items:[]).filter(Boolean),h=l.trigger==="hover"?"hover":"click",p=l.captions===0||l.captions===!1?"none":"overlay",b=(g,$)=>{if(g==null||g==="")return $;let A=Number(g);return Number.isFinite(A)?Math.min(100,Math.max(0,Math.round(A))):$},k=b(l.open,50),y=b(l.reach,35),S=b(l.bounce,10),v=u.map((g,$)=>{let A=s(String(g.src||K)),T=s(String(g.alt||g.title||`Panel ${$+1}`)),I=g.w&&g.h?` width="${parseInt(String(g.w),10)}" height="${parseInt(String(g.h),10)}"`:"",O=String(g.title||`Panel ${$+1}`),q=String(g.detail||""),z=String(g.tag||""),_=h==="hover"?"false":$===0?"true":"false",X=p==="none"?` aria-label="${T}"`:"",G=p==="none"?"":`<span class="pagecraft-strip-scrim" aria-hidden="true"></span><span class="pagecraft-strip-rail" aria-hidden="true">${s(O)}</span><span class="pagecraft-strip-body"><span class="pagecraft-strip-title">${s(O)}</span>`+(q?`<span class="pagecraft-strip-detail">${s(q)}</span>`:"")+(z?`<span class="pagecraft-strip-tag">${s(z)}</span>`:"")+"</span>";return`<button type="button" class="pagecraft-strip" aria-expanded="${_}"${X}><img class="pagecraft-strip-img" src="${A}" alt="${p==="none"?"":T}"${I} decoding="async" draggable="false">`+G+"</button>"}).join("");return`<div ${L()} ${d("pagecraft-strips")} data-strips data-trigger="${h}" data-captions="${p}" data-open="${k}" data-reach="${y}" data-bounce="${S}"${t.edit?" data-strips-edit":""}>${v}</div>`}case"switcher":{let u=l.stageLayout==="tabs"?"tabs":"rail",h=ae(l.ratio),p=h?` style="--sw-ratio:${s(h)}"`:"",b=(Array.isArray(l.items)?l.items:[]).filter(Boolean),k=H(),y=b.map((v,g)=>{let $=String(v.label||v.title||`Stage ${g+1}`),A=String(v.meta||""),T=String(v.detail||""),I=`${k}-sw-t-${g}`,O=`${k}-sw-p-${g}`;return`<button type="button" role="tab" class="pagecraft-switcher-tab" id="${I}" aria-selected="${g===0?"true":"false"}" tabindex="${g===0?"0":"-1"}" aria-controls="${O}"><span class="pagecraft-switcher-tab-title">${s($)}</span>`+(A?`<span class="pagecraft-switcher-tab-meta">${s(A)}</span>`:"")+(T?`<span class="pagecraft-switcher-tab-detail">${s(T)}</span>`:"")+"</button>"}).join(""),S=b.map((v,g)=>{let $=s(String(v.src||K)),A=s(String(v.alt||v.title||v.label||`Stage ${g+1}`)),T=v.w&&v.h?` width="${parseInt(String(v.w),10)}" height="${parseInt(String(v.h),10)}"`:"",I=typeof v.pos=="string"&&/^[a-zA-Z0-9.% -]{1,32}$/.test(v.pos.trim())?v.pos.trim():"",O=I?` style="object-position:${s(I)}"`:"",q=String(v.title||v.label||`Stage ${g+1}`),z=String(v.detail||""),_=`${k}-sw-t-${g}`;return`<figure role="tabpanel" class="pagecraft-switcher-panel" id="${`${k}-sw-p-${g}`}" aria-labelledby="${_}" data-active="${g===0?"1":"0"}" aria-hidden="${g===0?"false":"true"}"><img class="pagecraft-switcher-img" src="${$}" alt="${A}"${T}${O} decoding="async"><figcaption class="pagecraft-switcher-cap"><span class="pagecraft-switcher-cap-title">${s(q)}</span>`+(z?`<p class="pagecraft-switcher-cap-text">${s(z)}</p>`:"")+"</figcaption></figure>"}).join("");return`<div ${L()} ${d("pagecraft-switcher")} data-switcher data-layout="${s(u)}"${t.edit?" data-switcher-edit":""}${p}><div class="pagecraft-switcher-list" role="tablist">${y}</div><div class="pagecraft-switcher-stage">${S}</div></div>`}case"exhibit":{let u=ae(l.previewRatio),h=u?` style="--ex-ratio:${s(u)}"`:"",p=(Array.isArray(l.items)?l.items:[]).filter(Boolean),b='<svg class="pagecraft-exhibit-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4.5 11.5l7-7M5.5 4.5h6v6" stroke-linecap="round" stroke-linejoin="round"/></svg>',k=p.map((y,S)=>{let v=s(String(y.src||K)),g=s(String(y.alt||y.title||`Entry ${S+1}`)),$=y.w&&y.h?` width="${parseInt(String(y.w),10)}" height="${parseInt(String(y.h),10)}"`:"",A=String(y.title||`Entry ${S+1}`),T=String(y.location||""),I=String(y.scope||""),O=String(y.year||""),q=xe(String(y.href||"").trim()),z=q&&!t.edit?ue(q,t):"",_=`<span class="pagecraft-exhibit-thumb"><img class="pagecraft-exhibit-thumb-img" src="${v}" alt="${g}"${$} decoding="async"></span><span class="pagecraft-exhibit-main"><span class="pagecraft-exhibit-title">${s(A)}</span>`+(T?`<span class="pagecraft-exhibit-loc">${s(T)}</span>`:"")+"</span>"+(I?`<span class="pagecraft-exhibit-scope">${s(I)}</span>`:"<span></span>")+(O?`<span class="pagecraft-exhibit-year">${s(O)}</span>`:"<span></span>")+b;return`<li class="pagecraft-exhibit-item">${z?`<a class="pagecraft-exhibit-row" href="${s(z)}" data-exhibit-idx="${S}">${_}</a>`:`<div class="pagecraft-exhibit-row" data-exhibit-idx="${S}">${_}</div>`}</li>`}).join("");return`<div ${L()} ${d("pagecraft-exhibit")} data-exhibit${t.edit?" data-exhibit-edit":""}${h}><ol class="pagecraft-exhibit-list">${k}</ol><div class="pagecraft-exhibit-float" data-open="0" aria-hidden="true"></div></div>`}case"scrolly":{let u=ae(l.stickyRatio),h=u?` style="--sc-ratio:${s(u)}"`:"",p=(Array.isArray(l.items)?l.items:[]).filter(Boolean),b=p.map((y,S)=>{let v=String(y.title||`Step ${S+1}`),g=String(y.detail||""),$=String(y.fact||"");return`<li class="pagecraft-scrolly-step" data-scrolly-step="${S}" data-active="${S===0?"1":"0"}" tabindex="0"><div class="pagecraft-scrolly-card"><h3 class="pagecraft-scrolly-title">${s(v)}</h3>`+(g?`<p class="pagecraft-scrolly-detail">${s(g)}</p>`:"")+($?`<span class="pagecraft-scrolly-fact">${s($)}</span>`:"")+"</div></li>"}).join(""),k=p.map((y,S)=>{let v=s(String(y.src||K)),g=s(String(y.alt||y.title||`Step ${S+1}`)),$=y.w&&y.h?` width="${parseInt(String(y.w),10)}" height="${parseInt(String(y.h),10)}"`:"",A=String(y.fact||y.title||"");return`<figure class="pagecraft-scrolly-plate" data-scrolly-plate="${S}" data-active="${S===0?"1":"0"}" aria-hidden="${S===0?"false":"true"}"><img class="pagecraft-scrolly-img" src="${v}" alt="${g}"${$} decoding="async">`+(A?`<figcaption class="pagecraft-scrolly-cap">${s(A)}</figcaption>`:"")+"</figure>"}).join("");return`<div ${L()} ${d("pagecraft-scrolly")} data-scrolly${t.edit?" data-scrolly-edit":""}${h}><ol class="pagecraft-scrolly-steps">${b}</ol><div class="pagecraft-scrolly-stage"><div class="pagecraft-scrolly-frame">${k}</div></div></div>`}case"clocks":{let u=(Array.isArray(l.items)?l.items:[]).filter(Boolean),h=Number(l.hour12)===1,p=(g,$)=>{let A=parseFloat(String(g??""));return Number.isFinite(A)?Math.min(24,Math.max(0,A)):$},b=p(l.opens,9),k=p(l.closes,18),y=String(l.openLabel||"Office open"),S=String(l.closedLabel||"After hours"),v=u.map((g,$)=>{let A=String(g.city||`Office ${$+1}`),T=String(g.tz||"UTC"),I=String(g.address||""),O=String(g.phone||""),q=O.replace(/[^+\d]/g,""),z=xe(String(g.href||"").trim()),_=z&&!t.edit?ue(z,t):"",X=String(g.linkLabel||"Directions"),G=String(g.src||"").trim(),ge=g.w&&g.h?` width="${parseInt(String(g.w),10)}" height="${parseInt(String(g.h),10)}"`:"",me=G?`<div class="pagecraft-clocks-media"><img class="pagecraft-clocks-img" src="${s(G)}" alt="${s(String(g.alt||A))}"${ge} decoding="async"></div>`:"",Se=(O&&!t.edit?`<a class="pagecraft-clocks-link" href="tel:${s(q)}">${s(O)}</a>`:O?`<span class="pagecraft-clocks-link">${s(O)}</span>`:"")+(_?`<a class="pagecraft-clocks-link" href="${s(_)}"${/^https?:/i.test(_)?' target="_blank" rel="noopener"':""}>${s(X)}</a>`:"");return`<li class="pagecraft-clocks-card" data-tz="${s(T)}">`+me+`<div class="pagecraft-clocks-top"><span class="pagecraft-clocks-city">${s(A)}</span><time class="pagecraft-clocks-time" data-clocks-time>--:--</time></div><span class="pagecraft-clocks-state" data-clocks-state data-open="0" hidden>${s(S)}</span>`+(I?`<address class="pagecraft-clocks-addr">${s(I).replace(/\n/g,"<br>")}</address>`:"")+(Se?`<div class="pagecraft-clocks-links">${Se}</div>`:"")+"</li>"}).join("");return`<div ${L()} ${d("pagecraft-clocks")} data-clocks data-hour12="${h?"1":"0"}" data-opens="${b}" data-closes="${k}" data-open-label="${s(y)}" data-closed-label="${s(S)}"><ul class="pagecraft-clocks-list">${v}</ul></div>`}case"roster":{let u=ae(l.portraitRatio),h=u?` style="--rs-ratio:${s(u)}"`:"",p=(Array.isArray(l.items)?l.items:[]).filter(Boolean),b=H(),k=(g,$)=>{let A=g===void 0?$:String(g||"").trim();return A?`<strong>${s(A)}:</strong> `:""},y=g=>g.split(/\s+/).filter(Boolean).slice(0,2).map($=>$[0]?.toUpperCase()||"").join("")||"P",S=p.map((g,$)=>{let A=String(g.name||`Partner ${$+1}`),T=String(g.role||""),I=String(g.seat||""),O=String(g.credential||""),q=String(g.quote||""),z=s(String(g.src||K)),_=s(String(g.alt||A)),X=g.w&&g.h?` width="${parseInt(String(g.w),10)}" height="${parseInt(String(g.h),10)}"`:"",G=xe(String(g.href||"").trim()),ge=G&&!t.edit?ue(G,t):"",me=String(g.linkLabel||"Schedule consultation"),Ce=I||O?`<div class="pagecraft-roster-meta">${I?`<span>${k(l.seatLabel,"Chambers")}${s(I)}</span>`:""}${O?`<span>${k(l.credLabel,"Bar")}${s(O)}</span>`:""}</div>`:"";return`<article class="pagecraft-roster-panel" id="${b}-panel-${$}" role="tabpanel" aria-labelledby="${b}-tab-${$}" data-roster-panel="${$}" data-active="${$===0?"1":"0"}" aria-hidden="${$===0?"false":"true"}"><div class="pagecraft-roster-media"><img class="pagecraft-roster-img" src="${z}" alt="${_}"${X} decoding="async"></div><div class="pagecraft-roster-body"><div class="pagecraft-roster-head"><h3 class="pagecraft-roster-name">${s(A)}</h3>`+(T?`<p class="pagecraft-roster-role">${s(T)}</p>`:"")+Ce+"</div>"+(q?`<blockquote class="pagecraft-roster-quote">${s(q)}</blockquote>`:"")+(ge?`<a class="pagecraft-roster-cta" href="${s(ge)}">${s(me)} \u2192</a>`:"")+"</div></article>"}).join(""),v=p.map((g,$)=>{let A=String(g.name||`Partner ${$+1}`),T=String(g.seat||g.credential||"");return`<button type="button" class="pagecraft-roster-tab" id="${b}-tab-${$}" role="tab" aria-controls="${b}-panel-${$}" aria-selected="${$===0?"true":"false"}" tabindex="${$===0?"0":"-1"}" data-roster-tab="${$}"><span class="pagecraft-roster-avatar" aria-hidden="true">${s(y(A))}</span><span class="pagecraft-roster-tmeta"><span class="pagecraft-roster-tname">${s(A)}</span>`+(T?`<span class="pagecraft-roster-tseat">${s(T)}</span>`:"")+"</span></button>"}).join("");return`<div ${L()} ${d("pagecraft-roster")} data-roster${h}><div class="pagecraft-roster-stage">${S}</div><div class="pagecraft-roster-strip" role="tablist" aria-label="Team spotlight">${v}</div></div>`}case"tiers":{let u=["usd","eur","gbp"].includes(String(l.defaultCurrency))?String(l.defaultCurrency):"usd",h=(Array.isArray(l.items)?l.items:[]).filter(Boolean),p=[["usd",String(l.usdLabel||"USD $"),"priceUsd"],["eur",String(l.eurLabel||"EUR \u20AC"),"priceEur"],["gbp",String(l.gbpLabel||"GBP \xA3"),"priceGbp"]].filter(([S,,v])=>S===u||h.length>0&&h.every(g=>String(g[v]||"").trim())),b=p.map(([S,v])=>`<button type="button" class="pagecraft-tiers-cur" data-tiers-cur="${S}" aria-pressed="${S===u?"true":"false"}">${s(v)}</button>`).join(""),y=(Array.isArray(l.items)?l.items:[]).filter(Boolean).map((S,v)=>{let g=String(S.tierName||`Tier ${v+1}`),$=String(S.badge||"").trim(),A=String(S.priceUsd||"$0"),T=String(S.priceEur||""),I=String(S.priceGbp||""),O=(u==="eur"?T:u==="gbp"?I:A)||A,q=String(S.period||""),z=String(S.summary||""),_=String(S.features||"").split(/\r?\n/).map(Se=>Se.trim()).filter(Boolean),X=_.length?`<ul class="pagecraft-tiers-feats">${_.map(Se=>`<li class="pagecraft-tiers-feat"><span class="pagecraft-tiers-check" aria-hidden="true">\u2713</span><span>${s(Se)}</span></li>`).join("")}</ul>`:"",G=String(S.ctaText||"Select tier"),ge=xe(String(S.href||"").trim()),me=ge&&!t.edit?ue(ge,t):"";return`<article class="pagecraft-tiers-card" data-featured="${Number(S.featured)===1?"1":"0"}"><div class="pagecraft-tiers-top"><h3 class="pagecraft-tiers-name">${s(g)}</h3>`+($?`<span class="pagecraft-tiers-badge">${s($)}</span>`:"")+"</div>"+(z?`<p class="pagecraft-tiers-sum">${s(z)}</p>`:"")+`<div class="pagecraft-tiers-price-row"><span class="pagecraft-tiers-price" data-usd="${s(A)}" data-eur="${s(T)}" data-gbp="${s(I)}">${s(O)}</span>`+(q?`<span class="pagecraft-tiers-period">${s(q)}</span>`:"")+"</div>"+X+(me?`<a class="pagecraft-tiers-btn" href="${s(me)}">${s(G)}</a>`:t.edit?`<span class="pagecraft-tiers-btn">${s(G)}</span>`:"")+"</article>"}).join("");return`<div ${L()} ${d("pagecraft-tiers")} data-tiers data-active-cur="${s(u)}">`+(p.length>1?`<div class="pagecraft-tiers-bar" role="group" aria-label="Billing currency"><span class="pagecraft-tiers-cur-lbl">Currency</span>${b}</div>`:"")+`<div class="pagecraft-tiers-grid">${y}</div></div>`}case"qapills":{let h=String(l.pillAlign)==="start"?' style="--qp-align:flex-start;--qp-panel-align:flex-start;--qp-text-align:left"':"",p=(Array.isArray(l.items)?l.items:[]).filter(Boolean),b=H(),k=p.map((S,v)=>{let g=String(S.q||`Question ${v+1}`);return`<button type="button" class="pagecraft-qapills-pill" id="${b}-pill-${v}" role="tab" aria-controls="${b}-ans-${v}" aria-selected="${v===0?"true":"false"}" tabindex="${v===0?"0":"-1"}" data-qa-idx="${v}">${s(g)}</button>`}).join(""),y=p.map((S,v)=>{let g=String(S.q||`Question ${v+1}`),$=String(S.a||""),A=String(S.note||""),T=xe(String(S.href||"").trim()),I=T&&!t.edit?ue(T,t):"",O=String(S.linkLabel||"Learn more");return`<div class="pagecraft-qapills-panel" id="${b}-ans-${v}" role="tabpanel" aria-labelledby="${b}-pill-${v}" data-qa-panel="${v}"${v===0?"":" hidden"}><h3 class="pagecraft-qapills-q">${s(g)}</h3>`+($?`<p class="pagecraft-qapills-a">${s($)}</p>`:"")+(A?`<span class="pagecraft-qapills-note">${s(A)}</span>`:"")+(I?`<a class="pagecraft-qapills-link" href="${s(I)}">${s(O)} \u2192</a>`:"")+"</div>"}).join("");return`<div ${L()} ${d("pagecraft-qapills")} data-qapills${h}><div class="pagecraft-qapills-bar" role="tablist" aria-label="Questions">${k}</div><div class="pagecraft-qapills-stage">${y}</div></div>`}case"arches":{let h=(Array.isArray(l.items)?l.items:[]).filter(Boolean).slice(0,5).map((p,b)=>{let k=s(String(p.src||K)),y=s(String(p.alt||`Arch ${b+1}`)),S=p.w&&p.h?` width="${parseInt(String(p.w),10)}" height="${parseInt(String(p.h),10)}"`:"";return`<li class="pagecraft-arches-item"><img class="pagecraft-arches-img" src="${k}" alt="${y}"${S} decoding="async"></li>`}).join("");return`<div ${L()} ${d("pagecraft-arches")} data-arches><ul class="pagecraft-arches-list">${h}</ul></div>`}case"reel":{let u=(Array.isArray(l.reels)?l.reels:[]).filter(Boolean),h=ae(l.ratio)||"9 / 16",p=l.arrows!==0&&u.length>1,b=l.dots!==0&&u.length>1,k=u.length,y=T=>{if(!k)return"far";let I=(T%k+k)%k;return I>k/2&&(I-=k),I===0||I===1||I===-1||I===2||I===-2?String(I):"far"},S=u.map((T,I)=>{let O=String(T.src||""),q=s(O||K),z=T.poster?s(String(T.poster)):"",_=String(T.title||"").trim(),X=s(String(T.alt||_||`Reel ${I+1}`)),G=T.w&&T.h?` width="${parseInt(String(T.w),10)}" height="${parseInt(String(T.h),10)}"`:"",me=/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(O)?`<video class="pagecraft-reel-media" src="${q}"${z?` poster="${z}"`:""} muted loop playsinline preload="metadata" aria-label="${X}"></video>`:`<img class="pagecraft-reel-media" src="${q}" alt="${X}"${G} decoding="async" draggable="false">`;return`<div class="pagecraft-reel-card" role="group" aria-roledescription="slide" aria-label="${I+1} of ${k}" data-reel-idx="${I}" data-slot="${y(I)}">`+me+(_?`<span class="pagecraft-reel-scrim" aria-hidden="true"></span><span class="pagecraft-reel-caption">${s(_)}</span>`:"")+"</div>"}).join(""),$=p?'<button type="button" class="pagecraft-reel-nav" data-reel-prev aria-label="Previous reel"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5L5.5 8 10 12.5"/></svg></button><button type="button" class="pagecraft-reel-nav" data-reel-next aria-label="Next reel"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5"/></svg></button>':"",A=b?'<nav class="pagecraft-reel-dots" aria-label="Choose a reel">'+u.map((T,I)=>`<button type="button" class="pagecraft-reel-dot" data-reel-dot="${I}" aria-label="Go to reel ${I+1}" aria-current="${I===0?"true":"false"}"><span></span></button>`).join("")+"</nav>":"";return`<section ${L()} ${d("pagecraft-reel")} data-reel${t.edit?" data-reel-edit":""} role="region" aria-roledescription="carousel" aria-label="Reel slider" style="--rl-ratio:${s(h)}"><div class="pagecraft-reel-stage">${$}<div class="pagecraft-reel-track">${S}</div></div>`+A+'<p class="pagecraft-reel-status" role="status" aria-live="polite"></p></section>'}case"grow":{let u=(Array.isArray(l.cards)?l.cards:[]).filter(Boolean),h=ae(l.ratio)||"3 / 4",p=parseFloat(String(l.speed??"36")),b=Number.isFinite(p)&&p>=0?String(Math.round(p)):"36",k=(v,g,$)=>{let A=s(String(v.src||K)),T=String(v.title||"").trim(),I=String(v.subtitle||"").trim(),O=s(String(v.alt||T||`Card ${g+1}`)),q=v.w&&v.h?` width="${parseInt(String(v.w),10)}" height="${parseInt(String(v.h),10)}"`:"",z=T||I?'<span class="pagecraft-grow-scrim" aria-hidden="true"></span><span class="pagecraft-grow-cap">'+(T?`<span class="pagecraft-grow-title">${s(T)}</span>`:"")+(I?`<span class="pagecraft-grow-sub">${s(I)}</span>`:"")+"</span>":"";return`<button type="button" class="pagecraft-grow-card"${$?' aria-hidden="true" tabindex="-1"':` aria-label="${O}"`}><img class="pagecraft-grow-img" src="${A}" alt="${$?"":O}"${q} decoding="async" draggable="false">`+z+"</button>"},y=u.map((v,g)=>k(v,g,!1)).join(""),S=!t.edit&&u.length>1?u.map((v,g)=>k(v,g,!0)).join(""):"";return`<div ${L()} ${d("pagecraft-grow")} data-grow data-grow-count="${u.length}" data-grow-speed="${s(b)}"${t.edit?" data-grow-edit":""} style="--gc-ratio:${s(h)}"><div class="pagecraft-grow-bg" aria-hidden="true"><img class="pagecraft-grow-bg-img" src="${s(String(u[0]?.src||K))}" alt=""></div><div class="pagecraft-grow-track">${y}${S}</div></div>`}case"deck":{let u=(Array.isArray(l.deckCards)?l.deckCards:[]).filter(Boolean),h=ae(l.ratio)||"4 / 5",p=l.arrows!==0&&u.length>1,b=u.map((v,g)=>{let $=s(String(v.src||K)),A=String(v.title||"").trim(),T=String(v.tag||"").trim(),I=s(String(v.alt||A||`Card ${g+1}`)),O=v.w&&v.h?` width="${parseInt(String(v.w),10)}" height="${parseInt(String(v.h),10)}"`:"",q=g<=3?String(g):"back",z=A||T?'<span class="pagecraft-deck-scrim" aria-hidden="true"></span><figcaption class="pagecraft-deck-cap">'+(T?`<span class="pagecraft-deck-tag">${s(T)}</span>`:"")+(A?`<span class="pagecraft-deck-title">${s(A)}</span>`:"")+"</figcaption>":"";return`<figure class="pagecraft-deck-card" data-depth="${q}" aria-hidden="${g===0?"false":"true"}"><img class="pagecraft-deck-img" src="${$}" alt="${I}"${O} decoding="async" draggable="false">`+z+"</figure>"}).join(""),S=p?`<div class="pagecraft-deck-controls"><button type="button" class="pagecraft-deck-btn" data-deck-prev aria-label="Previous card"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5L5.5 8 10 12.5"/></svg></button><span class="pagecraft-deck-count" data-deck-count aria-live="polite">1 / ${u.length}</span><button type="button" class="pagecraft-deck-btn" data-deck-next aria-label="Next card"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5"/></svg></button></div>`:"";return`<div ${L()} ${d("pagecraft-deck")} data-deck${t.edit?" data-deck-edit":""} tabindex="0" role="region" aria-roledescription="carousel" aria-label="Card deck" style="--dk-ratio:${s(h)}"><div class="pagecraft-deck-stage">${b}</div>`+S+"</div>"}case"metrics":{let u=(Array.isArray(l.stats)?l.stats:[]).filter(Boolean),h="<span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>",p=u.map(b=>{let k=String(b.prefix||""),y=String(b.value||"0"),S=String(b.suffix||""),v=String(b.label||""),g=String(b.detail||""),$=`${k}${y}${S}`,A=0,T=Array.from(y).map(I=>{if(I>="0"&&I<="9"){let O=(.82+A*.09).toFixed(2);return A++,`<span class="pagecraft-metric-drum"><span class="pagecraft-metric-reel" style="--mt-d:${I};--mt-dur:${O}s">${h}</span></span>`}return`<span>${s(I)}</span>`}).join("");return`<div class="pagecraft-metric-card"><div class="pagecraft-metric-val" aria-label="${s($)}">`+(k?`<span class="pagecraft-metric-affix" aria-hidden="true">${s(k)}</span>`:"")+`<span aria-hidden="true" style="display:inline-flex">${T}</span>`+(S?`<span class="pagecraft-metric-affix" aria-hidden="true">${s(S)}</span>`:"")+"</div>"+(v?`<div class="pagecraft-metric-label">${s(v)}</div>`:"")+(g?`<p class="pagecraft-metric-detail">${s(g)}</p>`:"")+"</div>"}).join("");return`<div ${L()} ${d("pagecraft-metrics")} data-metrics${t.edit?" data-metrics-edit":""}>${p}</div>`}case"spotlight":{let h=(Array.isArray(l.tiles)?l.tiles:[]).filter(Boolean).map(p=>{let b=String(p.tag||"").trim(),k=String(p.title||"").trim(),y=String(p.detail||"").trim(),S=xe(String(p.href||"")),v=String(p.linkLabel||"Learn more").trim();return'<article class="pagecraft-spot-card"><span class="pagecraft-spot-grid" aria-hidden="true"></span>'+(b?`<span class="pagecraft-spot-tag">${s(b)}</span>`:"")+(k?`<h3 class="pagecraft-spot-title">${s(k)}</h3>`:"")+(y?`<p class="pagecraft-spot-detail">${s(y)}</p>`:"")+(S?`<a class="pagecraft-spot-link" href="${s(S)}">${s(v)} <span aria-hidden="true">&rarr;</span></a>`:"")+"</article>"}).join("");return`<div ${L()} ${d("pagecraft-spotlight")} data-spotlight${t.edit?" data-spotlight-edit":""}>${h}</div>`}case"terminal":{let u=String(l.title||"terminal \u2014 zsh").trim(),h=(Array.isArray(l.commands)?l.commands:[]).filter(Boolean),p=H(),b=h.length>1?'<div class="pagecraft-term-tabs" role="tablist" aria-label="Terminal commands">'+h.map((y,S)=>`<button type="button" class="pagecraft-term-tab" id="${p}-tm-t-${S}" role="tab" aria-controls="${p}-tm-p-${S}" aria-selected="${S===0?"true":"false"}" tabindex="${S===0?"0":"-1"}">${s(String(y.label||`Step ${S+1}`))}</button>`).join("")+"</div>":"",k=h.map((y,S)=>{let v=String(y.cmd||"").trim(),g=String(y.output||"").split(/\r?\n/).map(T=>T.trim()).filter(Boolean),$=String(y.note||"").trim(),A=g.length?`<ul class="pagecraft-term-out">${g.map(T=>`<li${/^[✓✔]/.test(T)?' class="pagecraft-term-line-ok"':""}>${s(T)}</li>`).join("")}</ul>`:"";return`<div class="pagecraft-term-panel" id="${p}-tm-p-${S}" role="tabpanel" aria-labelledby="${p}-tm-t-${S}" data-cmd="${s(v)}"${S===0?"":" hidden"}><div class="pagecraft-term-body"><p class="pagecraft-term-cmd"><span class="pagecraft-term-prompt" aria-hidden="true">$</span><span class="pagecraft-term-text">${s(v)}</span><span class="pagecraft-term-caret" aria-hidden="true"></span></p>`+A+"</div>"+($?`<div class="pagecraft-term-note">${s($)}</div>`:"")+"</div>"}).join("");return`<div ${L()} ${d("pagecraft-terminal")} data-terminal${t.edit?" data-terminal-edit":""}><div class="pagecraft-term-bar"><span class="pagecraft-term-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="pagecraft-term-title">${s(u)}</span><button type="button" class="pagecraft-term-copy" aria-label="Copy command">Copy</button></div>`+b+k+"</div>"}case"tilt":{let u=ae(l.ratio),h=u?` style="--tl-ratio:${s(u)}"`:"",b=(Array.isArray(l.tiltCards)?l.tiltCards:[]).filter(Boolean).map((k,y)=>{let S=s(String(k.src||K)),v=String(k.title||"").trim(),g=String(k.tag||"").trim(),$=String(k.detail||"").trim(),A=s(String(k.alt||v||`Card ${y+1}`)),T=k.w&&k.h?` width="${parseInt(String(k.w),10)}" height="${parseInt(String(k.h),10)}"`:"";return`<div class="pagecraft-tilt-wrap"><article class="pagecraft-tilt-card"><img class="pagecraft-tilt-img" src="${S}" alt="${A}"${T} decoding="async"><span class="pagecraft-tilt-scrim" aria-hidden="true"></span><span class="pagecraft-tilt-glare" aria-hidden="true"></span><div class="pagecraft-tilt-body">`+(g?`<span class="pagecraft-tilt-tag">${s(g)}</span>`:"")+(v?`<h3 class="pagecraft-tilt-title">${s(v)}</h3>`:"")+($?`<p class="pagecraft-tilt-detail">${s($)}</p>`:"")+"</div></article></div>"}).join("");return`<div ${L()} ${d("pagecraft-tilt")}${h} data-tilt${t.edit?" data-tilt-edit":""}>${b}</div>`}case"flip":{let u=l.trigger==="hover"?"hover":"click",h=ae(l.ratio),p=h?` style="--fl-ratio:${s(h)}"`:"",k=(Array.isArray(l.flipCards)?l.flipCards:[]).filter(Boolean).map((y,S)=>{let v=String(y.src||"").trim(),g=String(y.tag||"").trim(),$=String(y.title||"").trim(),A=String(y.frontNote||(u==="hover"?"Hover to flip":"Tap to flip")).trim(),T=String(y.backTitle||$).trim(),I=String(y.detail||"").trim(),O=xe(String(y.href||"")),q=String(y.linkLabel||"Learn more").trim(),z=s(String(y.alt||$||`Card ${S+1}`)),_=y.w&&y.h?` width="${parseInt(String(y.w),10)}" height="${parseInt(String(y.h),10)}"`:"";return'<div class="pagecraft-flip-card" role="button" tabindex="0" aria-pressed="false" data-flipped="0"><div class="pagecraft-flip-inner"><div class="pagecraft-flip-face pagecraft-flip-front">'+(v?`<img class="pagecraft-flip-img" src="${s(v)}" alt="${z}"${_} decoding="async"><span class="pagecraft-flip-scrim" aria-hidden="true"></span>`:"")+'<div class="pagecraft-flip-front-body">'+(g?`<span class="pagecraft-flip-tag">${s(g)}</span>`:"")+($?`<h3 class="pagecraft-flip-title">${s($)}</h3>`:"")+(A?`<span class="pagecraft-flip-hint">${s(A)} <span aria-hidden="true">&#8635;</span></span>`:"")+'</div></div><div class="pagecraft-flip-face pagecraft-flip-back"><div class="pagecraft-flip-back-top">'+(g?`<span class="pagecraft-flip-back-tag">${s(g)}</span>`:"")+(T?`<h3 class="pagecraft-flip-back-title">${s(T)}</h3>`:"")+(I?`<p class="pagecraft-flip-detail">${s(I)}</p>`:"")+'</div><div class="pagecraft-flip-back-foot">'+(O?`<a class="pagecraft-flip-link" href="${s(O)}">${s(q)} <span aria-hidden="true">&rarr;</span></a>`:"<span></span>")+'<span class="pagecraft-flip-return" aria-hidden="true">&#8634; Flip back</span></div></div></div></div>'}).join("");return`<div ${L()} ${d("pagecraft-flip")}${p} data-flip data-flip-trigger="${u}"${t.edit?" data-flip-edit":""}>${k}</div>`}case"chapters":{let u=ae(l.frameRatio),h=u?` style="--ch-ratio:${s(u)}"`:"",p=parseFloat(String(l.autoSeconds??"6")),b=Number.isFinite(p)&&p>0?String(p):"0",k=(Array.isArray(l.chapters)?l.chapters:[]).filter(Boolean),y=H(),S=k.map((g,$)=>{let A=s(String(g.src||K)),T=s(String(g.alt||g.chapterTitle||`Chapter ${$+1}`)),I=g.w&&g.h?` width="${parseInt(String(g.w),10)}" height="${parseInt(String(g.h),10)}"`:"",O=String(g.overlayText||"");return`<figure class="pagecraft-chapters-slide" id="${y}-ch-p-${$}" role="tabpanel" aria-labelledby="${y}-ch-b-${$}" data-ch-slide="${$}" data-active="${$===0?"1":"0"}" aria-hidden="${$===0?"false":"true"}"><img class="pagecraft-chapters-img" src="${A}" alt="${T}"${I} decoding="async">`+(O?`<figcaption class="pagecraft-chapters-scrim"><p class="pagecraft-chapters-overlay">${s(O)}</p></figcaption>`:"")+"</figure>"}).join(""),v=k.map((g,$)=>{let A=String(g.chapterTitle||`Chapter ${$+1}`),T=String(g.chapterSub||"");return`<button type="button" class="pagecraft-chapters-btn" id="${y}-ch-b-${$}" role="tab" aria-controls="${y}-ch-p-${$}" aria-selected="${$===0?"true":"false"}" tabindex="${$===0?"0":"-1"}" data-ch-btn="${$}"><span class="pagecraft-chapters-bar" aria-hidden="true"><span class="pagecraft-chapters-fill"></span></span><span class="pagecraft-chapters-title">${s(A)}</span>`+(T?`<span class="pagecraft-chapters-sub">${s(T)}</span>`:"")+"</button>"}).join("");return`<div ${L()} ${d("pagecraft-chapters")} data-chapters data-auto="${s(b)}"${h}><div class="pagecraft-chapters-stage">${S}${b!=="0"&&k.length>1&&!t.edit?'<button type="button" class="pagecraft-chapters-pause" data-ch-pause aria-pressed="false" hidden>Pause</button>':""}</div><div class="pagecraft-chapters-nav" role="tablist" aria-label="Chapters">${v}</div></div>`}case"spacer":return`<div ${L()} ${d("pagecraft-spacer")} aria-hidden="true"></div>`;case"divider":return`<hr ${L()} ${d("pagecraft-divider")}>`}return""}var dr=(e,t)=>!t.edit&&!t.publicIds?Dr([e],t)[0]:e.map(r=>Ye(r,t)).join("");function Dr(e,t){let r={reserving:!0,reserved:new Set,used:new Set},a={...t,edit:!1,publicIds:r};for(let i of e)dr(i,a);return r.reserving=!1,e.map(i=>dr(i,a))}var We=33.3333,Rn=66.6666,El={1:[[100]],2:[[50,50],[Rn,We],[We,Rn],[75,25],[25,75]],3:[[We,We,We],[50,25,25],[25,50,25],[25,25,50]],4:[[25,25,25,25],[40,20,20,20],[20,20,20,40]],5:[[20,20,20,20,20]],6:[[16.6666,16.6666,16.6666,16.6666,16.6666,16.6666]]},jc=Object.keys(El).map(Number);var Al={columns:{type:"row",label:"Columns",icon:"columns"},box:{type:"box",label:"Box",icon:"box",props:{layout:"block"}},flex:{type:"box",label:"Flex",icon:"flex",props:{layout:"flex"}},grid:{type:"box",label:"Grid",icon:"grid",props:{layout:"grid"}},linkbox:{type:"box",label:"Link block",icon:"link",props:{layout:"block",link:"#"}}},Hc=Object.fromEntries(Object.entries(Al).map(([e,t])=>[e,t.type]));var Cl=`<script>
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
`,Pl=`<script>
(function(){Array.prototype.forEach.call(document.querySelectorAll('[data-tabs]'),function(w){
var strip=[].slice.call(w.children).find(function(e){return e.getAttribute('role')==='tablist';});
var t=strip?[].slice.call(strip.children).filter(function(e){return e.getAttribute('role')==='tab';}):[],p=[].slice.call(w.children).filter(function(e){return e.getAttribute('role')==='tabpanel';});
if(!t.length)return;w.setAttribute('data-tabs-ready','');
var ind=null,cur=0;
if(strip){ind=document.createElement('span');ind.className='pagecraft-tab-indicator';ind.setAttribute('aria-hidden','true');ind.setAttribute('data-tab-ind-init','1');strip.appendChild(ind);}
function moveInd(instant){
if(!ind||!strip||!t[cur])return;var b=t[cur],bw=b.offsetWidth;if(!bw)return;
if(instant)ind.setAttribute('data-tab-ind-init','1');else ind.removeAttribute('data-tab-ind-init');
strip.setAttribute('data-tabs-spring','1');
ind.style.width=bw+'px';ind.style.transform='translate3d('+b.offsetLeft+'px,'+(b.offsetTop+b.offsetHeight-2)+'px,0)';
ind.setAttribute('data-tab-ind-ready','1');
if(instant&&typeof requestAnimationFrame==='function'){requestAnimationFrame(function(){if(ind)ind.removeAttribute('data-tab-ind-init');});}
}
function show(i,instant){cur=i;t.forEach(function(b,k){var on=k===i;b.classList.toggle('on',on);
b.setAttribute('aria-selected',on?'true':'false');b.tabIndex=on?0:-1;
if(p[k]){if(on)p[k].removeAttribute('data-tab-idle');else p[k].setAttribute('data-tab-idle','');}});moveInd(!!instant);}
show(Math.max(0,t.findIndex(function(b){return b.getAttribute('aria-selected')==='true';})),true);
addEventListener('resize',function(){moveInd(true);});
t.forEach(function(b,k){b.addEventListener('click',function(){show(k,false);});
b.addEventListener('keydown',function(e){
var d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:e.key==='Home'?-999:e.key==='End'?999:0;
if(!d)return;e.preventDefault();
var i=d===-999?0:d===999?t.length-1:(k+d+t.length)%t.length;show(i,false);t[i].focus();});});
});})();
<\/script>
`,Tl=`<script>
(function(){Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'),function(w){
var b=w.querySelector('[data-nav-t]'),list=w.querySelector('[data-nav-l]');if(!b||!list)return;
// A flyout opens to the right; near the right edge of the window it opens the other way instead,
// outermost first, so a deeper level is measured from where its parent actually landed.
// Once a flyout has turned back, the levels under it keep going that way while there is room:
// opening right again would land on top of the level the pointer came from.
function edge(e){
 var chain=[],back=false,li=e.target&&e.target.closest?e.target.closest('li'):null;
 while(li&&list.contains(li)){chain.unshift(li);li=li.parentElement&&li.parentElement.closest('li');}
 chain.forEach(function(item){
  var sub=null;for(var i=0;i<item.children.length;i++)if(item.children[i].classList.contains('sub-menu'))sub=item.children[i];
  if(!sub)return;sub.classList.remove('is-flipped');
  var r=sub.getBoundingClientRect(),nested=!!(item.parentElement&&item.parentElement.classList.contains('sub-menu'));
  if(r.width&&r.right>document.documentElement.clientWidth)sub.classList.add('is-flipped');
  else if(r.width&&back&&nested){sub.classList.add('is-flipped');if(sub.getBoundingClientRect().left<0)sub.classList.remove('is-flipped');}
  back=nested&&sub.classList.contains('is-flipped');
 });
}
list.addEventListener('mouseover',edge);list.addEventListener('focusin',edge);
var content=w.querySelector('[data-nav-content]')||list;
var dialog=null,overflow='',anchor=document.createComment('mobile menu');content.before(anchor);
function position(){
 if(!dialog)return;
 var host=w.closest('header,[data-kind="header"]');
 if(dialog.dataset.layout==='fullscreen'){
  host=host||w;
  if(host===w)while(host.parentElement&&host.parentElement!==document.body&&host.parentElement.id!=='s-root'&&!host.parentElement.matches('.s-rbody,main'))host=host.parentElement;
  dialog.style.setProperty('--nav-top',Math.max(0,Math.min(window.innerHeight-80,host.getBoundingClientRect().bottom))+'px');
  return;
 }
 var rect=(host||b).getBoundingClientRect(),height=window.innerHeight;
 var above=Math.max(0,Math.min(height,rect.top)),below=height-Math.max(0,Math.min(height,rect.bottom));
 var needed=dialog.scrollHeight,up=needed>below&&above>below,available=up?above:below;
 dialog.style.setProperty('--nav-top',(up?above-Math.min(needed,available):height-below)+'px');
 dialog.style.setProperty('--nav-height',available+'px');
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
  head.append(label,close);content.hidden=false;if(fullscreen)dialog.append(head);dialog.append(content);w.append(dialog);
  overflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';
  w.classList.add('is-open');b.setAttribute('aria-expanded','true');
  close.addEventListener('click',function(){set(false,true);});
  dialog.addEventListener('cancel',function(e){e.preventDefault();set(false,true);});
  dialog.addEventListener('click',function(e){if(!dialog||e.target!==dialog)return;var r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)set(false,true);});
  var opened=dialog;
  dialog.addEventListener('close',function(){if(dialog===opened)set(false,true);});
  if(fullscreen){position();dialog.showModal();close.focus();}
  else{
   // Closed popovers have no layout; measure after opening without flashing at the wrong edge.
   dialog.style.visibility='hidden';
   if(dialog.showPopover)dialog.showPopover();
   else{dialog.removeAttribute('popover');dialog.style.zIndex='2147483647';}
   position();dialog.scrollTop=0;dialog.style.removeProperty('visibility');
  }
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
window.addEventListener('scroll',function(){if(dialog&&dialog.dataset.layout==='dropdown')position();},{passive:true});
w.classList.add('pagecraft-nav-enhanced');
});})();
<\/script>
`,Ll="(function(){var b=document.body,h=-1;function s(){var n=Math.ceil(b.getBoundingClientRect().height);if(n!==h){h=n;parent.postMessage({pagecraftEmbedHeight:n},'*');}}if(window.ResizeObserver)new ResizeObserver(s).observe(b);addEventListener('load',s);s();})();";var Ml=`<script>
(function(){Array.prototype.forEach.call(document.querySelectorAll('[data-facade] .pagecraft-video-play'),function(b){
b.addEventListener('click',function(){
var k=b.matches(':focus-visible'),f=document.createElement('iframe');
f.src=b.getAttribute('data-embed')+(b.getAttribute('data-embed').indexOf('?')<0?'?':'&')+'autoplay=1';
f.title='Video';f.allow='accelerometer;autoplay;clipboard-write;encrypted-media;picture-in-picture';
f.setAttribute('allowfullscreen','');if(k)f.setAttribute('data-pagecraft-keyboard-focus','');
function c(){f.removeAttribute('data-pagecraft-keyboard-focus')}f.addEventListener('blur',c);f.addEventListener('pointerdown',c);
b.parentNode.replaceChild(f,b);if(k)f.focus();
});});})();
<\/script>
`,Il=`<script>
(function(){
var bs=document.querySelectorAll('[data-video-lightbox] .pagecraft-video-play');if(!bs.length)return;
var dlg=null,stage=null,frame=null,closeB=null,opener=null;
function stop(){
if(!frame)return;
var v=frame.querySelector('video');
if(v){if(v.pause)v.pause();v.removeAttribute('src');if(v.load)v.load();}
frame.innerHTML='';
}
function ensureDialog(){
if(dlg)return dlg;
dlg=document.createElement('dialog');dlg.className='pagecraft-lightbox pagecraft-video-lightbox';dlg.setAttribute('aria-label','Video player');
stage=document.createElement('div');stage.className='pagecraft-video-lightbox-stage';
frame=document.createElement('div');frame.className='pagecraft-video-lightbox-frame';
stage.appendChild(frame);
closeB=document.createElement('button');closeB.className='pagecraft-lightbox-btn pagecraft-lightbox-close';closeB.type='button';closeB.setAttribute('aria-label','Close video');closeB.textContent='\xD7';
dlg.appendChild(stage);dlg.appendChild(closeB);
document.body.appendChild(dlg);
closeB.addEventListener('click',function(){dlg.close();});
dlg.addEventListener('click',function(e){if(e.target===dlg||e.target===stage)dlg.close();});
dlg.addEventListener('close',function(){stop();if(opener&&opener.focus)opener.focus();opener=null;});
return dlg;
}
function makeNode(b,k){
var vsrc=b.getAttribute('data-video-src');
if(vsrc){
var v=document.createElement('video');v.src=vsrc;v.autoplay=true;v.playsInline=true;
if(b.hasAttribute('data-video-controls'))v.controls=true;
if(b.hasAttribute('data-video-loop'))v.loop=true;
if(b.hasAttribute('data-video-muted'))v.muted=true;
return v;
}
var emb=b.getAttribute('data-embed')||'',f=document.createElement('iframe');
f.src=emb+(emb.indexOf('?')<0?'?':'&')+'autoplay=1';
f.title='Video';f.allow='accelerometer;autoplay;clipboard-write;encrypted-media;fullscreen;picture-in-picture';
f.setAttribute('allowfullscreen','');if(k)f.setAttribute('data-pagecraft-keyboard-focus','');
function c(){f.removeAttribute('data-pagecraft-keyboard-focus')}f.addEventListener('blur',c);f.addEventListener('pointerdown',c);
return f;
}
Array.prototype.forEach.call(bs,function(b){
b.addEventListener('click',function(){
var k=b.matches(':focus-visible'),w=b.closest&&b.closest('[data-video-lightbox]');
if(w&&typeof HTMLDialogElement==='function'){
ensureDialog();stop();opener=b;
frame.style.setProperty('--pc-vr',w.getAttribute('data-ratio')||'16 / 9');
frame.appendChild(makeNode(b,k));
dlg.showModal();closeB.focus();
return;
}
var f=makeNode(b,k);
b.parentNode.replaceChild(f,b);if(k)f.focus();
});});})();
<\/script>
`;function Dl(){return`<script>
(function(){
var gs=document.querySelectorAll('[data-lightbox]');if(!gs.length)return;
if(typeof HTMLDialogElement!=='function')return;
var ownScript=document.currentScript,styleNonce=ownScript&&(ownScript.nonce||ownScript.getAttribute('nonce'))||'';
var failureCss=${JSON.stringify(Ni)};
var dlg=null,imgEl,capEl,errorEl,errorTitle,errorDetail,retryB,prevB,nextB,closeB,list=[],at=0,request=0;
function ensureFailureCss(){
var style=document.querySelector('style[data-pagecraft-lightbox-failure]');if(style)return;
style=document.createElement('style');style.setAttribute('data-pagecraft-lightbox-failure','');
if(styleNonce)style.setAttribute('nonce',styleNonce);style.textContent=failureCss;
(document.head||document.documentElement).appendChild(style);
}
function build(){
ensureFailureCss();
dlg=document.createElement('dialog');dlg.className='pagecraft-lightbox';dlg.setAttribute('aria-label','Image gallery');
dlg.innerHTML='<figure class="pagecraft-lightbox-fig"><img class="pagecraft-lightbox-img" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" alt="" hidden><div class="pagecraft-lightbox-error" hidden><div role="status" aria-live="polite"><strong></strong><span></span></div><button class="pagecraft-lightbox-retry" type="button" hidden>Try again</button></div><p class="pagecraft-lightbox-cap"></p></figure>'
+'<button class="pagecraft-lightbox-btn pagecraft-lightbox-prev" type="button" aria-label="Previous image">\u2039</button>'
+'<button class="pagecraft-lightbox-btn pagecraft-lightbox-next" type="button" aria-label="Next image">\u203A</button>'
+'<button class="pagecraft-lightbox-btn pagecraft-lightbox-close" type="button" aria-label="Close">\xD7</button>';
document.body.appendChild(dlg);
imgEl=dlg.querySelector('.pagecraft-lightbox-img');capEl=dlg.querySelector('.pagecraft-lightbox-cap');
errorEl=dlg.querySelector('.pagecraft-lightbox-error');errorTitle=errorEl.querySelector('strong');
errorDetail=errorEl.querySelector('span');retryB=dlg.querySelector('.pagecraft-lightbox-retry');
prevB=dlg.querySelector('.pagecraft-lightbox-prev');nextB=dlg.querySelector('.pagecraft-lightbox-next');
closeB=dlg.querySelector('.pagecraft-lightbox-close');
prevB.addEventListener('click',function(){go(-1);});
nextB.addEventListener('click',function(){go(1);});
closeB.addEventListener('click',function(){dlg.close();});
retryB.addEventListener('click',function(){if(retryB.getAttribute('aria-disabled')!=='true')load(list[at],true);});
dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close();});
dlg.addEventListener('keydown',function(e){
if(e.key==='ArrowLeft'){e.preventDefault();go(-1);}
if(e.key==='ArrowRight'){e.preventDefault();go(1);}
if(e.key==='Tab'){
var bs=dlg.querySelectorAll('.pagecraft-lightbox-btn:not([hidden]):not(:disabled),.pagecraft-lightbox-retry:not([hidden]):not(:disabled)'),first=bs[0],last=bs[bs.length-1];
if(first&&((e.shiftKey&&document.activeElement===first)||(!e.shiftKey&&document.activeElement===last))){e.preventDefault();(e.shiftKey?last:first).focus();}
}
});
}
function hideError(focus){
if(focus&&errorEl.contains(document.activeElement))closeB.focus();
errorEl.hidden=true;errorTitle.textContent='';errorDetail.textContent='';retryB.hidden=true;
retryB.textContent='Try again';retryB.removeAttribute('aria-busy');retryB.removeAttribute('aria-disabled');
}
function load(it,retry){
var id=++request,fresh=document.createElement('img');
fresh.className='pagecraft-lightbox-img';fresh.alt=it.alt;fresh.hidden=true;
imgEl.parentNode.replaceChild(fresh,imgEl);imgEl=fresh;
if(retry){errorEl.hidden=false;errorTitle.textContent='Loading image';errorDetail.textContent=it.alt||'';retryB.hidden=false;
retryB.textContent='Trying again\u2026';retryB.setAttribute('aria-busy','true');retryB.setAttribute('aria-disabled','true');}
else hideError(true);
fresh.addEventListener('load',function(){if(id!==request)return;fresh.hidden=false;hideError(true);if(typeof requestAnimationFrame==='function'){requestAnimationFrame(function(){if(id===request)fresh.setAttribute('data-lb-ready','1');});}else{fresh.setAttribute('data-lb-ready','1');}});
fresh.addEventListener('error',function(){if(id!==request)return;fresh.hidden=true;
errorTitle.textContent='Image unavailable';errorDetail.textContent=it.alt||'This image could not be loaded.';
retryB.hidden=false;retryB.textContent='Try again';retryB.removeAttribute('aria-busy');retryB.removeAttribute('aria-disabled');errorEl.hidden=false;});
fresh.src=it.href;
}
function show(){var it=list[at];
capEl.textContent=it.cap;capEl.hidden=!it.cap;
load(it,false);
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
`}var Rl=Dl(),pr=e=>e.replace(/\}/g,`}
`).replace(/\n{2,}/g,`
`).replace(/^\s+|\s+$/g,""),On=e=>e.replace(/<(?=\/style[\t\n\f\r />])/gi,"\\3C ");function Ol(e,t={}){let r=M.meta,a=String(r.baseUrl||"").replace(/\/+$/,"");if(!a)return null;let i=P=>P?/^https?:/i.test(P)?P:a+"/"+String(P).replace(/^\/+/,""):"",n=`${a}/${Tr(e.slug,t.pageNo||1)}`,o=`${a}/#org`,c=`${a}/#site`,f=i(e.ogImage||r.ogImage||""),m=[{"@type":"Organization","@id":o,name:r.name,url:a+"/"},{"@type":"WebSite","@id":c,name:r.name,url:a+"/",publisher:{"@id":o}}];if(_o([de(e,"header"),e.tree,de(e,"footer")])){let P=Wn(e,t);P.length>1&&m.push({"@type":"BreadcrumbList","@id":n+"#crumbs",itemListElement:P.map((w,D)=>{let N={"@type":"ListItem",position:D+1,name:w.label};return w.href&&(N.item=a+"/"+String(w.href).replace(/^\/+/,"")),N})})}let d=!!(t.item&&t.col),E=d?{"@type":"Article","@id":n+"#article",headline:e.title||e.name,url:n}:{"@type":"WebPage","@id":n,name:e.title||e.name,url:n};return e.desc&&(E.description=e.desc),f&&(E.image=f),E.isPartOf={"@id":c},d&&(E.publisher={"@id":o}),m.push(E),{"@context":"https://schema.org","@graph":m}}function Nl(e,t={}){let r=Ol(e,t);return r?`<script type="application/ld+json">
${JSON.stringify(r,null,2).replace(/</g,"\\u003c")}
<\/script>
`:""}var Tt="<!--",Lt="-->",Fl=Tt+"PAGECRAFT_SHARED_HEADER_START"+Lt,Bl=Tt+"PAGECRAFT_SHARED_HEADER_END"+Lt,ql=Tt+"PAGECRAFT_SHARED_FOOTER_START"+Lt,zl=Tt+"PAGECRAFT_SHARED_FOOTER_END"+Lt;function qi(e,t={}){let r=M.meta,a={edit:!1,col:t.col||null,item:t.item||null,rel:t.rel||"",variants:!!t.variants,pageNo:t.pageNo||1,pages:t.pages||1,pg:e},i=Ri(t.schemaVersion,()=>cl([de(e,"header"),e.tree,de(e,"footer")],!1)),n=tr([de(e,"header"),e.tree,de(e,"footer")]),o=[...de(e,"header"),...e.tree,...de(e,"footer")],c=new Set;ie(o,re=>c.add(Ii(re)));let f="pagecraft-main";for(;c.has(f);)f+="-content";let[m,d,E]=Dr([de(e,"header"),e.tree,de(e,"footer")],a),P=Ve(m),w=Ve(d),D=Ve(E),N=`<main id="${f}" class="pagecraft-main">${w}</main>`,R=Fl+P+Bl+N+ql+D+zl,F=/data-pagecraft-select/.test(R),V=/data-pagecraft-date/.test(R),U=cr(lr([de(e,"header"),e.tree,de(e,"footer")])),W=e.title||`${e.name} \u2014 ${r.name}`,H=String(r.baseUrl||"").replace(/\/+$/,""),Ee=re=>re?/^https?:/i.test(re)?re:H?H+"/"+String(re).replace(/^\/+/,""):re:"",be=H&&!xn(e)?`${H}/${Tr(e.slug,a.pageNo)}`:"",L=Ee(e.ogImage||r.ogImage||"");return`<!doctype html>
<html lang="${s(r.lang||"en")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${s(W)}</title>
${e.desc?`<meta name="description" content="${s(e.desc)}">
`:""}${be?`<link rel="canonical" href="${s(be)}">
`:""}${r.favicon?`<link rel="icon" href="${s(ue(r.favicon,a))}">
`:""}${t.fontCss?`<style>
${On(t.fontCss)}
</style>
`:Oo()}<meta property="og:type" content="${t.item&&t.col?"article":"website"}">
<meta property="og:title" content="${s(W)}">
${e.desc?`<meta property="og:description" content="${s(e.desc)}">
`:""}${be?`<meta property="og:url" content="${s(be)}">
`:""}${L?`<meta property="og:image" content="${s(L)}">
<meta name="twitter:card" content="summary_large_image">
`:""}${Nl(e,{col:a.col,item:a.item,pageNo:a.pageNo})}<style>
${On(pr(i)+(F?`
${Vt}`:"")+(V?`
${Wt}`:"")+U+(n?`
${pt}
${rr}`:""))}
</style>
${xn(e)?`<meta name="robots" content="noindex">
`:""}${Ve(r.headHtml||"")}${Ve(e.headHtml||"")}
</head>
<body>
<a class="pagecraft-skip" href="#${f}">Skip to content</a>
${R}
${/data-slider/.test(R)?Wo:""}${/data-copy/.test(R)?Uo:""}${/data-tabs/.test(R)?(t.schemaVersion??fe)<15?Cl:Pl:""}${(t.schemaVersion??fe)>=17&&/pagecraft-accordion/.test(R)?Ur:""}${/data-nav/.test(R)?Tl:""}${/data-facade/.test(R)?Ml:""}${/data-video-lightbox/.test(R)?Il:""}${/data-lightbox/.test(R)?Rl:""}${F?ra:""}${V?aa:""}${/data-audio/.test(R)?oa:""}${/data-countdown/.test(R)?la:""}${/data-filter-group/.test(R)?da:""}${/data-compare/.test(R)?fa:""}${/data-hotspot/.test(R)?ba:""}${/data-strips/.test(R)?va:""}${/data-switcher/.test(R)?wa:""}${/data-exhibit/.test(R)?Sa:""}${/data-scrolly/.test(R)?Ea:""}${/data-clocks/.test(R)?Ca:""}${/data-roster/.test(R)?Ta:""}${/data-tiers/.test(R)?Ma:""}${/data-qapills/.test(R)?Da:""}${/data-chapters/.test(R)?Fa:""}${/data-slotpicker/.test(R)?qa:""}${/data-reel/.test(R)?_a:""}${/data-grow/.test(R)?Ha:""}${/data-deck/.test(R)?Wa:""}${/data-metrics/.test(R)?Ya:""}${/data-spotlight/.test(R)?Ka:""}${/data-terminal/.test(R)?Ja:""}${/data-tilt/.test(R)?Qa:""}${/data-flip/.test(R)?tn:""}${n?`<script>
${Wr}
<\/script>
`:""}</body>
</html>
`}var ot=class extends Error{suppliedVersion;supportedVersion;constructor(t,r,a=fe){super(t),this.name="DocumentSchemaError",this.suppliedVersion=r,this.supportedVersion=a}},jl=e=>{if(!e||typeof e!="object")return null;let t=e,r=t.schemaVersion??t.v;return Number.isInteger(r)?r:null};function zi(e){let t=jl(e);if(t!==null&&t>fe)throw new ot(`This project uses Pagecraft schema ${t}, but this host supports schema ${fe}. Upgrade Pagecraft on this host before opening or saving the project.`,t);let r;try{r=Ti(qe(e))}catch(a){throw new ot(`This Pagecraft document is invalid and could not be migrated: ${a instanceof Error?a.message:String(a)}`,t)}if(!r)throw new ot("This Pagecraft document is incomplete or unsupported. Restore a valid project backup or upgrade Pagecraft.",t);return r}var _i="pagecraft-renderer-4";var ji=e=>`pagecraft-core-${e}`;var Hl="0.2.19",Hi=Object.freeze({format:"pagecraft.editor-contract.v1",editorVersion:Hl,schemaVersion:fe,rendererVersion:ji(fe),rendererRevision:_i}),Vi="pagecraft.wordpress-compile.v1";var oe=class extends Error{constructor(r,a){super(a);this.code=r;this.name="PagecraftCompilerError"}code},Vl=/%%PAGECRAFT_WP_CONTENT:(page|post):([A-Za-z0-9_-]+)%%/g,Ui=(e,t)=>{let r=String(e??"").trim();if(!r||/[\u0000-\u001f\u007f"'<>\\]/.test(r))throw new oe("invalid_url",`${t} has an invalid URL.`);let a;try{a=new URL(r)}catch{throw new oe("invalid_url",`${t} has an invalid URL.`)}if(!["http:","https:"].includes(a.protocol)||a.username||a.password)throw new oe("invalid_url",`${t} must use a durable HTTP or HTTPS URL.`);return a.href};function Wl(e,t){if(t)for(let r of["maxWidth","font","headFont","size","css","tokens"])Object.prototype.hasOwnProperty.call(t,r)&&(e.meta[r]=qe(t[r]))}var Mt=new Set(["primary","footer","utility"]);function It(e,t,r,a){Array.isArray(t)&&t.forEach(i=>{if(!i||typeof i!="object"||Array.isArray(i))return;let n=i,o=String(n.use||""),c=o?e.meta.components?.find(f=>f.id===o):void 0;c?r.has(o)||(r.add(o),It(e,[c.node],r,a)):a(n),It(e,n.children,r,a)})}function Ul(e){let t=0,r=new Set;It(e,e.header,r,i=>{if(i.type!=="nav"||!i.props||typeof i.props!="object")return;let n=String(i.props.menuLocation||"");Mt.has(n)||(i.props.menuLocation=t===0?"primary":"utility"),t++});let a=0;It(e,e.footer,r,i=>{if(i.type!=="nav"||!i.props||typeof i.props!="object")return;let n=String(i.props.menuLocation||"");!Mt.has(n)&&a===0&&(i.props.menuLocation="footer"),a++})}function Yl(e){return e.map(t=>{let r=String(t.href??t.url??""),a=String(t.anchor||"");return t.href===void 0&&a&&!r.includes("#")&&(r+=`#${a}`),{id:String(t.id||""),label:String(t.label||""),href:r,parentId:String(t.parentId||""),cls:t.cls!==void 0?String(t.cls):(t.classes||[]).map(String).join(" "),target:t.target==="_blank"?"_blank":"",rel:String(t.rel||""),objectType:String(t.objectType||"custom"),objectId:String(t.objectId||""),anchor:a}})}function Gl(e){let t={};return Array.isArray(e)?e.forEach(r=>{let a=String(r?.location||"");Mt.has(a)&&(t[a]=r)}):e&&Object.entries(e).forEach(([r,a])=>{Mt.has(r)&&a&&(t[r]=a)}),t}function Rr(e,t){if(e==null||typeof e!="object")return;if(Array.isArray(e)){e.forEach(a=>Rr(a,t));return}let r=e;if(r.type==="nav"&&r.props&&typeof r.props=="object"){let a=String(r.props.menuLocation||""),i=t[a];i&&(r.props.items=Yl(i.items),i.id&&(r.props.nativeMenuId=String(i.id)))}Object.values(r).forEach(a=>Rr(a,t))}function Kl(e,t){let r=new Set,a=new Map,i=String(e).replace(fi,(n,o)=>{let c=t[o];if(!c)return r.add(o),n;let f=a.get(o);return f||(f=Ui(c.url,`Image \u201C${c.name||o}\u201D`),a.set(o,f)),f});if(r.size)throw new oe("missing_assets",`WordPress could not resolve ${[...r].map(n=>`\u201C${n}\u201D`).join(", ")}. Reload media and try again.`);return i}function Zl(e,t){let r=new Set,a=String(e).replace(Vl,(i,n,o)=>{let c=`pagecraft:wordpress-content:${n}:${o}`,f=t?.[i]||t?.[c];return f?Ui(f,`WordPress ${n} link`).replace(/&/g,"&amp;"):(r.add(c),i)});if(r.size)throw new oe("missing_wordpress_content",`WordPress could not resolve ${[...r].join(", ")}. Refresh the content index and try again.`);return a}async function Jl(e){let t=hr();if(!t)return"";let r;try{r=await e(t)}catch{throw new oe("font_fetch_failed","The selected fonts could not be loaded. Check the connection and retry.")}if(!r.ok)throw new oe("font_fetch_failed","The selected fonts could not be loaded. Check the connection and retry.");let a=Hn(await r.text());if(!a.length)throw new oe("font_parse_failed","The selected fonts returned no usable font files. Retry or choose another font.");return Vn(a,i=>i.url)+`
`}async function Xl(e,t){try{if(t?.subtle&&typeof t.subtle.digest=="function"){let r=new TextEncoder().encode(e),a=await t.subtle.digest("SHA-256",r);return[...new Uint8Array(a)].map(i=>i.toString(16).padStart(2,"0")).join("")}}catch{}try{return Ht(e)}catch{throw new oe("hash_failed","Pagecraft could not verify the generated output in this browser. Reload the editor and retry.")}}async function Ql(e,t,r){if(!t||!String(t.pageId||"").trim())throw new oe("missing_page","Choose the exact Pagecraft page to compile.");let a=qe(Un());try{let i=zi(e);Wl(i,t.design),Ul(i),Rr(i,Gl(t.wordpressMenus)),br(i);let n=M.pages.find(w=>w.id===t.pageId);if(!n)throw new oe("missing_page",`Page \u201C${t.pageId}\u201D is not present in this document.`);let o=await Jl(r.fetch),c=Fi(n),f=w=>Zl(Kl(w,t.assets||{}),t.wordpressContent),m=f(qi(n)),d=o+f(c.global),E=f(c.page),P=await Xl(JSON.stringify({html:m,globalCss:d,pageCss:E}),r.crypto);return{format:Vi,compiler:Hi,pageId:n.id,html:m,globalCss:d,pageCss:E,fontCss:o,contentHash:P}}finally{br(a)}}var Wi=Promise.resolve();function Yi(e,t,r={fetch:globalThis.fetch.bind(globalThis),crypto:globalThis.crypto}){let a=Wi.then(()=>Ql(e,t,r));return Wi=a.then(()=>{},()=>{}),a}var Or=self,Gi=Promise.resolve();Or.addEventListener("message",e=>{let t=e.data,r=async()=>{try{let a=await Yi(t.document,t.options);Or.postMessage({id:t.id,ok:!0,result:a})}catch(a){Or.postMessage({id:t.id,ok:!1,error:{name:a instanceof Error?a.name:"Error",code:a instanceof oe?a.code:"compile_failed",message:a instanceof Error?a.message:String(a)}})}};Gi=Gi.then(r,r)});})();
