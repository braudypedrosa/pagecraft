/* The control kinds, one component each.

   Each one is markup and its handlers together. That is the whole point of the port:
   builder.html had `ctlHtml` returning strings and `bindRight` finding those strings
   again by `[data-x="…"]` to attach behaviour, and the two could drift — which is why
   build.mjs carries a guard asserting every `ctlHtml` case has a `bindRight` case. A
   component cannot be half-wired. */
import { C, L, repaint } from '../ctx';
import { Icon } from '../Icon';
import { Field } from './Field';
import { valueOf, bound, writer } from './ctl';
import { ItemsCtl, FieldsCtl, QaCtl, ImgsCtl } from './Lists';
import type { Control, Node as PcNode } from '../../core/types';

type P = { n: PcNode; c: Control };

/* The Advanced tab's three pseudo-props live on `adv`, not on `props`. The old code
   rendered an empty input and then overwrote `el.value` in a loop after binding; there
   is no reason a component cannot just read the right place. */
const ADV: Record<string, 'htmlId' | 'cls' | 'css'> = { _id: 'htmlId', _cls: 'cls', _css: 'css' };
const shown = (n: PcNode, c: Control) => {
  const k = c.k && ADV[c.k];
  if (k) return n.adv[k] || '';
  const v = valueOf(n, c);
  return v == null ? '' : String(v);
};
const inert = (n: PcNode, c: Control) => !!bound(n, c).fid;

function TextCtl({ n, c }: P) {
  const w = writer(n, c);
  return <Field n={n} c={c}>
    <input class="ctl" value={shown(n, c)} placeholder={c.ph || ''} disabled={inert(n, c)}
      onInput={e => w.live((e.target as HTMLInputElement).value)} onBlur={w.done} />
  </Field>;
}

function AreaCtl({ n, c }: P) {
  const w = writer(n, c);
  return <Field n={n} c={c}>
    <textarea class="ctl" rows={c.rows || 3} placeholder={c.ph || undefined} disabled={inert(n, c)}
      value={shown(n, c)}
      style={{
        fontFamily: c.mono ? 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace' : 'var(--sans)',
        fontSize: '12px', minHeight: '52px', lineHeight: 1.5
      }}
      onInput={e => w.live((e.target as HTMLTextAreaElement).value)} onBlur={w.done} />
  </Field>;
}

function SelectCtl({ n, c }: P) {
  const w = writer(n, c);
  const opts = typeof c.opts === 'function' ? c.opts(n) : (c.opts || []);
  return <Field n={n} c={c}>
    <select class="ctl" value={String(shown(n, c))} disabled={inert(n, c)}
      onChange={e => w.hard((e.target as HTMLSelectElement).value)}>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  </Field>;
}

function UnitCtl({ n, c }: P) {
  const w = writer(n, c);
  const { n: num, u: parsed } = C.parseU(valueOf(n, c));
  const units = c.units || ['px'];
  /* An empty value parses to an empty unit, which is not one of the offered ones. The
     string version relied on the browser picking the first option when none matched;
     setting `value` explicitly instead leaves selectedIndex at -1 and reads back '',
     so a typed number was stored as `max-width: 900` — a declaration the browser
     throws away. Falling back to the first unit is what the old markup did by
     accident, and what it has to do on purpose. */
  const u = units.includes(parsed) ? parsed : units[0];
  /* the unit is read off the select rather than closed over, so changing either half
     sends the pair — a number with the old unit is a different value */
  const push = (root: HTMLElement) => {
    const numEl = root.querySelector('input') as HTMLInputElement;
    const unitEl = root.querySelector('select') as HTMLSelectElement;
    const v = String(numEl.value).trim();
    w.live(v === '' ? '' : v + (unitEl.value || ''));
  };
  return <Field n={n} c={c}>
    <div class="unit">
      <input class="ctl" type="number" step={c.step || 1} value={num} placeholder="auto"
        onInput={e => push((e.target as HTMLElement).parentElement!)} onBlur={w.done} />
      <select class="ctl" value={u}
        onChange={e => { push((e.target as HTMLElement).parentElement!); w.done(); }}>
        {units.map(x => <option key={x} value={x}>{x || '—'}</option>)}
      </select>
    </div>
  </Field>;
}

