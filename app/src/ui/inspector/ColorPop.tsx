/* The colour picker, drawn rather than delegated.

   It was `<input type="color">`, which means the operating system's dialog: no alpha, a
   panel that looks like nothing else in the app, and on macOS a window larger than the
   inspector it was launched from. Alpha was the real gap — `rgba()` already worked end to
   end, since the css objects carry raw CSS and `parseColor` reads it back, so the only
   thing missing was a way to *pick* one.

   A library was the obvious answer and the wrong one. The hard part of this control is
   already built and no library knows about it: the token link, the live/done write split,
   the responsive override badge, the swatch strip. What a picker adds on top is a
   saturation square, a hue strip and an alpha strip — three of the same widget.

   Positioned `fixed` from the swatch's own rect. The inspector scrolls inside an ancestor
   with `overflow:auto`, so an absolutely-positioned popover would be clipped by it; fixed
   escapes that and pays for it by having to close on scroll, which is what a popover
   anchored to a moving element should do anyway. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { C } from '../ctx';
import { Icon } from '../Icon';

/* Chrome and Edge only, so it is feature-detected rather than assumed. Not in the DOM
   typings at this TypeScript version. */
interface EyeDropperCtor { new(): { open(): Promise<{ sRGBHex: string }> } }
const EyeDropperApi = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;

type Rgba = { r: number; g: number; b: number; a: number };
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

const splitGradient = (value: string) => {
  const match = String(value || '').trim().match(/^linear-gradient\((.*)\)$/i);
  if (!match) return null;
  const parts: string[] = [];
  let part = '', depth = 0;
  for (const ch of match[1]) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { parts.push(part.trim()); part = ''; }
    else part += ch;
  }
  if (part.trim()) parts.push(part.trim());
  const anglePart = /^(-?\d+(?:\.\d+)?)deg$/i.exec(parts[0] || '');
  const angle = anglePart ? Number(anglePart[1]) : 180;
  const colors = (anglePart ? parts.slice(1) : parts).slice(0, 2).map(raw => {
    const value = raw.replace(/\s+-?\d+(?:\.\d+)?%\s*$/, '');
    return C.parseColor(C.resolveColor(value) || value);
  });
  return colors.length === 2 && colors.every(Boolean)
    ? { angle, stops: colors as Rgba[] } : null;
};

/** A 2-D or 1-D drag surface. The three strips differ only in what they read from a
    pointer position, so they share one set of pointer handlers — including the capture,
    without which a fast drag off the square drops the gesture. */
function Surface(
  { cls, onPick, children, aria, value, onKey }:
  {
    cls: string;
    onPick: (fx: number, fy: number) => void;
    children?: preact.ComponentChildren;
    aria: string;
    value: string;
    onKey: (e: KeyboardEvent) => void;
  }
) {
  const el = useRef<HTMLDivElement>(null);
  const at = (e: PointerEvent) => {
    const b = el.current!.getBoundingClientRect();
    onPick(
      b.width ? Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)) : 0,
      b.height ? Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) : 0
    );
  };
  return (
    <div class={cls} ref={el} tabIndex={0} role="slider" aria-label={aria}
      aria-valuetext={value} onKeyDown={onKey}
      onPointerDown={e => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        at(e as unknown as PointerEvent);
      }}
      onPointerMove={e => { if (e.buttons) at(e as unknown as PointerEvent); }}>
      {children}
    </div>
  );
}

