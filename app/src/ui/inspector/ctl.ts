/* What every control needs: the value to show, and the three ways to write one back.

   In builder.html this lived at the top of `bindRight`'s per-control loop, reached
   through `CUR[+f.dataset.ci]` — the panel numbered each field in its markup and the
   binder looked the number up. That indirection is what the control-parity guard in
   build.mjs polices, and it exists only because markup and wiring were written in
   different functions. Here the control object is simply in scope. */
import { C, L, repaint } from '../ctx';
import type { Control, Node as PcNode, PropBag } from '../../core/types';

/** A control's current value — the bound field's value if it has one, else the CSS
    declaration or the prop. A bound field shows what will actually render, not the
    literal standing in for it, or the panel and the canvas disagree. */
export function bound(n: PcNode, c: Control) {
  const scope = c.k ? C.bindScope(n.id) : null;
  const fid = c.k ? C.boundField(n, c.k) : '';
  return { scope, fid };
}

export function valueOf(n: PcNode, c: Control) {
  const { scope, fid } = bound(n, c);
  if (fid && scope) return C.fieldValue(scope.col, C.previewItem(scope.col), fid);
  return c.c ? C.cssVal(C.tgtObj(n), c.c, !!c.r).v : C.propVal(n, c.k);
}

export interface Writer {
  /** coalesced: for typing and dragging. Debounced repaint, transaction left open. */
  live(v: any): void;
  /** committed: for a click or a select. Repaints now and re-renders the panel. */
  hard(v: any): void;
  /** close the transaction — on blur, or after a select settles */
  done(event?: Event): void;
  /** drop this breakpoint's override, which is what the responsive badge does */
  clearOverride(): void;
}

let pointerActivationTarget: HTMLElement | null = null;
let pointerActivationId: number | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', event => {
    const raw = event.target;
    const target = raw instanceof Element ? raw.closest('button, [role="button"]') : null;
    pointerActivationTarget = target instanceof HTMLElement && target.closest('#right, #devSeg') ? target : null;
    pointerActivationId = pointerActivationTarget ? event.pointerId : null;
  }, true);
  const clearPointerActivation = (event: Event) => {
    if (event.type === 'blur' && event.target !== event.currentTarget) return;
    if (event.type === 'pointerup' || event.type === 'pointercancel') {
      const id = (event as PointerEvent).pointerId;
      if (pointerActivationId !== null && id !== pointerActivationId) return;
    }
    pointerActivationTarget = null;
    pointerActivationId = null;
  };
  document.addEventListener('pointerup', clearPointerActivation, true);
  document.addEventListener('pointercancel', clearPointerActivation, true);
  window.addEventListener('blur', clearPointerActivation);
  window.addEventListener('lostpointercapture', clearPointerActivation, true);
}

