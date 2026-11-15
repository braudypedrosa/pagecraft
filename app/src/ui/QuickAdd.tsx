/* The picker a quick-add + opens: a search box over the common elements, the whole palette
   when you type, and "More…" for the full Add panel aimed at the same spot.

   It lives in the outer document beside the context menu and takes the same menu styles.
   The canvas is an iframe, so the caller passes a point already in outer coordinates. */
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { quickAddChoices } from './Add';

export type QuickAddSide = 'top' | 'right' | 'bottom' | 'left';
export interface QuickAddOptions {
  x: number;
  y: number;
  side: QuickAddSide;
  onPick(key: string): void;
  onMore(): void;
}

const SIDE_LABEL: Record<QuickAddSide, string> = { top: 'above', bottom: 'below', left: 'to the left', right: 'to the right' };
let host: HTMLDivElement | null = null;
let away: ((e: Event) => void) | null = null;

export function closeQuickAdd() {
  if (away) { document.removeEventListener('pointerdown', away, true); away = null; }
  if (!host) return;
  render(null, host);
  host.remove();
  host = null;
}

function Picker({ side, onPick, onMore }: Omit<QuickAddOptions, 'x' | 'y'>) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const choices = quickAddChoices(query);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { setActive(0); }, [query]);

  const pick = (key: string) => { closeQuickAdd(); onPick(key); };
  const more = () => { closeQuickAdd(); onMore(); };
  const rows = choices.length + 1; // the choices, then More…
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); closeQuickAdd(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % rows); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + rows) % rows); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (active < choices.length) pick(choices[active][0]); else more();
    }
  };

  return <div class="pc-menu pc-quick-add" role="dialog" aria-label={`Add an element ${SIDE_LABEL[side]}`} onKeyDown={onKey}>
    <input ref={input} class="ctl pc-quick-add-search" type="search" placeholder="Search elements"
      aria-label="Search elements" value={query} onInput={e => setQuery((e.target as HTMLInputElement).value)} />
    <div role="listbox" aria-label="Elements">
      {choices.length ? choices.map(([key, label], index) => (
        <button type="button" key={key} role="option" aria-selected={index === active ? 'true' : 'false'}
          class={'pc-menu-item' + (index === active ? ' on' : '')} data-key={key}
          onMouseEnter={() => setActive(index)} onClick={() => pick(key)}>{label}</button>
      )) : <div class="pc-quick-add-empty">No elements match</div>}
    </div>
    <div class="pc-menu-divider" role="separator" />
    <button type="button" class={'pc-menu-item' + (active === choices.length ? ' on' : '')} data-more
      onMouseEnter={() => setActive(choices.length)} onClick={more}>More…</button>
  </div>;
}

/** Open the picker at a point in the outer document. One at a time; opening again replaces it. */
export function openQuickAdd({ x, y, side, onPick, onMore }: QuickAddOptions) {
  closeQuickAdd();
  host = document.createElement('div');
  host.className = 'pc-quick-add-host';
  host.style.position = 'fixed';
  host.style.zIndex = '10000';
  document.body.appendChild(host);
  render(<Picker side={side} onPick={onPick} onMore={onMore} />, host);
  /* Beside the + it came from, pulled back inside the window. */
  const box = host.firstElementChild as HTMLElement;
  const r = box.getBoundingClientRect();
  /* Opens away from the element on the side it was asked for, and flips when there is no room. */
  let left = side === 'left' ? x - r.width - 12 : side === 'right' ? x + 12 : x - r.width / 2;
  let top = side === 'top' ? y - r.height - 12 : side === 'bottom' ? y + 12 : y - r.height / 2;
  if (side === 'top' && top < 8) top = y + 12;
  if (side === 'bottom' && top + r.height > window.innerHeight - 8) top = y - r.height - 12;
  if (side === 'left' && left < 8) left = x + 12;
  if (side === 'right' && left + r.width > window.innerWidth - 8) left = x - r.width - 12;
  host.style.left = Math.max(8, Math.min(left, window.innerWidth - r.width - 8)) + 'px';
  host.style.top = Math.max(8, Math.min(top, window.innerHeight - r.height - 8)) + 'px';
  /* A press anywhere else closes it, the way the context menu closes. */
  const opened = host;
  setTimeout(() => {
    if (host !== opened) return;
    away = (e: Event) => { if (host && !host.contains(e.target as Node)) closeQuickAdd(); };
    document.addEventListener('pointerdown', away, true);
  });
  return host;
}