function SliderCtl({ n, c }: P) {
  const w = writer(n, c);
  const raw = valueOf(n, c);
  const v = raw === '' || raw == null ? (c.max === 1 ? 1 : c.min) : parseFloat(String(raw));
  const push = (x: string) => w.live(c.raw ? String(x) : x + 'px');
  return <Field n={n} c={c}>
    <div class="sld">
      <input type="range" min={c.min} max={c.max} step={c.step} value={v}
        onInput={e => push((e.target as HTMLInputElement).value)} onChange={w.done} />
      <input class="ctl num" type="number" min={c.min} max={c.max} step={c.step} value={v}
        onInput={e => push((e.target as HTMLInputElement).value)} onBlur={w.done} />
    </div>
  </Field>;
}

function ColorCtl({ n, c }: P) {
  const w = writer(n, c);
  const v = String(valueOf(n, c) || '');
  const tok = C.refId(v) ? C.findColor(C.refId(v)!) : null;
  const lit = tok ? tok.value : v;
  const hexish = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(lit) ? lit : '#000000';
  const cur = () => (c.c ? C.cssVal(C.tgtObj(n), c.c, !!c.r).v : C.propVal(n, c.k));

  const addToken = async () => {
    const name = await L.askText('New colour token', 'Colour name', 'Accent',
      { ok: 'Create token', note: 'Every element using it changes with it.' });
    if (name === null) return;
    C.edit(() => { const id = C.colorAdd(name, C.resolveColor(cur()) || hexish); C.applyC(n, c, C.cvar(id)); });
    L.toast('Colour token created');
  };

  return <Field n={n} c={c}>
    <div class="clr">
      <span class="sw">
        <i style={{ background: lit || 'transparent' }} />
        {/* picking a literal breaks any token link, which is why this writes through
            the same path as typing a hex rather than a special one */}
        <input type="color" value={hexish}
          onInput={e => w.live((e.target as HTMLInputElement).value)}
          onChange={() => { w.done(); if (C.isRef(cur())) repaint('right'); }} />
      </span>
      {tok
        ? <>
          <span class="tokchip" title={'Linked to the ' + tok.name + ' token'}>
            <Icon name="link" size={10} /> {tok.name}
          </span>
          <button class="x" title="Unlink — keep the colour, drop the link"
            onClick={() => w.hard(C.resolveColor(cur()))}><Icon name="unlink" size={11} /></button>
        </>
        : <>
          <input class="ctl hex" value={v} placeholder="inherit"
            onInput={e => w.live((e.target as HTMLInputElement).value.trim())} onBlur={w.done} />
          <button class="x" title="Clear" onClick={() => w.hard('')}><Icon name="trash" size={11} /></button>
        </>}
    </div>
    <div class="toks">
      {C.colors().map(t => (
        <button key={t.id} class={'tok' + (tok && tok.id === t.id ? ' on' : '')} title={t.name}
          style={{ background: t.value }} onClick={() => w.hard(C.cvar(t.id))} />
      ))}
      <button class="tok add" title="Save this colour as a new token" onClick={addToken}>
        <Icon name="plus" size={10} />
      </button>
    </div>
  </Field>;
}

function PickCtl({ n, c }: P) {
  const w = writer(n, c);
  const val = String(shown(n, c));
  const opts = (typeof c.opts === 'function' ? c.opts(n) : c.opts) || [];
  return <Field n={n} c={c}>
    <div class="pick">
      {opts.map(([v, l]) => (
        <button key={v} class={val === String(v) ? 'on' : ''} title={l}
          onClick={() => w.hard(v)}>{C.IC[l] ? <Icon name={l} size={13} /> : l}</button>
      ))}
    </div>
  </Field>;
}

/* A toggle carries its label inside the row, so it is the one control that does not
   use Field — there is no separate <label> to hang the badges off. */
