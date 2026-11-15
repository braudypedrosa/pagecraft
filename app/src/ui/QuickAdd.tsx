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
  /** A section's + also offers starter sections: [pattern id, name]. */
  sections?: [string, string][];
  onPickSection?(id: string): void;
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

function Picker({ side, onPick, onMore, sections = [], onPickSection }: Omit<QuickAddOptions, 'x' | 'y'>) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const choices = quickAddChoices(query);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const sectionChoices = sections.filter(([id, name]) => terms.every(t => `${name} ${id} section`.toLowerCase().includes(t)));
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { setActive(0); }, [query]);

  const pick = (key: string) => { closeQuickAdd(); onPick(key); };
  const pickSection = (id: string) => { closeQuickAdd(); onPickSection?.(id); };
  const more = () => { closeQuickAdd(); onMore(); };
  // Rows in keyboard order: the elements, then starter sections, then More…
  const rows = choices.length + sectionChoices.length + 1;
  const moreRow = rows - 1;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); closeQuickAdd(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % rows); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + rows) % rows); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (active < choices.length) pick(choices[active][0]);
      else if (active < moreRow) pickSection(sectionChoices[active - choices.length][0]);
      else more();
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
      )) : sectionChoices.length ? null : <div class="pc-quick-add-empty">No elements match</div>}
    </div>
    {sectionChoices.length ? <>
      <div class="pc-quick-add-group" id="pc-quick-add-sections">Sections</div>
      <div role="listbox" aria-labelledby="pc-quick-add-sections">
        {sectionChoices.map(([id, name], i) => {
          const index = choices.length + i;
          return <button type="button" key={id} role="option" aria-selected={index === active ? 'true' : 'false'}
            class={'pc-menu-item' + (index === active ? ' on' : '')} data-section={id}
            onMouseEnter={() => setActive(index)} onClick={() => pickSection(id)}>{name}</button>;
        })}
      </div>
    </> : null}
    <div class="pc-menu-divider" role="separator" />
    <button type="button" class={'pc-menu-item' + (active === moreRow ? ' on' : '')} data-more
      onMouseEnter={() => setActive(moreRow)} onClick={more}>More…</button>
  </div>;
}

/** Open the picker at a point in the outer document. One at a time; opening again replaces it. */
export function openQuickAdd({ x, y, side, onPick, onMore, sections, onPickSection }: QuickAddOptions) {
  closeQuickAdd();
  host = document.createElement('div');
  host.className = 'pc-quick-add-host';
  host.style.position = 'fixed';
  host.style.zIndex = '10000';
  document.body.appendChild(host);
  render(<Picker side={side} onPick={onPick} onMore={onMore} sections={sections} onPickSection={onPickSection} />, host);
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
