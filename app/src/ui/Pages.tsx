/* Pages and their SEO.

   The share image was the awkward part: it used to be the legacy asset field, filling
   its own div with innerHTML, which Preact cannot share a container with. It is a
   component now — see AssetField.tsx — so the bridge that stood here is gone.

   The text fields deliberately do *not* repaint as you type. The original wired `input`
   to update-and-save and `change` to re-render, because repainting on every keystroke
   loses the caret. Same split here — which is also why they are uncontrolled: nothing
   re-renders mid-typing, so nothing fights the DOM value. */
import { useState } from 'preact/hooks';
import { C, L, repaint } from './ctx';
import { Icon } from './Icon';
import { AssetField } from './AssetField';

function PageRow({ i }: { i: number }) {
  const p = C.state.pages[i];
  const last = i === C.state.pages.length - 1;
  const collection = p.collection ? C.findCollection(p.collection) : null;

  const act = async (e: MouseEvent, name: string) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).closest('details')?.removeAttribute('open');
    if (name === 'up' || name === 'down') { C.edit(() => C.pageMove(i, name === 'up' ? -1 : 1)); L.toast('Page moved ' + name + '.'); return; }
    if (name === 'dup') { C.edit(() => C.pageDup(i)); L.toast('Page duplicated.'); return; }
    const ok = await L.askConfirm('Delete this page?',
      `<b>${esc(C.state.pages[i].name)}</b> and everything on it. ⌘Z will bring it back `
      + 'until you reload.', { ok: 'Delete page' });
    if (ok) { C.edit(() => C.pageDelete(i)); L.toast('Page deleted. Undo restores it.'); }
  };

  const go = () => L.openPage(i);

  return (
    <div class={'pagerow' + (i === C.state.cur ? ' on' : '')}>
      <button type="button" class="pagerow-main" aria-current={i === C.state.cur ? 'page' : undefined}
        onClick={go}>
        <Icon name="page" size={14} />
        <span class="pn">
          <b>{p.name}</b>
          {C.isFront(p) && <small>Front page</small>}
          {collection && <span class="cms-page-badge" title={'Connected to CMS collection: ' + collection.name}>
            <Icon name="cms" size={11} /> CMS · {collection.name}
          </span>}
        </span>
      </button>
      <span class="page-path">{C.isFront(p) ? '/' : '/' + p.slug}</span>
      <span class="page-kind">{collection ? 'CMS template' : C.isFront(p) ? 'Front page' : C.isNotFound(p) ? 'Not found' : 'Page'}</span>
      <button class="btn tiny" onClick={() => L.openPage(i, true)} aria-label={'Page settings and SEO for ' + p.name}>Settings &amp; SEO</button>
      {L.canStructure() && <details class="page-actions"
        onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) e.currentTarget.removeAttribute('open'); }}
        onKeyDown={e => {
          if (e.key !== 'Escape') return;
          e.preventDefault(); e.stopPropagation();
          e.currentTarget.removeAttribute('open');
          e.currentTarget.querySelector('summary')?.focus();
        }}>
        <summary aria-label={'Actions for ' + p.name} title={'Actions for ' + p.name}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="8" r="1" /><circle cx="8" cy="8" r="1" /><circle cx="13" cy="8" r="1" />
          </svg>
        </summary>
      <span class="act">
        <button type="button" title="Move up" disabled={i === 0} onClick={e => act(e, 'up')}>
          <Icon name="caretUp" size={12} /> Move up</button>
        <button type="button" title="Move down" disabled={last} onClick={e => act(e, 'down')}>
          <Icon name="caret" size={12} /> Move down</button>
        <button type="button" title="Duplicate page" onClick={e => act(e, 'dup')}>
          <Icon name="copy" size={12} /> Duplicate</button>
        {C.state.pages.length > 1 && (
          <button type="button" title="Delete page" onClick={e => act(e, 'del')}>
            <Icon name="trash" size={12} /> Delete</button>
        )}
      </span>
      </details>}
    </div>
  );
}

