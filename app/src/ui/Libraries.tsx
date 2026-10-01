/* Libraries, in the Add panel (Phase 5, slice 1c).

   A library belongs to the account rather than to a site: publish components, blocks and styles
   from one site, import them into another as copies that site owns, and take a later version
   only when asked, item by item. The document side is pure (core/libraries.ts) and lands through
   one edit(), so an import or an update is one Undo step and autosaves like any other change.
   The server keeps the numbered versions and copies the images; see
   docs/phase5-libraries-design.md.

   Everything happens inside the panel. A version is a short list and a conflict is one choice
   per item, so neither earns a modal over the canvas the owner is comparing against. */
import { useEffect, useState } from 'preact/hooks';
import {
  extractLibraryBundle, importAssetsNeeded, isFoundation, itemHash, planLibraryImport, planLibraryUpdate,
  previewLibraryUpdate, LibraryError,
  type LibraryBundle, type LibraryItemKind, type LibraryItemRef, type LibraryLink, type Resolution, type UpdateItem,
} from '../core/libraries';
import type { Doc } from '../core/types';
import type { WebLibrary, WebLibraryAdapter, WebLibraryVersionSummary } from '../host/types';
import { C, L } from './ctx';
import { Icon } from './Icon';

/* ---- shared with the Components and Blocks tabs ------------------------ */

/* Library names by id, so a component row can say where it came from without a request. */
const names = new Map<string, string>();
const remember = (library: WebLibrary) => { names.set(library.id, library.name); };

/** This site's link for an item, if it came from a library. */
export const linkOf = (kind: LibraryItemKind, localId: string): LibraryLink | null =>
  (C.state.meta.libraryLinks || []).find(l => l.kind === kind && l.localId === localId) || null;

/** "From Brand kit · v3", for a row in the Components or Blocks tab. */
export const fromLabel = (link: LibraryLink) => `From ${names.get(link.libraryId) || 'a library'} · v${link.version}`;

/* "Add to library…" on a component or block row: the item to tick once a library is chosen. */
let pending: LibraryItemRef | null = null;
export function addToLibrary(ref: LibraryItemRef) {
  pending = ref;
  C.state.ui.atab = 'libraries';
}

/* ---- items ------------------------------------------------------------- */

type Item = { id: string; name?: string };
const GROUPS: [LibraryItemKind, string][] = [
  ['component', 'Components'], ['block', 'Blocks'], ['textStyle', 'Text styles'], ['class', 'Classes'], ['color', 'Colors'],
];
const KIND: Record<LibraryItemKind, string> = {
  component: 'Component', block: 'Block', textStyle: 'Text style', class: 'Class', color: 'Color',
};
const refKey = (ref: { kind: LibraryItemKind; id: string }) => `${ref.kind}:${ref.id}`;
const parseKey = (k: string): LibraryItemRef => {
  const at = k.indexOf(':');
  return { kind: k.slice(0, at) as LibraryItemKind, id: k.slice(at + 1) };
};
const bundleList = (b: LibraryBundle, kind: LibraryItemKind): Item[] =>
  kind === 'component' ? b.components : kind === 'block' ? b.blocks : kind === 'color' ? b.colors
    : kind === 'textStyle' ? b.textStyles : b.classes;
const siteList = (kind: LibraryItemKind): Item[] =>
  kind === 'component' ? C.components() : kind === 'block' ? C.blocks() : kind === 'color' ? C.colors()
    : kind === 'textStyle' ? C.styles() : C.classes();
const siteItem = (kind: LibraryItemKind, id: string) => siteList(kind).find(item => item.id === id) || null;
const nameOf = (item: Item | null | undefined, fallback: string) => (item && item.name) || fallback;
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const linksFor = (libraryId: string) => (C.state.meta.libraryLinks || []).filter(l => l.libraryId === libraryId);
/** The oldest version this site still tracks, when a newer one exists. */
const behind = (library: WebLibrary) => {
  const versions = linksFor(library.id).map(l => l.version);
  const oldest = versions.length ? Math.min(...versions) : 0;
  return oldest && oldest < library.latestVersion ? oldest : 0;
};

