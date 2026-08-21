/* The Content panel, ported.
   Second across, and chosen the same way as the first: `#paneCms` has exactly one
   writer, so Preact can own it outright.

   This one adds the dialogs to the seam. They are promise-returning and resolve falsy
   on cancel rather than rejecting, so every handler here reads the result instead of
   catching — which is what the original did too. */
import { C, L } from './ctx';
import { Icon } from './Icon';

function CollectionRow({ col }: { col: ReturnType<Core['collections']>[number] }) {
  const n = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`;

  const remove = async (e: MouseEvent) => {
    e.stopPropagation();
    const ok = await L.askConfirm('Delete this collection?',
      `<b>${esc(col.name)}</b> and its ${n(col.items.length, 'item')}. Anything bound to its `
      + 'fields falls back to placeholder text.', { ok: 'Delete collection' });
    if (!ok) return;
    C.edit(() => C.collectionDelete(col.id));
  };

  return (
    <div class="brow" title={'Edit ' + col.name} onClick={() => L.cmsModal(col.id)}>
      <Icon name="page" size={14} />
      <span class="bn">
        <b>{col.name}</b>
        <small>{n(col.fields.length, 'field')} · {n(col.items.length, 'item')}</small>
      </span>
      <button class="bx" title="Delete this collection" onClick={remove}>
        <Icon name="trash" size={11} />
      </button>
    </div>
  );
}

export function Cms() {
  const list = C.collections();

  const add = async () => {
    const name = await L.askText('New collection', 'Name', 'Projects',
      { ok: 'Create', note: 'Plural reads best — Projects, Posts, Team.' });
    if (!name) return;
    let made: { id: string } | null = null;
    C.edit(() => { made = C.collectionAdd(name); });
    if (made) L.cmsModal((made as { id: string }).id);
  };

  return (
    <>
      <div style={{ padding: '12px 14px 0' }}>
        <button class="btn primary" style={{ width: '100%', justifyContent: 'center' }} onClick={add}>
          <Icon name="plus" size={13} /> New collection
        </button>
        <div class="note">Fields, and the items that fill them.</div>
      </div>
      {list.length
        ? <div style={{ padding: '12px 14px' }}>
          {list.map(c => <CollectionRow key={c.id} col={c} />)}
        </div>
        : <div class="empty">No collections yet.<br /><br />
          A <b>Projects</b> collection with a title, a cover and a summary is enough to
          drive a work grid and a page for every project.
        </div>}
    </>
  );
}

/* askConfirm takes HTML, so the one interpolated value has to be escaped by hand —
   the only place in a ported panel where that is true, because everywhere else Preact
   escapes for us. */
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

type Core = import('./ctx').Core;