function ToggleCtl({ n, c }: P) {
  const w = writer(n, c);
  const on = !!valueOf(n, c);
  return <div class="f">
    <div class="tog-row">
      <span>{c.label}</span>
      <button class={'sw-tog' + (on ? ' on' : '')} onClick={() => w.hard(on ? 0 : 1)}><i /></button>
    </div>
  </div>;
}

const SIDES = ['top', 'right', 'bottom', 'left'];

function BoxCtl({ n, c }: P) {
  const key = n.id + '|' + (c.c || c.k || c.t);
  const vals = SIDES.map(s => C.parseU(C.cssVal(C.tgtObj(n), c.c + '-' + s, !!c.r).v));
  const withUnit = vals.find(x => x.u);
  const u = withUnit ? withUnit.u : 'px';

  /* all four sides are written on every change, reading the unit off the select — one
     side holding an old unit is a value nobody asked for */
  const push = (root: HTMLElement) => {
    L.tx(key);
    const unit = (root.querySelector('select') as HTMLSelectElement).value;
    root.querySelectorAll('input').forEach((inp, i) => {
      const v = String((inp as HTMLInputElement).value).trim();
      C.setCss(C.tgtObj(n), c.c + '-' + SIDES[i], v === '' ? '' : v + unit, !!c.r);
    });
    L.repaintCss();
  };

  return <Field n={n} c={c}>
    <div class="row4">
      {SIDES.map((s, k) => (
        <input class="ctl" key={s} type="number" value={vals[k].n} placeholder="0" title={s}
          onInput={e => push((e.target as HTMLElement).closest('.f')!)} onBlur={L.endTx} />
      ))}
    </div>
    <div class="note" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>top · right · bottom · left</span>
      <select class="ctl" value={u} style={{ width: '58px', padding: '2px 4px', fontSize: '10px' }}
        onChange={e => { push((e.target as HTMLElement).closest('.f')!); L.endTx(); }}>
        {['px', 'rem', '%', 'em'].map(x => <option key={x} value={x}>{x}</option>)}
      </select>
    </div>
  </Field>;
}

/** One file into the library and onto a prop. Shared so the type check, the
    large-image warning and the toast are identical everywhere. */
function useFilePicker(take: (id: string) => void, multiple = false) {
  return () => {
    const fi = document.createElement('input');
    fi.type = 'file'; fi.accept = 'image/*'; fi.multiple = multiple;
    fi.onchange = async () => {
      for (const file of Array.from(fi.files || [])) {
        const id = await L.mediaTake(file);
        if (id) take(id);
      }
    };
    fi.click();
  };
}