/** One sentence for whatever went wrong, from the server's own detail when it gave one. */
function problem(error: unknown) {
  if (error instanceof LibraryError) return error.problems.join(' ');
  const e = error as { status?: number; payload?: { detail?: string; problems?: string[] }; message?: string } | null;
  if (e?.status === 503) return 'Libraries are not available on this server yet.';
  const detail = e?.payload?.detail || (Array.isArray(e?.payload?.problems) ? e!.payload!.problems!.join(' ') : '');
  if (detail) return String(detail);
  const message = String(e?.message || '').trim();
  return message && !/^[a-z][a-z0-9_ -]*$/i.test(message) ? message : 'That did not work. Try again.';
}

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, set] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    set(s => ({ data: s.data, loading: true }));
    load().then(data => { if (live) set({ data, loading: false }); },
      error => { if (live) set({ error: problem(error), loading: false }); });
    return () => { live = false; };
  }, [...deps, nonce]);
  return { ...state, reload: () => setNonce(n => n + 1) };
}

/* Applying a plan: the whole meta at once, in one edit(), computed from the document as it is at
   that moment rather than when the review was drawn. Then the full render cycle, because the
   canvas, the layers and every panel may now show something new. */
function commit(doc: Doc) {
  const meta = doc.meta;
  C.edit(() => { C.state.meta = meta; });
  L.appRender();
}

/* ---- the panel --------------------------------------------------------- */

type View = { at: 'list' } | { at: 'library' | 'publish' | 'update'; id: string };

export function Libraries() {
  const libs = L.libraries();
  const [view, setView] = useState<View>({ at: 'list' });
  if (!libs) return <div class="hint">Libraries are available in the hosted editor, for the site’s owner.</div>;
  const open = (next: View) => setView(next);
  return view.at === 'list' ? <LibraryList libs={libs} open={open} />
    : view.at === 'publish' ? <PublishPick key={view.id} libs={libs} id={view.id} open={open} />
      : view.at === 'update' ? <UpdateReview key={view.id} libs={libs} id={view.id} open={open} />
        : <LibraryDetail key={view.id} libs={libs} id={view.id} open={open} />;
}

type Props = { libs: WebLibraryAdapter; open: (view: View) => void };

