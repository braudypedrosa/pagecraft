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
    C.state.ui.pno = 1;                 // a different page starts at its first page of results
    C.selSet([]);
    C.state.ui.mode = 'page';
    L.appRender();
    L.save();
  };

  return (
    <div class={'pagerow' + (i === C.state.cur ? ' on' : '')} onClick={go}>
      <Icon name="page" size={14} />
      <span class="pn">
        <b>{p.name}</b>
        <small>{C.isFront(p) ? 'the front page' : '/' + p.slug}</small>
      </span>
      <span class="act">
        <button title="Move up" disabled={i === 0} onClick={e => act(e, 'up')}>
          <Icon name="caretUp" size={12} /></button>
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
      <div class="note">One file per item, at <b>/{dc.slug}/&lt;slug&gt;</b>
        {C.published(dc).length === dc.items.length ? '' : ` — ${dc.items.length - C.published(dc).length} held back`}.</div>
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

        {/* A slug, not a filename. `.html` is what an HTML export happens to name the file
            and it lives in the note, not in the field — the page's identity is its slug, and
            Preview follows links by slug for the same reason. */}
        {/* through `pageSlugSet`, so every href pointing at the old slug follows. Writing
            `page().slug` directly is what left the review to report the breakage afterwards. */}
        <div class="f"><label>Slug</label>
          {/* on change, not on input. Renaming rewrites every href that pointed at the old
              slug, and `field` commits on every keystroke — which would relink once per letter
              and refuse half of them as taken. The DOM holds the half-typed text; this reads it
              when the field is left, and puts the real slug back if the rename was refused. */}
          <input class="ctl" value={pg.slug} disabled={C.isFront(pg)}
            onChange={e => {
              const el = e.target as HTMLInputElement;
              const at = C.state.cur;
              let moved: number | null = 0;
              C.edit(() => { moved = C.pageSlugSet(at, el.value); });
              if (moved === null) {
                el.value = C.state.pages[at].slug;
                L.toast('That slug is taken by another page');
              } else if (moved) {
                L.toast(`${moved} link${moved === 1 ? '' : 's'} followed it`);
              }
              repaint('pages'); L.renderModebar();
            }} />
          <div class="note">{C.isFront(pg)
              ? <>Fixed at <code>index</code> — a host serves it at the root.</>
              : <>Exports as <code>{pg.slug || '…'}.html</code>.</>}
            {C.isNotFound(pg) ? ' Your not-found page: out of the sitemap, and noindex.' : ''}</div>
          {C.isFront(pg) ? null : (
            <button class="btn" style={{ marginTop: 'var(--gap-1)', width: '100%', justifyContent: 'center' }}
              onClick={async () => {
                const front = C.state.pages.find(C.isFront);
                if (!await L.askConfirm('Make this the front page?',
                  `<b>${C.esc(pg.name)}</b> becomes <code>index.html</code>, which a host serves at the root.`
                  + (front ? ` <b>${C.esc(front.name)}</b> takes a slug from its own name.` : '')
                  + ' Links pointing at either page follow the change.',
                  { ok: 'Make it the front page', danger: false })) return;
                C.edit(() => C.pageFront(C.state.cur));
                L.renderModebar();
                repaint('pages');
                L.toast(pg.name + ' is the front page');
              }}>Make this the front page</button>
          )}</div>

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

        {/* Project settings has the site-wide version. This is the per-page one, which is
            where a page-specific meta tag, a schema block or a one-page script goes — there
            was nowhere for those before, only the project-wide block. */}
        <div class="f"><label>Extra &lt;head&gt; HTML</label>
          <textarea class="ctl" value={pg.headHtml || ''}
            style={{ minHeight: '56px', fontFamily: 'var(--mono)', fontSize: '11.5px' }}
            placeholder="&lt;meta name=&quot;robots&quot; content=&quot;noindex&quot;&gt;"
            {...field(v => { C.page().headHtml = v; })} />
          <div class="note">This page only, after the project's block.</div></div>

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
              ? <div class="note">Becomes a template: one file per item.</div>
              : null}
        </div>
      </div></div>
    </>
  );
}

/* askConfirm takes HTML, so this one value is escaped by hand. */
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
