/* The Content panel, ported.
   Second across, and chosen the same way as the first: `#paneCms` has exactly one
   writer, so Preact can own it outright.

   This one adds the dialogs to the seam. They are promise-returning and resolve falsy
   on cancel rather than rejecting, so every handler here reads the result instead of
   catching — which is what the original did too. */
import { C, L } from './ctx';
import { Icon } from './Icon';
import { useRef, useState } from 'preact/hooks';
import { installActionFeedback } from '../../../shared/action-feedback.js';

function CollectionRow({ col }: { col: ReturnType<Core['collections']>[number] }) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const n = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`;

  const remove = async (e: MouseEvent) => {
    e.stopPropagation();
    if (pending.current) return;
    const ok = await L.askConfirm('Delete this collection?',
      `<b>${esc(col.name)}</b> and its ${n(col.items.length, 'item')}. Anything bound to its `
      + 'fields falls back to placeholder text.', { ok: 'Delete collection' });
    if (!ok) return;
    if (L.dynamicContentProvider() !== 'pagecraft') { C.edit(() => C.collectionDelete(col.id)); return; }
    pending.current = true; setBusy(true);
    const feedback = installActionFeedback().notify('Deleting collection…', {tone:'progress'});
    try { await L.cmsCommit(C.collections().filter(c => c.id !== col.id)); feedback.success('Collection deleted from the site draft.'); }
    catch (error) { feedback.error(error instanceof Error ? error.message : 'Collection could not be deleted. Try again.'); }
    finally { pending.current = false; setBusy(false); }
  };

  return (
    <div class="brow">
      <button type="button" class="brow-main" disabled={busy} title={'Edit ' + col.name}
        onClick={() => L.cmsModal(col.id)}>
        <Icon name="page" size={14} />
        <span class="bn">
          <b>{col.name}</b>
          <small>{n(col.fields.length, 'field')} · {n(col.items.length, 'item')}</small>
        </span>
      </button>
      {/* Deleting a collection takes its items with it. That is not a content edit however
          much of the content it removes, and the server refuses it. */}
      {L.canStructure() ? (
        <button type="button" class="bx danger" disabled={busy} aria-busy={busy} title={busy ? 'Deleting collection…' : 'Delete this collection'} onClick={remove}>
          <Icon name="trash" size={11} />
        </button>
      ) : null}
    </div>
  );
}

export function Cms() {
  const list = C.collections();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (pending.current) return;
    const name = await L.askText('New collection', 'Name', 'Projects',
      { ok: 'Create', note: 'Plural reads best — Projects, Posts, Team.' });
    if (!name) return;
    if (L.dynamicContentProvider() !== 'pagecraft') {
      let made: { id:string } | null = null;
      C.edit(() => { made = C.collectionAdd(name); });
      if (made) L.cmsModal((made as {id:string}).id);
      return;
    }
    const id = C.uniqueId(name, C.collections().map(c => c.id));
    pending.current = true; setBusy(true);
    const feedback = installActionFeedback().notify('Creating collection…', {tone:'progress'});
    try {
      await L.cmsCommit([...C.collections(), {id,name,slug:id,detail:'',fields:[{id:'title',name:'Title',type:'text',required:1}],items:[]}]);
      L.cmsModal(id);
      feedback.success('Collection created. Add its fields and entries in CMS.');
    } catch (error) { feedback.error(error instanceof Error ? error.message : 'Collection could not be created. Try again.'); }
    finally { pending.current = false; setBusy(false); }

  };

  return (
    <>
      {/* A collection is a shape — fields, and what a detail page is built from. Filling one
          is content; declaring one is not. So a content account edits the items inside and is
          not offered a new collection. */}
      {L.canStructure() ? (
        <div style={{ padding: '12px 14px 0' }}>
          <button class="btn primary block" disabled={busy} aria-busy={busy} data-pc-pending={busy ? '' : undefined} onClick={add}>
            {!busy && <Icon name="plus" size={13} />} {busy ? 'Creating…' : 'New collection'}
          </button>
          <div class="note">Fields, and the items that fill them.</div>
        </div>
      ) : null}
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
