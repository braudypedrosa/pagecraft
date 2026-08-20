/* Pages and their SEO.

   The share image was the awkward part: it used to be the legacy asset field, filling
   its own div with innerHTML, which Preact cannot share a container with. It is a
   component now — see AssetField.tsx — so the bridge that stood here is gone.

   The text fields deliberately do *not* repaint as you type. The original wired `input`
   to update-and-save and `change` to re-render, because repainting on every keystroke
   loses the caret. Same split here — which is also why they are uncontrolled: nothing
   re-renders mid-typing, so nothing fights the DOM value. */
import { C, L, repaint } from './ctx';
import { Icon } from './Icon';
import { AssetField } from './AssetField';

function PageRow({ i }: { i: number }) {
  const p = C.state.pages[i];
  const last = i === C.state.pages.length - 1;

  const act = async (e: MouseEvent, name: string) => {
    e.stopPropagation();
    if (name === 'up' || name === 'down') { C.edit(() => C.pageMove(i, name === 'up' ? -1 : 1)); return; }
    if (name === 'dup') { C.edit(() => C.pageDup(i)); return; }
    const ok = await L.askConfirm('Delete this page?',
      `<b>${esc(C.state.pages[i].name)}</b> and everything on it. ⌘Z will bring it back `
      + 'until you reload.', { ok: 'Delete page' });
    if (ok) C.edit(() => C.pageDelete(i));
  };

  const go = () => {
    if (i === C.state.cur) return;
    C.state.cur = i;
    C.selSet([]);
    C.state.ui.mode = 'page';
    L.appRender();
    L.save();
  };

  return (
    <div class={'pagerow' + (i === C.state.cur ? ' on' : '')} onClick={go}>
      <Icon name="page" size={14} />
      <span class="pn"><b>{p.name}</b><small>/{p.slug}.html</small></span>
      <span class="act">
        <button title="Move up" disabled={i === 0} onClick={e => act(e, 'up')}>
          <Icon name="caret" size={12} /></button>
        <button title="Move down" disabled={last} onClick={e => act(e, 'down')}>
          <Icon name="caret" size={12} /></button>
        <button title="Duplicate page" onClick={e => act(e, 'dup')}>
          <Icon name="copy" size={12} /></button>
        {C.state.pages.length > 1 && (
          <button title="Delete page" onClick={e => act(e, 'del')}>
            <Icon name="trash" size={12} /></button>
        )}
      </span>
    </div>
  );
}

/** A detail template's two binding selects, plus what it will export. */
function DetailBindings({ colId }: { colId: string }) {
  const dc = C.findCollection(colId);
  if (!dc) return null;
  const pg = C.page();
  const bind = (key: 'bindTitle' | 'bindDesc', v: string) =>
    C.edit(() => { if (v) pg[key] = v; else delete pg[key]; });

  const pick = (key: 'bindTitle' | 'bindDesc', label: string, blank: string) => (
    <div class="f" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      <select class="ctl" value={pg[key] || ''}
        onChange={e => bind(key, (e.target as HTMLSelectElement).value)}>
        <option value="">{blank}</option>
        {dc.fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </div>
  );

  return (
    <>
      <div class="row2" style={{ marginTop: 'var(--gap-1)' }}>
        {pick('bindTitle', 'Title from', '— The page title —')}
        {pick('bindDesc', 'Description from', '— The page description —')}
      </div>
      <div class="note">
        Exports <b>{dc.slug}/&lt;slug&gt;.html</b> — {dc.items.length} file
        {dc.items.length === 1 ? '' : 's'} from this one page. Everything on it binds
        to <b>{dc.name}</b>.
      </div>
    </>
  );
}

export function Pages() {
  const pg = C.page();
  const cols = C.collections();

  /* input updates and saves; change repaints. Splitting them is what keeps the caret
     where it was — see the note at the top of this file. */
  const field = (set: (v: string) => void, after?: () => void) => ({
    onInput: (e: Event) => { set((e.target as HTMLInputElement).value); L.save(); },
    onChange: () => { repaint('pages'); (after || L.renderModebar)(); }
  });

  const setCollection = (v: string) => {
    C.edit(() => {
      if (v) pg.collection = v;
      else { delete pg.collection; delete pg.bindTitle; delete pg.bindDesc; }
    });
    L.toast(v ? 'Template for ' + C.findCollection(v)!.name : 'Back to an ordinary page');
  };

  return (
    <>
      <div class="pagelist">
        {C.state.pages.map((p, i) => <PageRow key={p.id} i={i} />)}
        <button class="btn" style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => L.newPageModal()}>
          <Icon name="plus" size={13} /> New page
        </button>
      </div>

      <div class="group"><div class="gh">Current page</div><div class="gb">
        <div class="f"><label>Page name</label>
          <input class="ctl" value={pg.name}
            {...field(v => { C.page().name = v; L.renderModebar(); })} /></div>

        <div class="f"><label>File slug</label>
          <div class="unit">
            <input class="ctl" value={pg.slug} {...field(v => { C.page().slug = C.slugify(v); })} />
            <span style={{ alignSelf: 'center', color: 'var(--text-3)', fontSize: '11px' }}>.html</span>
          </div></div>

        <div class="f"><label>Browser title</label>
          <input class="ctl" value={pg.title || ''} placeholder={pg.name}
            {...field(v => { C.page().title = v; })} /></div>

        <div class="f"><label>Meta description</label>
          <textarea class="ctl" value={pg.desc || ''}
            style={{ minHeight: '56px', fontFamily: 'var(--sans)', fontSize: '12.5px' }}
            {...field(v => { C.page().desc = v; })} /></div>

        <div class="f"><label>Social share image</label>
          <AssetField value={pg.ogImage} note="Falls back to the project image when empty."
            onChange={v => { C.page().ogImage = v; repaint('pages'); }} /></div>

        <div class="f">
          <label>Detail template <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>
            — one page per item</span></label>
          <select class="ctl" value={pg.collection || ''}
            onChange={e => setCollection((e.target as HTMLSelectElement).value)}>
            <option value="">— An ordinary page —</option>
            {cols.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.items.length} item{c.items.length === 1 ? '' : 's'}
              </option>
            ))}
          </select>
          {pg.collection && C.findCollection(pg.collection)
            ? <DetailBindings colId={pg.collection} />
            : cols.length
              ? <div class="note">Point this at a collection and the page becomes a
                template: one static file per item.</div>
              : null}
        </div>
      </div></div>
    </>
  );
}

/* askConfirm takes HTML, so this one value is escaped by hand. */
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
