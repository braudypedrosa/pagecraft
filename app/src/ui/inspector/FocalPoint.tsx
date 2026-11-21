/* I10: the focal point of a cropped image.

   With Fit: Cover (or None) the frame shows part of the photo, and CSS keeps the centre unless
   object-position says otherwise. This control shows the whole photo, a dot to drag to the part
   that matters, and a dashed box for what the frame on the page actually keeps. The point is
   stored as two percentages in object-position, per breakpoint like any other style, so a phone
   frame can keep a different part than the desktop one.

   The panel is not redrawn while dragging or nudging (that would drop pointer capture and keyboard
   focus), so the dot and box are moved directly and the value is written with `live`; the
   transaction closes on pointer release or blur. */
import { useLayoutEffect, useState } from 'preact/hooks';
import { C } from '../ctx';
import { Field } from './Field';
import { valueOf, bound, writer } from './ctl';
import type { Control, Node as PcNode } from '../../core/types';

type P = { n: PcNode; c: Control };
export type Point = { x: number; y: number };

const WORDS: Record<string, number> = { left: 0, top: 0, center: 50, right: 100, bottom: 100 };

/** Read an object-position value as percentages. Keywords and percentages are understood;
    anything else (lengths, calc) falls back to the centre, which is what CSS starts from. */
export function parseFocal(value: string): Point {
  const parts = String(value || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!parts.length) return { x: 50, y: 50 };
  const num = (s: string) => s in WORDS ? WORDS[s] : /^-?\d+(\.\d+)?%$/.test(s) ? parseFloat(s) : null;
  let x: number | null = null, y: number | null = null;
  if (parts.length === 1) {
    const p = parts[0];
    if (p === 'top' || p === 'bottom') y = WORDS[p]; else x = num(p);
  } else {
    const [a, b] = parts;
    // "top right" names the vertical first; CSS accepts either order for keywords.
    if (a === 'top' || a === 'bottom' || b === 'left' || b === 'right') { y = num(a); x = num(b); }
    else { x = num(a); y = num(b); }
  }
  const clamp = (v: number | null) => v == null || !Number.isFinite(v) ? 50 : Math.min(100, Math.max(0, v));
  return { x: clamp(x), y: clamp(y) };
}

export const formatFocal = (p: Point) => `${Math.round(p.x)}% ${Math.round(p.y)}%`;

/** The part of the photo a frame keeps, as fractions of the photo: Cover scales the photo to
    fill the frame, None shows it at its own size. */
export function keptBox(fit: string, natural: { w: number; h: number }, frame: { w: number; h: number }, p: Point) {
  if (!natural.w || !natural.h || !frame.w || !frame.h) return null;
  const scale = fit === 'none' ? 1 : Math.max(frame.w / natural.w, frame.h / natural.h);
  const fw = Math.min(1, frame.w / (natural.w * scale));
  const fh = Math.min(1, frame.h / (natural.h * scale));
  return { left: (1 - fw) * p.x / 100, top: (1 - fh) * p.y / 100, width: fw, height: fh };
}

const canvasImage = (n: PcNode) => {
  const doc = (document.getElementById('canvas') as HTMLIFrameElement | null)?.contentDocument;
  return doc?.querySelector<HTMLImageElement>(`img[data-id="${n.id}"], [data-id="${n.id}"] img`) || null;
};

/* The inspector may redraw mid-gesture (the first write at a breakpoint turns an inherited value
   into an override and repaints the panel). So nothing here depends on its DOM surviving: the
   pad is found by node id, a drag listens on window, and keyboard focus is put back. */
let keyboardFocus: string | null = null;
let dragging: string | null = null;
/** Where the pad was when the drag began; a redraw that moves it is scrolled back under the pointer. */
let dragTop: number | null = null;
/* The first write at a breakpoint turns an inherited value into an override, and the panel
   above grows to say so, which would move the photo out from under the pointer mid-drag. */
const scroller = (el: HTMLElement | null) => {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
};
const holdPad = (id: string) => {
  const el = padOf(id), top = el?.getBoundingClientRect().top;
  if (!el || top == null || dragTop == null || Math.abs(top - dragTop) < .5) return;
  const sc = scroller(el); if (sc) sc.scrollTop += top - dragTop;
};
const padOf = (id: string) => document.querySelector<HTMLElement>(`.pc-focal-pad[data-focal="${CSS.escape(id)}"]`);