function LibraryList({ libs, open }: Props) {
  const list = useLoad(async () => {
    const all = await libs.list();
    all.forEach(remember);
    return all;
  }, []);
  const [busy, setBusy] = useState(false);
  const waiting = pending ? nameOf(siteItem(pending.kind, pending.id), pending.id) : '';

  const create = async () => {
    const name = (await L.askText('New library', 'Name', '', {
      ok: 'Create library',
      note: 'A library belongs to your account. Publish to it from any site you own, and import from it into any other.',
    }) || '').trim();
    if (!name) return;
    setBusy(true);
    try {
      const library = await libs.create(name.slice(0, 80));
      remember(library);
      open({ at: pending ? 'publish' : 'library', id: library.id });
    } catch (error) {
      L.toast(problem(error), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {waiting && (
        <div class="lib-banner" role="status">
          <span>Choose a library for <b>{waiting}</b>, or create one.</span>
          <button type="button" class="btn ghost tiny" onClick={() => { pending = null; list.reload(); }}>Cancel</button>
        </div>
      )}
      {list.error ? (
        <div class="hint lib-problem" role="alert">
          {list.error}{' '}
          <button type="button" class="btn tiny" onClick={list.reload}>Try again</button>
        </div>
      ) : !list.data ? (
        <div class="hint" aria-busy="true">Loading your libraries…</div>
      ) : list.data.length ? list.data.map(library => {
        const old = behind(library);
        const here = linksFor(library.id).length;
        return (
          <button type="button" class="brow lib-row" key={library.id}
            onClick={() => open({ at: pending ? 'publish' : 'library', id: library.id })}>
            <Icon name="library" size={14} />
            <span class="bn">
              <b>{library.name}</b>
              <small>
                {library.latestVersion ? `Version ${library.latestVersion}` : 'Nothing published yet'}
                {old ? ' · Update available' : here ? ' · In this site' : ''}
              </small>
            </span>
            <Icon name="arrow" size={12} />
          </button>
        );
      }) : (
        <div class="hint">
          No libraries yet. A library keeps components, blocks and styles that you can import into any
          site you own, and update there when you choose.
        </div>
      )}
      <button type="button" class="btn block" disabled={busy}
        style={{ marginTop: 'var(--gap-1)', fontSize: 'var(--fs-2)' }} onClick={create}>
        <Icon name="plus" size={12} /> New library
      </button>
    </>
  );
}

function Head({ library, back, sub }: { library?: WebLibrary; back: () => void; sub?: string }) {
  return (
    <div class="lib-head">
      <button type="button" class="bx lib-back" title="Back" aria-label="Back" onClick={back}>
        <Icon name="arrow" size={12} cls="lib-back-icon" />
      </button>
      <span class="bn">
        <b>{library ? library.name : 'Library'}</b>
        {sub && <small>{sub}</small>}
      </span>
    </div>
  );
}

/* Both views below need the library and, when it has one, its latest version. */
function useLibrary(libs: WebLibraryAdapter, id: string) {
  return useLoad(async () => {
    const { library, versions } = await libs.get(id);
    remember(library);
    const latest = library.latestVersion ? await libs.version(id, library.latestVersion) : null;
    return { library, versions, bundle: latest ? latest.bundle : null, summary: latest ? latest.version : null };
  }, [id]);
}

function Loading({ state, back }: { state: { error?: string }; back: () => void }) {
  return (
    <>
      <Head back={back} />
      {state.error
        ? <div class="hint lib-problem" role="alert">{state.error}</div>
        : <div class="hint" aria-busy="true">Loading…</div>}
    </>
  );
}

function LibraryDetail({ libs, id, open }: Props & { id: string }) {
  const state = useLibrary(libs, id);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const back = () => open({ at: 'list' });
  if (!state.data) return <Loading state={state} back={back} />;
  const { library, bundle, summary } = state.data;
  const site = L.siteDraft();
  const fromHere = !!(summary && site && summary.sourceSiteId === site.siteId);
  const links = linksFor(id);
  const old = behind(library);

  const status = (ref: LibraryItemRef) => {
    const link = links.find(l => l.kind === ref.kind && l.sourceId === ref.id);
    const local = link ? siteItem(link.kind, link.localId) : null;
    if (link && local) return itemHash(link.kind, local) === link.localHash ? `In this site · v${link.version}` : `In this site · v${link.version} · changed here`;
    if (fromHere) return 'Published from this site';
    return '';
  };
  const toggle = (k: string, on: boolean) => setPicked(prev => {
    const next = new Set(prev);
    if (on) next.add(k); else next.delete(k);
    return next;
  });

  const importPicked = async () => {
    if (!bundle || !summary || !picked.size) return;
    const chosen = [...picked].map(parseKey);
    const source = { libraryId: id, version: summary.version };
    setBusy(true);
    try {
      const needed = importAssetsNeeded(bundle, chosen);
      const assets = needed.length ? await libs.copyAssets({ libraryId: id, version: summary.version, assets: needed }) : {};
      if (needed.length) await L.assetsReload();
      const plan = planLibraryImport(C.doc(), bundle, source, chosen, { assets, newId: C.uid });
      commit(plan.doc);
      setPicked(new Set());
      const added = plan.items.filter(i => i.how === 'added' || i.how === 'renamed').length;
      const renamed = plan.items.filter(i => i.how === 'renamed').length;
      L.toast(added
        ? `Imported ${plural(added, 'item')} from ${library.name}` + (renamed ? ` · ${plural(renamed, 'was', 'were')} renamed to avoid a clash` : '')
        : `Already in this site — now linked to ${library.name}`);
    } catch (error) {
      L.toast(problem(error), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head library={library} back={back}
        sub={summary && bundle ? `Version ${summary.version} · ${plural(bundle.chosen.length, 'item')}` : 'Nothing published yet'} />
      {old > 0 && (
        <div class="lib-banner" role="status">
          <span><b>Version {library.latestVersion} is available.</b> This site has version {old}.</span>
          <button type="button" class="btn tiny primary" onClick={() => open({ at: 'update', id })}>Review update</button>
        </div>
      )}
      {bundle ? (
        <>
          {GROUPS.map(([kind, label]) => {
            const chosen = bundle.chosen.filter(ref => ref.kind === kind);
            if (!chosen.length) return null;
            return (
              <div key={kind}>
                <div class="plabel">{label}</div>
                {chosen.map(ref => {
                  const k = refKey(ref);
                  const note = status(ref);
                  const item = bundleList(bundle, kind).find(i => i.id === ref.id);
                  return (
                    <label class={'lib-item' + (note ? ' off' : '')} key={k}>
                      <input type="checkbox" disabled={!!note || busy} checked={picked.has(k)}
                        onChange={e => toggle(k, (e.currentTarget as HTMLInputElement).checked)} />
                      <span class="bn">
                        <b>{nameOf(item, ref.id)}</b>
                        <small>{note || KIND[kind]}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            );
          })}
          {bundle.chosen.some(ref => !status(ref)) ? (
            <>
              <button type="button" class="btn primary block" disabled={!picked.size || busy}
                style={{ marginTop: 'var(--gap-1)' }} onClick={importPicked}>
                {busy ? 'Importing…' : picked.size ? `Import ${plural(picked.size, 'item')}` : 'Choose items to import'}
              </button>
              <p class="lib-note">
                Imported items become this site’s own. Whatever they use — nested components, styles,
                colors and images — comes with them.
              </p>
            </>
          ) : (
            <p class="lib-note">Everything in this version is already in this site.</p>
          )}
        </>
      ) : (
        <p class="lib-note">Publish components, blocks or styles from this site to make version 1.</p>
      )}
      <button type="button" class="btn block" disabled={busy} style={{ fontSize: 'var(--fs-2)' }}
        onClick={() => open({ at: 'publish', id })}>
        <Icon name="plus" size={12} /> Publish a new version…
      </button>
    </>
  );
}

function PublishPick({ libs, id, open }: Props & { id: string }) {
  const state = useLibrary(libs, id);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const back = () => { pending = null; open({ at: 'library', id }); };

  /* Start from what the library holds now when it came from this site, plus the item that sent
     the owner here, so publishing a change is one click rather than re-ticking everything. */
  useEffect(() => {
    if (!state.data || picked) return;
    const site = L.siteDraft();
    const start = new Set<string>();
    const { bundle, summary } = state.data;
    if (bundle && summary && site && summary.sourceSiteId === site.siteId) {
      bundle.chosen.filter(ref => siteItem(ref.kind, ref.id)).forEach(ref => start.add(refKey(ref)));
    }
    if (pending && siteItem(pending.kind, pending.id)) start.add(refKey(pending));
    setPicked(start);
  }, [state.data]);

  if (!state.data || !picked) return <Loading state={state} back={back} />;
  const { library } = state.data;
  const next = library.latestVersion + 1;
  const chosen = [...picked].map(parseKey).filter(ref => siteItem(ref.kind, ref.id));

  // The same extraction the server runs, so a CMS-bound item is explained before the request.
  let problems: string[] = [];
  let carried = 0;
  if (chosen.length) {
    try {
      const preview = extractLibraryBundle(C.doc(), chosen, C.SCHEMA);
      // Foundation tokens never travel: every site has its own, so they are not counted.
      carried = GROUPS.reduce((n, [kind]) => n + bundleList(preview, kind).filter(item => !isFoundation(kind, item.id)).length, 0)
        - chosen.length;
    } catch (error) {
      problems = error instanceof LibraryError ? error.problems : [problem(error)];
    }
  }
  const toggle = (k: string, on: boolean) => setPicked(prev => {
    const nextSet = new Set(prev);
    if (on) nextSet.add(k); else nextSet.delete(k);
    return nextSet;
  });

  const publish = async () => {
    if (!chosen.length || problems.length) return;
    setBusy(true);
    try {
      await L.flushDraft();
      const send = () => libs.publish(id, { sourceVersion: L.siteDraft()!.version, items: chosen });
      let version: WebLibraryVersionSummary;
      try {
        version = await send();
      } catch (error) {
        // An autosave landed between the flush and the request: flush again and retry once.
        if ((error as { status?: number })?.status !== 409) throw error;
        await L.flushDraft();
        version = await send();
      }
      pending = null;
      L.toast(`Published version ${version.version} of ${library.name}`);
      open({ at: 'library', id });
    } catch (error) {
      L.toast(problem(error), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head library={library} back={back} sub={`Publish version ${next}`} />
      <p class="lib-note">
        Version {next} holds exactly what you tick, and whatever that uses. Sites that imported something
        you leave out keep their copy.
      </p>
      {GROUPS.map(([kind, label]) => {
        const items = siteList(kind).filter(item => !isFoundation(kind, item.id));
        if (!items.length) return null;
        return (
          <div key={kind}>
            <div class="plabel">{label}</div>
            {items.map(item => {
              const k = refKey({ kind, id: item.id });
              const link = linkOf(kind, item.id);
              return (
                <label class="lib-item" key={k}>
                  <input type="checkbox" disabled={busy} checked={picked.has(k)}
                    onChange={e => toggle(k, (e.currentTarget as HTMLInputElement).checked)} />
                  <span class="bn">
                    <b>{nameOf(item, item.id)}</b>
                    <small>{link ? fromLabel(link) : KIND[kind]}</small>
                  </span>
                </label>
              );
            })}
          </div>
        );
      })}
      {problems.length > 0 && (
        <div class="lib-problem" role="alert">
          {problems.map(p => <p key={p}>{p}</p>)}
        </div>
      )}
      <button type="button" class="btn primary block" disabled={!chosen.length || !!problems.length || busy}
        style={{ marginTop: 'var(--gap-1)' }} onClick={publish}>
        {busy ? 'Publishing…' : chosen.length ? `Publish version ${next}` : 'Choose items to publish'}
      </button>
      {chosen.length > 0 && !problems.length && (
        <p class="lib-note">
          {plural(chosen.length, 'item')}{carried > 0 ? `, plus ${plural(carried, 'thing')} they use` : ''}. The
          draft is saved first, so the library gets exactly what you see.
        </p>
      )}
    </>
  );
}

const CHANGE: Record<string, string> = {
  'changed-upstream': 'Updated in the library',
  'changed-both': 'Changed here and in the library',
  'upstream-removed': 'No longer in the library — your copy stays',
  'deleted-here': 'Deleted here — it stops tracking the library',
};

function UpdateReview({ libs, id, open }: Props & { id: string }) {
  const state = useLibrary(libs, id);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [busy, setBusy] = useState(false);
  const back = () => open({ at: 'library', id });
  if (!state.data) return <Loading state={state} back={back} />;
  const { library, bundle, summary } = state.data;
  if (!bundle || !summary) return <Loading state={{ error: 'This library has no version to update to.' }} back={back} />;
  const source = { libraryId: id, version: summary.version };
  const preview = previewLibraryUpdate(C.doc(), bundle, source, resolutions);
  const changes = preview.items.filter(item => item.action !== 'none');
  const same = preview.items.length - changes.length;
  const label = (item: UpdateItem) => nameOf(siteItem(item.kind, item.localId) || bundleList(bundle, item.kind).find(i => i.id === item.sourceId), item.localId);
  const resolve = (item: UpdateItem, choice: Resolution) => setResolutions(prev => ({ ...prev, [refKey({ kind: item.kind, id: item.sourceId })]: choice }));

  const apply = async () => {
    setBusy(true);
    try {
      const needed = previewLibraryUpdate(C.doc(), bundle, source, resolutions).assets;
      const assets = needed.length ? await libs.copyAssets({ libraryId: id, version: summary.version, assets: needed }) : {};
      if (needed.length) await L.assetsReload();
      const plan = planLibraryUpdate(C.doc(), bundle, source, resolutions, { assets, newId: C.uid });
      if (!plan.doc) {
        L.toast('Something here changed while the update was prepared. Review it again.', { tone: 'error' });
        return;
      }
      commit(plan.doc);
      L.toast(`Updated to version ${summary.version} of ${library.name}`);
      open({ at: 'library', id });
    } catch (error) {
      L.toast(problem(error), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head library={library} back={back} sub={`Update to version ${summary.version}`} />
      {changes.length ? changes.map(item => {
        const k = refKey({ kind: item.kind, id: item.sourceId });
        const choice = resolutions[k];
        const showWarnings = item.action === 'update' || (item.action === 'conflict' && choice === 'theirs');
        return (
          <div class="lib-change" key={k}>
            <b>{label(item)}</b>
            <small>{KIND[item.kind]} · {CHANGE[item.reason] || item.reason}</small>
            {item.action === 'conflict' && (
              <div class="lib-res" role="radiogroup" aria-label={`${label(item)}: which version to keep`}>
                <label>
                  <input type="radio" name={'lib-' + k} checked={choice === 'mine'} disabled={busy}
                    onChange={() => resolve(item, 'mine')} /> Keep mine
                </label>
                <label>
                  <input type="radio" name={'lib-' + k} checked={choice === 'theirs'} disabled={busy}
                    onChange={() => resolve(item, 'theirs')} /> Use the library’s
                </label>
              </div>
            )}
            {showWarnings && item.warnings.map(w => <p class="lib-warn" key={w}>{w}</p>)}
          </div>
        );
      }) : (
        <p class="lib-note">Nothing this site uses changed in version {summary.version}.</p>
      )}
      {same > 0 && changes.length > 0 && <p class="lib-note">{plural(same, 'other item is', 'other items are')} unchanged.</p>}
      <button type="button" class="btn primary block" disabled={!!preview.unresolved.length || busy}
        style={{ marginTop: 'var(--gap-1)' }} onClick={apply}>
        {busy ? 'Updating…' : preview.unresolved.length
          ? `Choose for ${plural(preview.unresolved.length, 'conflict')}`
          : changes.length ? 'Apply update' : `Mark version ${summary.version} as seen`}
      </button>
      <p class="lib-note">
        What each placement shows — its text, variant and slot content — is kept. Undo reverses the whole update.
      </p>
    </>
  );
}