export function ColorPop(
  { start, gradient, anchor, onLive, onDone, onClose }:
  {
    start: string;
    gradient?: { start: string; onLive: (css: string) => void; onDone: (css: string) => void };
    anchor: HTMLElement;
    onLive: (css: string) => void;
    onDone: (css: string) => void;
    onClose: () => void;
  }
) {
  /* Hue is held separately from the rgb value on purpose. Pure black and pure white have
     no hue to recover, so deriving it from rgb every render would snap the pointer to red
     the moment the value hit an edge — and dragging back out would start from red instead
     of where you were. */
  const first = C.parseColor(start) || BLACK;
  const parsedGradient = gradient ? splitGradient(gradient.start) : null;
  const fallbackStop = C.parseColor('#ffffff')!;
  const [mode, setMode] = useState<'solid' | 'gradient'>(parsedGradient ? 'gradient' : 'solid');
  const [solid, setSolid] = useState<Rgba>(first);
  const [stops, setStops] = useState<Rgba[]>(parsedGradient?.stops || [first, fallbackStop]);
  const [activeStop, setActiveStop] = useState(0);
  const [angle, setAngle] = useState(parsedGradient?.angle ?? 135);
  const [hue, setHue] = useState(C.rgb2hsv(first).h);
  const box = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    anchor.setAttribute('aria-expanded', 'false');
    const element = box.current, motion = window.__pcMotion;
    if (element && motion && !motion.reduced()) motion.exit(element, { kind: 'popover', hide: false }).then(onClose);
    else onClose();
  };

  const rgba = mode === 'gradient' ? stops[activeStop] : solid;
  const hsv = C.rgb2hsv(rgba);
  const css = C.fmtColor(rgba);
  /* `hue` leads while dragging the square, but a value arriving from the hex field or the
     eyedropper carries its own — so the strip follows rgb whenever rgb has a hue to give. */
  const h = hsv.s > 0.004 && hsv.v > 0.004 ? hsv.h : hue;

  const gradientCss = (nextStops = stops, nextAngle = angle) =>
    `linear-gradient(${nextAngle}deg, ${C.fmtColor(nextStops[0])}, ${C.fmtColor(nextStops[1])})`;
  const put = (next: Rgba, commit?: boolean) => {
    if (mode === 'gradient' && gradient) {
      const nextStops = stops.map((stop, index) => index === activeStop ? next : stop);
      setStops(nextStops);
      (commit ? gradient.onDone : gradient.onLive)(gradientCss(nextStops));
    } else {
      setSolid(next);
      (commit ? onDone : onLive)(C.fmtColor(next));
    }
  };
  const fromHsv = (s: number, v: number, hh = h, a = rgba.a, commit?: boolean) =>
    put({ ...C.hsv2rgb({ h: hh, s, v }), a }, commit);

  /* Escape closes, and an outside pointerdown closes — but not one that landed inside the
     popover, and not the click on the swatch that opened it, which would otherwise reopen
     and close in the same gesture. Scroll and resize close too, because the anchor moves
     and a fixed popover does not follow it. */
  useEffect(() => {
    const away = (e: Event) => {
      const t = e.target as Node;
      if (box.current?.contains(t) || anchor.contains(t)) return;
      requestClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); requestClose();
        if (anchor.isConnected) anchor.focus({ preventScroll: true });
      }
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('pagecraft:outside-pointer', requestClose);
    window.addEventListener('blur', requestClose);
    document.addEventListener('keydown', key, true);
    window.addEventListener('resize', requestClose);
    window.addEventListener('scroll', requestClose, true);
    if (box.current) window.__pcMotion?.enter(box.current, { kind: 'popover' });
    box.current?.querySelector<HTMLElement>('.cp-sv')?.focus();
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('pagecraft:outside-pointer', requestClose);
      window.removeEventListener('blur', requestClose);
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', requestClose);
      window.removeEventListener('scroll', requestClose, true);
    };
  }, [anchor, onClose]);

  /* Flipped above the anchor when there is no room below, and pinned inside the viewport
     horizontally. A colour field near the bottom of a long inspector is the common case,
     not the edge case. */
  const r = anchor.getBoundingClientRect();
  const W = 232, H = gradient ? 330 : 244;
  const below = window.innerHeight - r.bottom > H + 12;
  const style = {
    left: Math.round(Math.min(Math.max(8, r.left), window.innerWidth - W - 8)) + 'px',
    top: Math.round(below ? r.bottom + 6 : Math.max(8, r.top - H - 6)) + 'px',
    width: W + 'px'
  };

  const nudge = (e: KeyboardEvent, dx: (k: number) => void, dy?: (k: number) => void) => {
    const step = e.shiftKey ? 10 : 1;
    const map: Record<string, () => void> = {
      ArrowLeft: () => dx(-step), ArrowRight: () => dx(step),
      ArrowUp: () => (dy || dx)(dy ? -step : step), ArrowDown: () => (dy || dx)(dy ? step : -step)
    };
    if (!map[e.key]) return;
    e.preventDefault(); e.stopPropagation();
    map[e.key]();
  };

  const pick = async () => {
    if (!EyeDropperApi) return;
    try {
      const got = await new EyeDropperApi().open();
      const c = C.parseColor(got.sRGBHex);
      if (c) { setHue(C.rgb2hsv(c).h); put({ ...c, a: rgba.a }, true); }
    } catch { /* the user pressed Escape out of the sampling mode; nothing to report */ }
  };

  return (
    <div class="cp" ref={box} style={style} onPointerDown={e => e.stopPropagation()}>
      {gradient ? <div class="cp-modes" role="tablist" aria-label="Paint type">
        <button type="button" role="tab" aria-selected={mode === 'solid'} class={mode === 'solid' ? 'on' : ''}
          onClick={() => { setMode('solid'); gradient.onDone(''); }}>Solid</button>
        <button type="button" role="tab" aria-selected={mode === 'gradient'} class={mode === 'gradient' ? 'on' : ''}
          onClick={() => { setMode('gradient'); gradient.onDone(gradientCss()); }}>Gradient</button>
      </div> : null}

      {mode === 'gradient' ? <div class="cp-gradient">
        <div class="cp-gradient-preview" style={{ background: gradientCss() }} />
        <div class="cp-stops" role="group" aria-label="Gradient colour stop">
          {stops.map((stop, index) => <button type="button" key={index}
            class={activeStop === index ? 'on' : ''} aria-pressed={activeStop === index}
            aria-label={'Edit gradient colour ' + (index + 1)}
            onClick={() => { setActiveStop(index); setHue(C.rgb2hsv(stop).h); }}>
            <i style={{ background: C.fmtColor(stop) }} />
          </button>)}
          <label>Angle
            <select class="ctl" value={String(angle)} onChange={e => {
              const next = Number((e.target as HTMLSelectElement).value);
              setAngle(next); gradient?.onDone(gradientCss(stops, next));
            }}>
              {[0, 45, 90, 135, 180, 225, 270, 315].map(value => <option key={value} value={value}>{value}°</option>)}
            </select>
          </label>
        </div>
      </div> : null}

      <Surface cls="cp-sv" aria={'Saturation and brightness'}
        value={Math.round(hsv.s * 100) + '% saturation, ' + Math.round(hsv.v * 100) + '% brightness'}
        onPick={(fx, fy) => fromHsv(fx, 1 - fy)}
        onKey={e => nudge(e,
          k => fromHsv(Math.min(1, Math.max(0, hsv.s + k / 100)), hsv.v, h, rgba.a, true),
          k => fromHsv(hsv.s, Math.min(1, Math.max(0, hsv.v - k / 100)), h, rgba.a, true))}>
        <div class="cp-svbg" style={{ background: `hsl(${h} 100% 50%)` }} />
        <i class="cp-dot" style={{
          left: hsv.s * 100 + '%', top: (1 - hsv.v) * 100 + '%',
          background: C.fmtColor({ ...rgba, a: 1 })
        }} />
      </Surface>

      <div class="cp-rows">
        <span class="cp-chip"><i style={{ background: css }} /></span>
        <div class="cp-strips">
          <Surface cls="cp-hue" aria="Hue" value={Math.round(h) + ' degrees'}
            onPick={fx => { const nh = fx * 360; setHue(nh); fromHsv(hsv.s || 1, hsv.v || 1, nh); }}
            onKey={e => nudge(e, k => { const nh = (h + k * 2 + 360) % 360; setHue(nh); fromHsv(hsv.s || 1, hsv.v || 1, nh, rgba.a, true); })}>
            <i class="cp-tick" style={{ left: (h / 360) * 100 + '%' }} />
          </Surface>
          <Surface cls="cp-alpha" aria="Opacity" value={Math.round(rgba.a * 100) + '%'}
            onPick={fx => put({ ...rgba, a: fx })}
            onKey={e => nudge(e, k => put({ ...rgba, a: Math.min(1, Math.max(0, rgba.a + k / 100)) }, true))}>
            <div class="cp-abg" style={{ background: `linear-gradient(90deg, transparent, ${C.fmtColor({ ...rgba, a: 1 })})` }} />
            <i class="cp-tick" style={{ left: rgba.a * 100 + '%' }} />
          </Surface>
        </div>
        {EyeDropperApi ? (
          <button class="cp-eye" title="Sample a colour from the screen" onClick={pick}>
            <Icon name="pipette" size={13} />
          </button>
        ) : null}
      </div>

      <div class="cp-foot">
        <input class="ctl cp-val" value={css} spellcheck={false}
          aria-label="Colour value"
          onInput={e => {
            const c = C.parseColor((e.target as HTMLInputElement).value);
            if (!c) return;                       /* mid-typing is not an error */
            setHue(C.rgb2hsv(c).h); put(c);
          }}
          onBlur={() => onDone(css)} />
        <span class="cp-pc">{Math.round(rgba.a * 100)}%</span>
      </div>
    </div>
  );
}