export function FocalCtl({ n, c }: P) {
  const w = writer(n, c);
  const start = parseFocal(String(valueOf(n, c) ?? ''));
  const [, setLoaded] = useState(0);
  const img = canvasImage(n);
  const src = img?.currentSrc || img?.src || String(C.propVal(n, 'src') || '');
  const fit = String(C.cssVal(C.tgtObj(n), 'object-fit', true).v || 'cover').trim();
  const locked = !!bound(n, c).fid;

  const place = (p: Point) => {
    const el = padOf(n.id); if (!el) return;
    const dot = el.querySelector<HTMLElement>('.pc-focal-dot')!;
    dot.style.left = p.x + '%'; dot.style.top = p.y + '%';
    dot.setAttribute('aria-valuenow', String(Math.round(p.x)));
    dot.setAttribute('aria-valuetext', `${Math.round(p.x)}% across, ${Math.round(p.y)}% down`);
    const box = el.querySelector<HTMLElement>('.pc-focal-kept');
    const live = canvasImage(n);
    const kept = live ? keptBox(fit, { w: live.naturalWidth, h: live.naturalHeight }, { w: live.clientWidth, h: live.clientHeight }, p) : null;
    if (box) {
      box.hidden = !kept || (kept.width >= .999 && kept.height >= .999);
      if (kept) Object.assign(box.style, { left: kept.left * 100 + '%', top: kept.top * 100 + '%', width: kept.width * 100 + '%', height: kept.height * 100 + '%' });
    }
    const out = el.parentElement?.querySelector('.pc-focal-value');
    if (out) out.textContent = formatFocal(p).replace(' ', ' · ');
  };
  useLayoutEffect(() => {
    if (dragging === n.id) holdPad(n.id);
    place(parseFocal(String(valueOf(n, c) ?? '')));
    if (keyboardFocus === n.id && (!document.activeElement || document.activeElement === document.body))
      padOf(n.id)?.querySelector<HTMLElement>('.pc-focal-dot')?.focus({ preventScroll: true });
  });

  const set = (p: Point) => { place(p); w.live(formatFocal(p)); };
  const at = (e: PointerEvent): Point | null => {
    const el = padOf(n.id); if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100)), y: Math.min(100, Math.max(0, (e.clientY - r.top) / r.height * 100)) };
  };
  const onDown = (e: PointerEvent) => {
    if (locked || e.button !== 0) return;
    e.preventDefault();
    dragging = n.id;
    dragTop = padOf(n.id)?.getBoundingClientRect().top ?? null;
    const move = (ev: PointerEvent) => { if (dragging !== n.id || ev.pointerId !== e.pointerId) return; holdPad(n.id); const p = at(ev); if (p) set(p); };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      dragging = null; dragTop = null;
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      w.done();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    const p = at(e); if (p) set(p);
  };
  const onKey = (e: KeyboardEvent) => {
    if (locked) return;
    const step = e.shiftKey ? 10 : 1;
    const now = parseFocal(String(valueOf(n, c) ?? ''));
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    let next: Point | null = null;
    if (e.key === 'Home' || e.key === 'End') next = { x: e.key === 'Home' ? 0 : 100, y: now.y };
    else if (d[e.key]) next = { x: Math.min(100, Math.max(0, Math.round(now.x) + d[e.key][0])), y: Math.min(100, Math.max(0, Math.round(now.y) + d[e.key][1])) };
    if (!next) return;
    // The editor's document-level shortcuts walk the canvas selection on arrow keys.
    e.preventDefault(); e.stopPropagation();
    keyboardFocus = n.id;
    set(next);
  };
  const onBlur = (e: FocusEvent) => {
    // A redraw removes the focused dot without moving focus anywhere; that is not leaving.
    if (!(e.relatedTarget instanceof HTMLElement)) { if (!(e.currentTarget as HTMLElement).isConnected) return; }
    keyboardFocus = null;
    w.done();
  };

  return <Field n={n} c={c}>
    <div class="pc-focal">
      <div class={'pc-focal-pad' + (locked ? ' is-locked' : '')} data-focal={n.id} onPointerDown={onDown}>
        {src ? <img src={src} alt="" draggable={false} onLoad={() => setLoaded(v => v + 1)} /> : <span class="pc-focal-empty">Choose an image first</span>}
        <span class="pc-focal-kept" aria-hidden="true" hidden />
        <span class="pc-focal-dot" role="slider" tabIndex={locked ? -1 : 0}
          aria-label={`${c.label}: arrow keys move it, Shift moves further`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(start.x)}
          aria-valuetext={`${Math.round(start.x)}% across, ${Math.round(start.y)}% down`}
          aria-disabled={locked ? 'true' : undefined}
          style={{ left: start.x + '%', top: start.y + '%' }}
          onKeyDown={onKey} onBlur={onBlur} />
      </div>
      <div class="pc-focal-row">
        <span>Drag to choose what stays in view · <span class="pc-focal-value">{formatFocal(start).replace(' ', ' · ')}</span></span>
        <button type="button" class="btn tiny" disabled={locked} onClick={() => w.hard('')}>Reset</button>
      </div>
    </div>
  </Field>;
}