export function writer(n: PcNode, c: Control): Writer {
  const key = n.id + '|' + (c.c || c.k || c.t);
  const cssOnly = !!c.c;                        // writes a CSS property, not content

  return {
    live(v) {
      L.tx(key);
      C.applyC(n, c, v);
      (cssOnly ? L.repaintCss : L.repaint)();
    },
    hard(v) {
      L.tx(key);
      C.applyC(n, c, v);
      if (cssOnly) L.paintCss(); else { L.paint(); repaint('layers'); }
      L.save();
      L.endTx();
      repaint('right');
    },
    done(event?: Event) {
      L.endTx();
      const next = (event as FocusEvent | undefined)?.relatedTarget;
      /* A pointer activation blurs the text field before its button receives click. Repainting
         the inspector here can replace that button between pointerdown and click, so let the
         interaction settle first. Keyboard focus waits for activation or for focus to leave the
         button instead of using a time-based repaint while the button remains focused. */
      if (next instanceof HTMLElement
        && next.matches('button, [role="button"]')
        && next.closest('#right, #devSeg')
        && !next.matches('.pc-custom-select-trigger')) {
        const pointerActivation = pointerActivationTarget === next;
        const pointerId = pointerActivationId;
        let pending = true;
        const clear = () => {
          next.removeEventListener('click', finish);
          next.removeEventListener('blur', finish);
          next.removeEventListener('pointerup', finishPointer);
          next.removeEventListener('pointercancel', finishPointer);
          document.removeEventListener('pointerup', finishPointer, true);
          document.removeEventListener('pointercancel', finishPointer, true);
          window.removeEventListener('blur', finishWindow);
          window.removeEventListener('lostpointercapture', finishPointer, true);
        };
        const finish = () => {
          if (!pending) return;
          pending = false;
          clear();
          requestAnimationFrame(() => repaint('right'));
        };
        const finishWindow = (event: Event) => {
          if (event.target === event.currentTarget) finish();
        };
        const finishPointer = (event: Event) => {
          if (pointerId !== null && (event as PointerEvent).pointerId !== pointerId) return;
          finish();
        };
        if (pointerActivation) {
          next.addEventListener('pointerup', finishPointer);
          next.addEventListener('pointercancel', finishPointer);
          next.addEventListener('click', finish);
          document.addEventListener('pointerup', finishPointer, true);
          document.addEventListener('pointercancel', finishPointer, true);
          window.addEventListener('blur', finishWindow);
          window.addEventListener('lostpointercapture', finishPointer, true);
        } else {
          next.addEventListener('click', finish);
          next.addEventListener('blur', finish);
        }
        return;
      }
      if (next instanceof HTMLElement && next.matches('.pc-custom-select-trigger')) {
        if (!next.hasAttribute('data-pc-pointer-activating')) {
          /* Tab focus arrives after this blur. Let the browser finish that transfer, then
             refresh conditional controls without waiting for another key or another blur. */
          requestAnimationFrame(() => repaint('right'));
          return;
        }
        /* The first instance-property override inserts reset/status controls above the
           neighboring select. Repainting during the input's blur moves that trigger between
           pointerdown and click, so the click lands on empty space. A marker from the shared
           select enhancer identifies that live gesture; let it finish, then refresh. */
        let pending = true;
        const finish = () => {
          if (!pending) return;
          pending = false;
          next.removeEventListener('click', finish);
          next.removeEventListener('keydown', finish);
          next.removeEventListener('blur', finish);
          requestAnimationFrame(() => repaint('right'));
        };
        next.addEventListener('click', finish);
        next.addEventListener('keydown', finish);
        next.addEventListener('blur', finish);
        return;
      }
      repaint('right');
    },
    clearOverride() {
      L.tx(key + ':clear');
      /* both a node and a class carry `css: Css`, and dk() is a Bp, so this indexes
         without a cast — the union is enough */
      const o = C.tgtObj(n);
      /* the block being edited, not always `css` — clearing a hover override has to clear it
         from the hover block, and `stWrite` is what the writer used to put it there */
      const dest = C.stWrite(o);
      /* a box control writes four declarations, so clearing it has to clear all four
         or three sides survive as a phantom override */
      if (c.t === 'box') {
        delete dest[C.dk()][c.c!];
        ['top', 'right', 'bottom', 'left'].forEach(s => { delete dest[C.dk()][c.c + '-' + s]; });
      }
      else {
        delete dest[C.dk()][c.c!];
        /* The shared background paint field owns its colour plus a gradient layer. It must
           leave an uploaded image alone, because that has its own Image control. */
        if (c.paint) {
          if (/^linear-gradient\(/i.test(String(dest[C.dk()]['background-image'] || ''))) delete dest[C.dk()]['background-image'];
          if (/^linear-gradient\(/i.test(String(dest[C.dk()].background || ''))) delete dest[C.dk()].background;
        }
      }
      L.endTx(); L.paintCss(); L.save();
      repaint('right');
    }
  };
}

/** An array prop, created on demand. Used by items, fields, qa and imgs. */
export const rows = (n: PcNode, c: Control): any[] => {
  const bag = n.props as PropBag;
  return (bag[c.k!] = Array.isArray(bag[c.k!]) ? bag[c.k!] : []) as any[];
};

/** Swap a row with the one above it. Every list control offers this. */
export const liftRow = (n: PcNode, c: Control, k: number) => {
  if (!k) return;
  C.edit(() => { const a = rows(n, c); [a[k - 1], a[k]] = [a[k], a[k - 1]]; });
};
/** Move one row to another row's position. Unlike liftRow this is suited to a drag
    gesture, where the source and destination can be several places apart. */
export const moveRow = (n: PcNode, c: Control, from: number, to: number) => {
  if (from === to || from < 0 || to < 0) return;
  C.edit(() => {
    const a = rows(n, c);
    if (from >= a.length || to >= a.length) return;
    const [row] = a.splice(from, 1);
    a.splice(to, 0, row);
  });
};
export const dropRow = (n: PcNode, c: Control, k: number) =>
  C.edit(() => rows(n, c).splice(k, 1));