/** Site navigation and page management, kept separate from the current page's metadata. */
export function PagesWorkspace() {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const rows = C.state.pages.map((p, i) => ({p, i})).filter(({p}) =>
    !term || (p.name + ' ' + p.slug).toLowerCase().includes(term));
  return <section class="pages-workspace" aria-label="Pages">
    <header class="pages-workspace-head">
      <div><h1>Pages</h1><p>{C.state.pages.length} {C.state.pages.length === 1 ? 'page' : 'pages'}</p></div>
      <div class="row">
        <button class="btn" onClick={() => L.openPage(C.state.cur)}>Back to builder</button>
        {L.canStructure() && <button class="btn primary" onClick={() => L.newPageModal()}><Icon name="plus" size={14} /> New page</button>}
      </div>
    </header>
    <div class="pages-workspace-content">
      <div class="pages-search"><label htmlFor="pages-search">Search pages</label>
        <input class="ctl" type="search" id="pages-search" placeholder="Search by name or path" value={query}
          onInput={e => setQuery((e.target as HTMLInputElement).value)} /></div>
      <div class="pages-list-head" aria-hidden="true"><span>Page</span><span>Path</span><span>Type</span><span>Actions</span></div>
      <div class="pagelist" aria-label="Site pages">
        {rows.map(({p, i}) => <PageRow key={p.id} i={i} />)}
        {!rows.length && <div class="pages-empty"><p>No pages match “{query}”.</p><button class="btn" onClick={() => setQuery('')}>Clear search</button></div>}
      </div>
    </div>
  </section>;
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
      <label htmlFor={'page-' + key}>{label}</label>
      <select class="ctl" id={'page-' + key} value={pg[key] || ''}
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
  const field = (key: string, set: (v: string) => void, after?: () => void) => ({
    onInput: (e: Event) => {
      L.tx(`page:${pg.id}:${key}`);
      set((e.target as HTMLInputElement).value);
      L.save();
    },
    onBlur: () => {
      L.endTx();
      repaint('pages');
      after?.();
    }
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
      <div class="page-settings-context">
        <button class="btn block" onClick={() => L.openPages()}><Icon name="page" size={13} /> Manage pages</button>
      </div>

      <div class="group"><div class="gb">
        {/* Of everything a page holds, two things are words somebody writes: the browser
            title and the meta description. A name and a slug are how the site is addressed,
            the head block is a way to run anything, and a detail template is structure. So a
            content account gets the two, in the order they matter, and none of the rest. */}
        {!L.canStructure() ? (
          <>
            <div class="f"><label htmlFor="page-slug">Slug</label>
              <input class="ctl" id="page-slug" value={C.isFront(pg) ? '/' : pg.slug} readOnly />
            </div>
            <div class="f"><label htmlFor="page-title">Browser title</label>
              <input class="ctl" id="page-title" value={pg.title || ''} placeholder={pg.name}
                {...field('title', v => { C.page().title = v; })} /></div>
            <div class="f"><label htmlFor="page-desc">Meta description</label>
              <textarea class="ctl" id="page-desc" value={pg.desc || ''}
                style={{ minHeight: '56px', fontFamily: 'var(--sans)', fontSize: 'var(--fs-2)' }}
                {...field('desc', v => { C.page().desc = v; })} /></div>
          </>
        ) : <>
        <div class="f"><label htmlFor="page-name">Page name</label>
          <input class="ctl" id="page-name" value={pg.name}
            {...field('name', v => { C.page().name = v; L.renderModebar(); })} /></div>

        {/* A slug, not a filename. `.html` is what an HTML export happens to name the file
            and it lives in the note, not in the field — the page's identity is its slug, and
            Preview follows links by slug for the same reason. */}
        {/* through `pageSlugSet`, so every href pointing at the old slug follows. Writing
            `page().slug` directly is what left the review to report the breakage afterwards. */}
        <div class="f"><label htmlFor="page-slug">Slug</label>
          {/* on change, not on input. Renaming rewrites every href that pointed at the old
              slug, and `field` commits on every keystroke — which would relink once per letter
              and refuse half of them as taken. The DOM holds the half-typed text; this reads it
              when the field is left, and puts the real slug back if the rename was refused. */}
          <input class="ctl" id="page-slug" value={pg.slug} disabled={C.isFront(pg)}
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
              : <>Published at <code>/{pg.slug || '…'}</code>.</>}
            {C.isNotFound(pg) ? ' Your not-found page: out of the sitemap, and noindex.' : ''}</div>
          {C.isFront(pg) ? null : (
            <button class="btn block" style={{ marginTop: 'var(--gap-1)' }}
              onClick={async () => {
                const front = C.state.pages.find(C.isFront);
                if (!await L.askConfirm('Make this the front page?',
                  `<b>${C.esc(pg.name)}</b> becomes the front page at <code>/</code>.`
                  + (front ? ` <b>${C.esc(front.name)}</b> takes a slug from its own name.` : '')
                  + ' Links pointing at either page follow the change.',
                  { ok: 'Make it the front page', danger: false })) return;
                C.edit(() => C.pageFront(C.state.cur));
                L.renderModebar();
                repaint('pages');
                L.toast(pg.name + ' is the front page');
              }}>Make this the front page</button>
          )}</div>

        <div class="f"><label htmlFor="page-title">Browser title</label>
          <input class="ctl" id="page-title" value={pg.title || ''} placeholder={pg.name}
            {...field('title', v => { C.page().title = v; })} /></div>

        <div class="f"><label htmlFor="page-desc">Meta description</label>
          <textarea class="ctl" id="page-desc" value={pg.desc || ''}
            style={{ minHeight: '56px', fontFamily: 'var(--sans)', fontSize: 'var(--fs-2)' }}
            {...field('desc', v => { C.page().desc = v; })} /></div>

        <div class="f"><label>Social share image</label>
          <AssetField value={pg.ogImage} note="Falls back to the project image when empty."
            onChange={v => { C.edit(() => { C.page().ogImage = v; }); repaint('pages'); }} /></div>

        {/* Project settings has the site-wide version. This is the per-page one, which is
            where a page-specific meta tag, a schema block or a one-page script goes — there
            was nowhere for those before, only the project-wide block. */}
        <div class="f"><label htmlFor="page-head-html">Extra &lt;head&gt; HTML</label>
          <textarea class="ctl" id="page-head-html" value={pg.headHtml || ''}
            style={{ minHeight: '56px', fontFamily: 'var(--mono)', fontSize: 'var(--fs-1)' }}
            placeholder="&lt;meta name=&quot;robots&quot; content=&quot;noindex&quot;&gt;"
            {...field('headHtml', v => { C.page().headHtml = v; })} />
          <div class="note">This page only, after the project's block.</div></div>

        <div class="f">
          <label htmlFor="page-collection">Detail template <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>
            — one page per item</span></label>
          <select class="ctl" id="page-collection" value={pg.collection || ''}
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
        </>}
      </div></div>
    </>
  );
}

/* askConfirm takes HTML, so this one value is escaped by hand. */
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