function ImgCtl({ n, c }: P) {
  const w = writer(n, c);
  const val = String(valueOf(n, c) || '');
  const rawv = c.bg ? val.replace(/^url\(["']?|["']?\)$/g, '') : val;
  const ref = rawv.match(/^asset:([a-z0-9]+)$/);
  const a = ref ? L.asset(ref[1]) : null;
  const wrap = (v: string) => c.bg ? (v ? `url("${v}")` : '') : v;

  const use = (id: string) => {
    const got = L.asset(id);
    if (!got) return;
    C.edit(() => {
      C.applyC(n, c, wrap('asset:' + id));
      /* an image's intrinsic size comes along once, so the export can write
         width/height and the review stops asking for them */
      if (!c.bg && got.w) { n.props.w = String(got.w); n.props.h = String(got.h); }
    });
  };
  const choose = useFilePicker(use);

  return <Field n={n} c={c}>
    {a
      ? <div class="imgset">
        <img src={a.url} alt="" />
        <span class="an"><b>{a.name}</b><small>{C.kb(a.size)}{a.w ? ` · ${a.w} × ${a.h}` : ''}</small></span>
        <button class="x" title="Remove image" onClick={() => w.hard(wrap(''))}>
          <Icon name="trash" size={12} /></button>
      </div>
      : rawv
        ? <div class="imgset missing">
          <span class="an"><b>Not in this project</b><small>{rawv.slice(0, 40)}</small></span>
          <button class="x" title="Clear" onClick={() => w.hard(wrap(''))}>
            <Icon name="trash" size={12} /></button>
        </div>
        : <Dropzone onFiles={choose} />}
    <div style={{ display: 'flex', gap: '6px', marginTop: 'var(--gap-1)' }}>
      <button class="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={choose}>
        <Icon name="image" size={13} /> {a ? 'Replace' : 'Upload'}
      </button>
      {L.assetCount() ? (
        <button class="btn" style={{ flex: 1, justifyContent: 'center' }} title="Pick from the Media library"
          onClick={async () => { const id = await L.mediaPicker(); if (id) use(id); }}>
          <Icon name="copy" size={13} /> Library
        </button>
      ) : null}
    </div>
    <div class="note">Exported inline, or as a file beside the page.</div>
  </Field>;
}

/** The drop target. `over` is toggled on the element rather than in state so a
    dragenter does not repaint the panel mid-drag. */
export function Dropzone({ onFiles }: { onFiles: () => void }) {
  const stop = (e: DragEvent, add: boolean) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.toggle('over', add);
  };
  return (
    <div class="imgdrop" onClick={onFiles}
      onDragEnter={e => stop(e, true)} onDragOver={e => stop(e, true)}
      onDragLeave={e => stop(e, false)}
      onDrop={e => { stop(e, false); void e; onFiles(); }}>
      <b>Drop an image here</b><span>or choose a file</span>
    </div>
  );
}

function SourceCtl({ n, c }: P) {
  const cur = n.src && C.findCollection(n.src) ? n.src : '';
  const set = (v: string) => {
    C.edit(() => { C.srcSet(n, v); if (!v) n.props.sort = ''; });
    const col = v ? C.findCollection(v) : null;
    L.toast(col ? `${col.name} — ${col.items.length} items` : 'Collection cleared');
  };
  return <Field n={n} c={c}>
    <select class="ctl" value={cur} onChange={e => set((e.target as HTMLSelectElement).value)}>
      <option value="">— Pick a collection —</option>
      {C.collections().map(x => (
        <option key={x.id} value={x.id}>{x.name} · {x.items.length} item{x.items.length === 1 ? '' : 's'}</option>
      ))}
    </select>
    {cur ? (
      <button class="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--gap-1)' }}
        onClick={() => L.bindModal(n.id)}><Icon name="cms" size={13} /> Bind the fields inside…</button>
    ) : null}
    {C.collections().length ? null : <div class="note">No collections yet — make one in <b>CMS</b>.</div>}
  </Field>;
}

function RichCtl({ n, c }: P) {
  const { scope, fid } = bound(n, c);
  const f = fid && scope ? C.findField(scope.col, fid) : null;
  return <Field n={n} c={c}>
    {fid
      ? <div class="note">This block's content comes from <b>{(f || { name: 'a missing field' }).name}</b>.
        Unbind it to edit the text here.</div>
      : <>
        <button class="btn" style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => L.enterEdit(n.id)}><Icon name="edit" size={13} /> Edit on canvas</button>
        <div class="note">Or double-click the block directly. Toolbar: bold, italic, links,
          lists, headings.</div>
      </>}
  </Field>;
}

function TstyleCtl({ n, c }: P) {
  const cur = C.findStyle(String(valueOf(n, c) || ''));
  const used = cur ? C.tsUsage(cur.id) : 0;

  const push = async () => {
    const t = C.findStyle(n.props.ts);
    const k = t ? C.tsUsage(t.id) : 0;
    if (k > 1 && !await L.askConfirm('Update the style everywhere?',
      `<b>${esc(t!.name)}</b> is used ${k}×. Taking this element's typography into the `
      + `style changes the other ${k - 1} too.`, { ok: 'Update style', danger: false })) return;
    C.edit(() => C.tsUpdateFrom(n));
    L.toast('Style updated everywhere');
  };
  const create = async () => {
    const name = await L.askText('New text style', 'Style name', C.DEF[n.type].label,
      { ok: 'Create style', note: 'Every element using it follows.' });
    if (name === null) return;
    C.edit(() => C.tsCreateFrom(n, name));
    L.toast('Text style created');
  };

  return <Field n={n} c={c}>
    <select class="ctl" value={cur ? cur.id : ''}
      onChange={e => {
        const v = (e.target as HTMLSelectElement).value;
        C.edit(() => { if (v) C.tsApply(n, v); else C.tsUnlink(n); });
      }}>
      <option value="">— None (styled directly) —</option>
      {C.styles().map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
    <div style={{ display: 'flex', gap: '6px', marginTop: 'var(--gap-1)' }}>
      {cur
        ? <>
          <button class="btn ghost" style={{ flex: 1, justifyContent: 'center', fontSize: '12px' }}
            title="Copy this element's typography into the style, everywhere it is used"
            onClick={push}>Update style{used > 1 ? ` · ${used} uses` : ''}</button>
          <button class="btn ghost" style={{ fontSize: '12px' }}
            title="Keep the look, stop following the style"
            onClick={() => { C.edit(() => C.tsUnlink(n)); L.toast('Detached — the look is now local'); }}>
            Detach</button>
        </>
        : <button class="btn" style={{ flex: 1, justifyContent: 'center', fontSize: '11px' }}
          onClick={create}><Icon name="plus" size={12} /> Save as text style</button>}
    </div>
    <div class="note">{cur
      ? `Used by ${used} element${used === 1 ? '' : 's'}. Anything you set below overrides the style for this element only.`
      : 'Typography lives on this element. Save it as a style to reuse it and restyle everything at once.'}</div>
  </Field>;
}

function OptCtl({ n, c }: P) {
  const w = writer(n, c);
  const cur = String(valueOf(n, c) ?? '');
  const groups = c.og ? c.og() : null;
  const pool: string[][] = groups ? groups.reduce((all, [, list]) => all.concat(list), [] as any[]) : (c.opts as string[][] || []);
  const known = pool.some(([v]) => String(v) === cur);
  const ck = n.id + '|' + (c.c || c.k);
  /* an unrecognised stored value means somebody typed it, so the custom input opens
     itself rather than silently showing the first preset instead */
  const custom = !!C.state.ui.custom[ck] || (!known && cur !== '');

  const opt = ([v, l]: string[]) => <option key={v} value={v}>{l}</option>;

  return <Field n={n} c={c}>
    <select class="ctl" value={custom ? '__custom' : cur}
      onChange={e => {
        const v = (e.target as HTMLSelectElement).value;
        if (v === '__custom') { C.state.ui.custom[ck] = true; repaint('right'); return; }
        delete C.state.ui.custom[ck];
        w.hard(v);
      }}>
      {groups
        ? groups.map(([g, list]) => <optgroup key={g} label={g}>{(list as string[][]).map(opt)}</optgroup>)
        : (c.opts as string[][] || []).map(opt)}
      <option value="__custom">Custom…</option>
    </select>
    {custom ? (
      <input class="ctl" value={cur} placeholder={c.ph || ''}
        style={{ marginTop: 'var(--gap-1)', fontFamily: 'var(--label)', fontSize: '12px' }}
        onInput={e => w.live((e.target as HTMLInputElement).value.trim())} onBlur={w.done} />
    ) : null}
  </Field>;
}

function LinkCtl({ n, c }: P) {
  const here = C.page().slug;
  const link = C.linkOf(n, c.k!, here) as any;
  const tkey = c.tk || 'target';
  const anchors = link.mode === 'page' ? C.anchorsOf(link.page || here) : [];
  const scope = C.bindScope(n.id);
  /* "This item's own page" is only offered where there is an item to mean — inside a
     Collection list, or on a detail template — and only once some page templates the
     collection, or the link resolves to nothing. */
  const hasDetail = !!scope && C.state.pages.some(p => p.collection === scope.col.id);
  const MODES: string[][] = [['none', 'No link'], ['page', 'A page in this project'],
    ...(hasDetail ? [['item', 'This item’s own page']] : []),
    ['url', 'External URL'], ['email', 'Email address'], ['phone', 'Phone number']];

  const key = n.id + '|' + (c.c || c.k || c.t);
  const commit = (o: any) => {
    L.tx(key); n.props[c.k!] = C.buildLink(o);
    L.endTx(); L.paint(); L.save(); repaint('right');
  };

  return <Field n={n} c={c}>
    <select class="ctl" value={link.mode}
      onChange={e => {
        const mode = (e.target as HTMLSelectElement).value;
        if (mode === 'none') n.props[tkey] = '';
        /* a mode with nothing stored yet cannot be derived from the href, so it is
           remembered here until a value makes it real */
        C.state.ui.lmode = mode === 'none' ? null : { key: n.id + '|' + c.k, mode };
        commit(mode === 'page' ? { mode, page: here, frag: '' } : { mode });
        if (mode === 'item') C.state.ui.lmode = null;   // it stores a real value at once
      }}>
      {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>

    {link.mode === 'page' ? <>
      <select class="ctl" style={{ marginTop: 'var(--gap-1)' }} value={link.page || here}
        onChange={e => commit({ mode: 'page', page: (e.target as HTMLSelectElement).value, frag: '' })}>
        {C.state.pages.map(p => (
          <option key={p.id} value={p.slug}>{p.name} — /{p.slug}.html</option>
        ))}
      </select>
      <select class="ctl" style={{ marginTop: 'var(--gap-1)' }} value={link.frag || ''}
        onChange={e => commit({ ...C.linkOf(n, c.k!, here), frag: (e.target as HTMLSelectElement).value })}>
        <option value="">Top of the page</option>
        {anchors.map(id => <option key={id} value={id}>#{id}</option>)}
        {link.frag && !anchors.includes(link.frag)
          ? <option value={link.frag}>#{link.frag} — missing</option> : null}
      </select>
      {anchors.length ? null : (
        <div class="note">That page has no anchors yet. Give an element an HTML anchor id
          under Advanced.</div>
      )}
    </> : null}

    {['url', 'email', 'phone'].includes(link.mode) ? (
      <input class="ctl" type={link.mode === 'email' ? 'email' : undefined} value={link.value || ''}
        style={{ marginTop: 'var(--gap-1)' }}
        placeholder={link.mode === 'url' ? 'https://example.com'
          : link.mode === 'email' ? 'hello@example.com' : '+1 555 0100'}
        onInput={e => {
          L.tx(key);
          n.props[c.k!] = C.buildLink({ ...C.linkOf(n, c.k!, here), value: (e.target as HTMLInputElement).value.trim() });
          L.repaint();
        }} onBlur={L.endTx} />
    ) : null}

    {link.mode === 'item' && scope ? (
      <div class="note">Each card links to its own page under <b>{scope.col.slug}/</b>.</div>
    ) : null}

    {link.mode !== 'none' ? (
      <div class="tog-row" style={{ marginTop: 'var(--gap-1)' }}>
        <span>Open in a new tab</span>
        <button class={'sw-tog' + (C.propVal(n, tkey) === '_blank' ? ' on' : '')}
          onClick={() => {
            L.tx(key);
            n.props[tkey] = C.propVal(n, tkey) === '_blank' ? '' : '_blank';
            L.endTx(); L.paint(); L.save(); repaint('right');
          }}><i /></button>
      </div>
    ) : null}
  </Field>;
}

function DimsCtl({ n, c }: P) {
  const key = n.id + '|' + (c.c || c.k || c.t);
  const push = (root: HTMLElement) => {
    L.tx(key);
    const [w, h] = Array.from(root.querySelectorAll('input')) as HTMLInputElement[];
    n.props.w = w.value; n.props.h = h.value;
    L.repaint();
  };
  const detect = async () => {
    const got = await L.imgSize(L.assetsToBlob(String(n.props.src || '')));
    if (!got) { L.toast('Could not read that image'); return; }
    C.edit(() => { n.props.w = String(got.w); n.props.h = String(got.h); });
    L.toast(`Detected ${got.w} × ${got.h}`);
  };
  return <Field n={n} c={c}>
    <div class="unit">
      <input class="ctl" type="number" min="0" value={n.props.w || ''} placeholder="width"
        onInput={e => push((e.target as HTMLElement).parentElement!)} onBlur={L.endTx} />
      <input class="ctl" type="number" min="0" value={n.props.h || ''} placeholder="height"
        onInput={e => push((e.target as HTMLElement).parentElement!)} onBlur={L.endTx} />
      <button class="btn" style={{ flex: '0 0 auto', fontSize: '12px' }}
        title="Read the real dimensions from the image" onClick={detect}>Detect</button>
    </div>
  </Field>;
}

function IconCtl({ n, c }: P) {
  const w = writer(n, c);
  const val = String(valueOf(n, c) || '');
  const cur = C.ICON_PATHS[val] ? val : 'check';
  return <Field n={n} c={c}>
    <div class="iconpick">
      {C.ICONS.map(([g, list]) => <>
        <div class="ipgroup" key={'g' + g}>{g}</div>
        <div class="ipgrid" key={'r' + g}>
          {(list as string[][]).map(([nm]) => (
            <button key={nm} class={nm === cur ? 'on' : ''} title={nm} onClick={() => w.hard(nm)}
              dangerouslySetInnerHTML={{ __html: C.iconSvg(nm) }} />
          ))}
        </div>
      </>)}
    </div>
  </Field>;
}

/* The column control writes structure rather than a value, so it goes through
   applyCols and edit() instead of the writer. */
function ColsCtl({ n, c }: P) {
  const count = (n.children || []).length;
  const hit = C.matchLayout(n);
  const list = C.LAYOUTS[count as keyof typeof C.LAYOUTS] || [];
  const top = C.COUNTS[C.COUNTS.length - 1];

  const setCount = async (k: number) => {
    if (k === count) return;
    const lost = n.children.slice(k).reduce((t, col) => t + col.children.length, 0);
    if (k < count && lost && !await L.askConfirm('Fewer columns',
      `${lost} element${lost === 1 ? '' : 's'} will move into the last remaining column.`,
      { ok: 'Continue', danger: false })) return;
    C.edit(() => C.applyCols(n, C.LAYOUTS[k as keyof typeof C.LAYOUTS][0]));
  };

  return <div class="f">
    <label>{c.label || ''}</label>
    <div class="pick">
      {C.COUNTS.map(k => (
        <button key={k} class={k === count ? 'on' : ''} title={`${k} column${k === 1 ? '' : 's'}`}
          onClick={() => setCount(k)}>{k}</button>
      ))}
    </div>
    {list.length > 1 ? <>
      <label style={{ marginTop: 'var(--gap-2)' }}>Layout</label>
      <div class="lay">
        {list.map((l, k) => (
          <button key={k} class={hit === k ? 'on' : ''} title={l.map(x => Math.round(x) + '%').join(' / ')}
            onClick={() => C.edit(() => C.applyCols(n, C.LAYOUTS[n.children.length as keyof typeof C.LAYOUTS][k]))}>
            {l.map((x, j) => <i key={j} style={{ flexGrow: x }} />)}
          </button>
        ))}
      </div>
    </> : null}
    <div class="note">{count > top
      ? `${count} columns — more than the presets cover. Set each column's width individually.`
      : 'Drag a gutter on the canvas to change the split. Reducing the count moves content into the last column.'}</div>
  </div>;
}

const KINDS: Record<string, (p: P) => any> = {
  text: TextCtl, area: AreaCtl, select: SelectCtl, unit: UnitCtl, slider: SliderCtl,
  color: ColorCtl, pick: PickCtl, toggle: ToggleCtl, box: BoxCtl, img: ImgCtl,
  opt: OptCtl, dims: DimsCtl, link: LinkCtl, rich: RichCtl, tstyle: TstyleCtl,
  source: SourceCtl, items: ItemsCtl, fields: FieldsCtl, qa: QaCtl, imgs: ImgsCtl,
  icon: IconCtl, cols: ColsCtl
};

/** Every kind the inspector can draw. Exported so a test — and the build — can check
    the list against the `ControlKind` union rather than trusting it. */
export const CONTROL_KINDS = Object.keys(KINDS);

export function Ctl({ n, c }: P) {
  const Cmp = KINDS[c.t];
  if (!Cmp) return null;
  return <Cmp n={n} c={c} />;
}

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
