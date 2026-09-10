/* The four repeater controls: nav items, form fields, accordion Q&A, gallery images.

   All four have the same shape — a list of rows, each editable, each with move-up and
   remove, and an add button — so the row plumbing is shared and only the row's own
   fields differ. In builder.html each of the four repeated its own `arr()`, its own
   `fld()` binder and its own move/remove handlers: four copies of the same twenty
   lines, in the file the parity guard exists to police. */
import { C, L } from '../ctx';
import { Icon } from '../Icon';
import { Field } from './Field';
import { valueOf, rows, liftRow, moveRow, dropRow } from './ctl';
import {
  WordPressContentPicker, wordpressContentTargets, wordpressDestinationForValue,
  wordpressReferenceForItem
} from '../WordPressContentPicker';
import type { Control, Node as PcNode } from '../../core/types';
import { useRef, useState } from 'preact/hooks';

type P = { n: PcNode; c: Control };

const list = (n: PcNode, c: Control): any[] => {
  const v = valueOf(n, c);
  return Array.isArray(v) ? v : [];
};

/** A text input bound to one property of one row. Typing coalesces into a single undo
    step per field, which is what `tx` keyed on the control gives us. */
function RowInput({ n, c, k, prop, ...rest }: P & { k: number; prop: string } & Record<string, any>) {
  const key = n.id + '|' + (c.c || c.k || c.t);
  return <input class="ctl" value={list(n, c)[k][prop] || ''} {...rest}
    onInput={e => {
      L.tx(key);
      rows(n, c)[k][prop] = (e.target as HTMLInputElement).value;
      L.repaint();
    }} onBlur={L.endTx} />;
}

/** Move-up and remove, which every row has. */
function RowActs({ n, c, k }: P & { k: number }) {
  return <>
    <button class="x" title="Move up" disabled={k === 0} onClick={() => liftRow(n, c, k)}>
      <Icon name="caretUp" size={11} /></button>
    <button class="x" title="Remove" onClick={() => dropRow(n, c, k)}>
      <Icon name="trash" size={11} /></button>
  </>;
}

function AddButton({ label, onClick, gap, small }: { label: string; onClick: () => void; gap: boolean; small?: boolean }) {
  return <button class="btn block" onClick={onClick}
    style={{ marginTop: gap ? 'var(--gap-1)' : '0', fontSize: small ? 'var(--fs-1)' : 'var(--fs-2)' }}>
    <Icon name="plus" size={12} /> {label}
  </button>;
}

export function ItemsCtl({ n, c }: P) {
  const arr = list(n, c);
  const [open, setOpen] = useState<number | null>(arr.length ? 0 : null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);
  const wordpressTargets = wordpressContentTargets();
  const firstWordPressTarget = wordpressTargets.find(target => target.items.some(item =>
    !!wordpressReferenceForItem(target, item))) || null;
  const firstWordPress = firstWordPressTarget?.items.find(item =>
    !!wordpressReferenceForItem(firstWordPressTarget, item)) || null;
  const firstWordPressReference = firstWordPressTarget && firstWordPress
    ? wordpressReferenceForItem(firstWordPressTarget, firstWordPress)?.reference || '' : '';
  const commit = (k: number, prop: string, value: string) => C.edit(() => { rows(n, c)[k][prop] = value; });
  const commitDestination = (k: number, value: string) => C.edit(() => {
    const row = rows(n, c)[k];
    row.href = value;
    delete row.objectId;
    delete row.objectType;
    delete row.anchor;
  });
  const parsed = (it: any) => C.parseLink(it.href, C.page().slug) as any;
  const pageName = (slug: string) => C.state.pages.find(p => p.slug === slug)?.name || 'Missing page';
  const summary = (it: any) => {
    const link = parsed(it);
    if (link.mode === 'page') return `Page · ${pageName(link.page || C.page().slug)}`;
    const wordpress = wordpressDestinationForValue(it.href);
    if (wordpress) return `WordPress · ${wordpress.item.objectType === 'post' ? 'Post' : 'Page'} · ${wordpress.path}`;
    return String(it.href || '').trim() || 'Custom URL not set';
  };
  const finishDrag = (to: number) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    setDragging(null);
    setDragOver(null);
    if (from === null || from === to) return;
    moveRow(n, c, from, to);
    if (open === from) setOpen(to);
    else if (open !== null && from < open && to >= open) setOpen(open - 1);
    else if (open !== null && from > open && to <= open) setOpen(open + 1);
  };
  const wouldCreateParentCycle = (itemIndex: number, candidateIndex: number) => {
    const itemId = String(arr[itemIndex]?.id || '');
    let candidateId = String(arr[candidateIndex]?.id || '');
    if (!itemId || !candidateId) return true;
    const byId = new Map(arr.map(item => [String(item.id || ''), item]));
    const seen = new Set<string>();
    while (candidateId && !seen.has(candidateId)) {
      if (candidateId === itemId) return true;
      seen.add(candidateId);
      candidateId = String(byId.get(candidateId)?.parentId || '');
    }
    return false;
  };

  return <Field n={n} c={c}>
    {n.props.menuLocation ? <div class="note native-menu-note">
      WordPress menu · {String(n.props.menuLocation).replace(/(^|[-_])\w/g, value => value.replace(/[-_]/, ' ').toUpperCase())} navigation.
      Content changes here also appear in Appearance → Menus; Pagecraft keeps the visual settings.
    </div> : null}
    {arr.map((it, k) => {
      const link = parsed(it);
      const wordpress = wordpressDestinationForValue(it.href);
      const mode = link.mode === 'page' ? 'page' : wordpress ? 'wordpress' : 'custom';
      const page = link.page || C.page().slug;
      const anchors = mode === 'page' ? C.anchorsOf(page) : [];
      const isDragging = dragging === k;
      return <div class={'navitem' + (open === k ? ' on' : '') + (isDragging ? ' dragging' : '') + (dragOver === k && !isDragging ? ' dragover' : '')}
        key={k} onDragOver={e => { e.preventDefault(); if (dragFrom.current !== null && dragFrom.current !== k) setDragOver(k); }}
        onDrop={e => { e.preventDefault(); finishDrag(k); }}>
        <div class="navitem-head">
          <button class="navitem-drag" draggable aria-label={`Drag ${it.label || 'untitled link'} to reorder`}
            title="Drag to reorder"
            onDragStart={e => {
              dragFrom.current = k;
              setDragging(k);
              setDragOver(null);
              if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(k));
              }
            }}
            onDragEnd={() => { dragFrom.current = null; setDragging(null); setDragOver(null); }}>
            <Icon name="drag" size={12} />
          </button>
          <button class="navitem-main" aria-expanded={open === k ? 'true' : 'false'}
            onClick={() => setOpen(open === k ? null : k)}>
            <span><b>{it.label || 'Untitled link'}</b><small>{summary(it)}</small></span>
            <Icon name="caret" size={11} />
          </button>
          <button class="x" title="Remove" onClick={() => dropRow(n, c, k)}>
            <Icon name="trash" size={11} />
          </button>
        </div>
        {open === k ? <div class="navitem-body">
          <label>Navigation label</label>
          <RowInput n={n} c={c} k={k} prop="label" placeholder="Link label" />

          <label>Destination</label>
          <select class="ctl" value={mode} aria-label={`Destination for ${it.label || 'untitled link'}`} onChange={e => {
            const next = (e.target as HTMLSelectElement).value;
            commitDestination(k, next === 'page'
              ? C.buildLink({ mode: 'page', page: C.page().slug, frag: '' })
              : next === 'wordpress' ? firstWordPressReference : '');
          }}>
            <option value="page">A Pagecraft page</option>
            {firstWordPress ? <option value="wordpress">WordPress content</option> : null}
            <option value="custom">Custom URL</option>
          </select>

          {mode === 'page' ? <>
            <select class="ctl" value={page} onChange={e => {
              commitDestination(k, C.buildLink({ mode: 'page', page: (e.target as HTMLSelectElement).value, frag: '' }));
            }}>
              {C.state.pages.map(p => <option key={p.id} value={p.slug}>{p.name} · {p.slug === 'index' ? '/' : '/' + p.slug}</option>)}
            </select>
            <select class="ctl" value={link.frag || ''} onChange={e => {
              commit(k, 'href', C.buildLink({ mode: 'page', page, frag: (e.target as HTMLSelectElement).value }));
            }}>
              <option value="">Top of the page</option>
              {anchors.map(id => <option key={id} value={id}>#{id}</option>)}
              {link.frag && !anchors.includes(link.frag)
                ? <option value={link.frag}>#{link.frag} — missing</option> : null}
            </select>
          </> : mode === 'wordpress' ? (
            <WordPressContentPicker value={it.href} onChange={url => commitDestination(k, url)} />
          ) : <>
            <RowInput n={n} c={c} k={k} prop="href" placeholder="https://example.com or #section" />
            <div class="note">Supports external URLs, email, phone, and section links.</div>
          </>}

          <label>CSS classes</label>
          <RowInput n={n} c={c} k={k} prop="cls" placeholder="featured-link another-class" />
          <div class="note">Applied to this menu item. Separate multiple classes with spaces.</div>

          <label>Parent item</label>
          <select class="ctl" value={it.parentId || ''} onChange={e => commit(k, 'parentId', (e.target as HTMLSelectElement).value)}>
            <option value="">Top level</option>
            {arr.map((candidate, index) => index === k ? null : (
              <option key={candidate.id || index} value={candidate.id || ''}
                disabled={!candidate.id || wouldCreateParentCycle(k, index)}>
                {candidate.label || 'Untitled link'}
              </option>
            ))}
          </select>

          <label>Link relationship</label>
          <RowInput n={n} c={c} k={k} prop="rel" placeholder="nofollow sponsored" />
          <div class="note">Optional relationship values, separated by spaces.</div>

          <div class="tog-row navitem-target">
            <span>Open in a new tab</span>
            <button type="button" role="switch" aria-label="Open in a new tab"
              aria-checked={it.target === '_blank' ? 'true' : 'false'}
              class={'sw-tog' + (it.target === '_blank' ? ' on' : '')} onClick={() => {
              commit(k, 'target', it.target === '_blank' ? '' : '_blank');
            }}><i /></button>
          </div>
        </div> : null}
      </div>
    })}
    <div class="navitem-add" style={{ marginTop: arr.length ? 'var(--gap-1)' : '0' }}>
      <AddButton label="Add page" gap={false} small onClick={() => {
        const at = arr.length;
        C.edit(() => rows(n, c).push({ id: C.uid(), label: C.page().name, href: C.buildLink({ mode: 'page', page: C.page().slug, frag: '' }), parentId: '', cls: '', target: '', rel: '' }));
        setOpen(at);
      }} />
      <AddButton label="Add custom" gap={false} small onClick={() => {
        const at = arr.length;
        C.edit(() => rows(n, c).push({ id: C.uid(), label: 'New link', href: '', parentId: '', cls: '', target: '', rel: '' }));
        setOpen(at);
      }} />
    </div>
  </Field>;
}

const FIELD_TYPES: string[][] = [['text', 'Text'], ['email', 'Email'], ['tel', 'Phone'],
  ['number', 'Number'], ['date', 'Date'], ['textarea', 'Long text'], ['select', 'Dropdown'], ['checkbox', 'Checkbox']];

/** Shared disclosure for text repeaters. Only the active item occupies editing space. */
function RepeaterRow({ n, c, k, title, open, setOpen, children }: P & {
  k: number; title: string; open: number | null; setOpen: (k: number | null) => void; children: any;
}) {
  const expanded = open === k;
  return <div class={'frow repeater-row' + (expanded ? ' on' : '')}>
    <div class="repeater-head">
      <button type="button" class="repeater-toggle" aria-expanded={expanded}
        onClick={() => { L.endTx(); setOpen(expanded ? null : k); }}>
        <Icon name="caret" size={10} /><span>{title}</span>
      </button>
      <button type="button" class="x" title="Move up" disabled={k === 0}
        onClick={() => { liftRow(n, c, k); setOpen(k - 1); }}><Icon name="caretUp" size={11} /></button>
      <button type="button" class="x" title="Duplicate" onClick={() => {
        C.edit(() => {
          const copy = structuredClone(rows(n, c)[k]);
          // A copied form control must have a distinct submission key.
          if (c.t === 'fields') {
            const base = copy.name || C.slugify(copy.label) || 'field';
            let suffix = 2;
            while (rows(n, c).some(row => row.name === base + '-' + suffix)) suffix++;
            copy.name = base + '-' + suffix;
          }
          rows(n, c).splice(k + 1, 0, copy);
        });
        setOpen(k + 1);
      }}><Icon name="copy" size={11} /></button>
      <button type="button" class="x" title="Remove" onClick={() => {
        dropRow(n, c, k);
        setOpen(open === k ? null : open !== null && open > k ? open - 1 : open);
      }}><Icon name="trash" size={11} /></button>
    </div>
    {expanded ? <div class="repeater-body">{children}</div> : null}
  </div>;
}

export function FieldsCtl({ n, c }: P) {
  const arr = list(n, c);
  const [open, setOpen] = useState<number | null>(null);
  const [advanced, setAdvanced] = useState(false);
  return <Field n={n} c={c}>
    {arr.map((f, k) => (
      <RepeaterRow n={n} c={c} k={k} key={k} title={f.label || 'Field ' + (k + 1)}
        open={open} setOpen={at => { setOpen(at); setAdvanced(false); }}>
        <div class="repeater-tabs" role="group" aria-label="Field settings">
          <button type="button" aria-pressed={!advanced} onClick={() => setAdvanced(false)}>Content</button>
          <button type="button" aria-pressed={advanced} onClick={() => setAdvanced(true)}>Advanced</button>
        </div>
        {advanced ? <label class="frow-control"><span>Field name</span>
          <RowInput n={n} c={c} k={k} prop="name" placeholder={C.slugify(f.label) || 'field-name'} />
        </label> : <>
          <label class="frow-control"><span>Type</span>
            <select class="ctl" aria-label="Field type" value={f.type || 'text'}
              onChange={e => C.edit(() => { rows(n, c)[k].type = (e.target as HTMLSelectElement).value; })}>
              {FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label class="frow-control"><span>Label</span><RowInput n={n} c={c} k={k} prop="label" placeholder="Label" /></label>
          {f.type !== 'checkbox' ? <label class="frow-control"><span>{f.type === 'select' ? 'Options' : 'Placeholder'}</span>
            {f.type === 'select'
              ? <RowInput n={n} c={c} k={k} prop="opts" placeholder="Option one, Option two" />
              : <RowInput n={n} c={c} k={k} prop="ph" placeholder="Optional" />}
          </label> : null}
          <label class="frow-control"><span>Required</span><input class="field-switch" type="checkbox" role="switch" checked={!!f.required}
            onChange={() => C.edit(() => { rows(n, c)[k].required = f.required ? 0 : 1; })} /></label>
          <label class="frow-control"><span>Width</span>
            <select class="ctl" aria-label="Field width" value={f.width || (f.half ? 50 : 100)}
              onChange={e => C.edit(() => {
                rows(n, c)[k].width = Number((e.target as HTMLSelectElement).value);
                delete rows(n, c)[k].half;
              })}>
              {[100, 50, 33, 25, 20].map(width => <option key={width} value={width}>{width === 100 ? 'Full width' : width + '%'}</option>)}
            </select>
          </label>
        </>}
      </RepeaterRow>
    ))}
    <AddButton label="Add field" gap={!!arr.length} onClick={() => {
      const at = arr.length;
      C.edit(() => rows(n, c).push({ type: 'text', label: 'New field', name: '', required: 0, ph: '' }));
      setOpen(at); setAdvanced(false);
    }} />
  </Field>;
}

/* Questions and tabs use the same compact repeater as form fields. */
export function QaCtl({ n, c }: P) {
  const arr = list(n, c);
  const [open, setOpen] = useState<number | null>(null);
  const key = n.id + '|' + (c.c || c.k || c.t);
  const [kA, kB] = c.rowKeys || ['q', 'a'];
  const [phA, phB] = c.rowPhs || ['Question', 'Answer'];
  return <Field n={n} c={c}>
    {arr.map((it, k) => <RepeaterRow n={n} c={c} k={k} key={k}
      title={it[kA] || 'Item ' + (k + 1)} open={open} setOpen={setOpen}>
      <label class="frow-control"><span>{phA}</span><RowInput n={n} c={c} k={k} prop={kA} placeholder={phA} /></label>
      <label class="repeater-long"><span>{kB === 'a' ? 'Answer' : 'Content'}</span>
        <textarea class="ctl" rows={4} value={it[kB] || ''} placeholder={phB}
          onInput={e => { L.tx(key); rows(n, c)[k][kB] = (e.target as HTMLTextAreaElement).value; L.repaint(); }} onBlur={L.endTx} />
      </label>
    </RepeaterRow>)}
    <AddButton label={c.addLabel || 'Add question'} gap={!!arr.length} onClick={() => {
      const at = arr.length;
      C.edit(() => { const [vA, vB] = c.rowNew || ['A new question', '']; rows(n, c).push({ [kA]: vA, [kB]: vB }); });
      setOpen(at);
    }} />
  </Field>;
}

export function ImgsCtl({ n, c }: P) {
  const arr = list(n, c);

  /* intrinsic size is taken once, from what the library measured — the export writes it
     as width/height and the review reads it */
  const tile = (id: string) => {
    const a = L.asset(id);
    return { src: 'asset:' + id, alt: '', caption: '', w: a && a.w ? String(a.w) : '', h: a && a.h ? String(a.h) : '' };
  };

  const upload = () => {
    const fi = document.createElement('input');
    fi.type = 'file'; fi.accept = 'image/*'; fi.multiple = true;
    /* every file in one gesture is one undo step, not one per file */
    fi.onchange = async () => {
      const got: string[] = [];
      for (const file of Array.from(fi.files || [])) {
        const id = await L.mediaTake(file);
        if (id) got.push(id);
      }
      if (got.length) C.edit(() => got.forEach(id => rows(n, c).push(tile(id))));
    };
    fi.click();
  };

  return <Field n={n} c={c}>
    {arr.map((it, k) => {
      const ref = String(it.src || '').match(/^asset:([A-Za-z0-9][A-Za-z0-9._:-]*)$/);
      const a = ref ? L.asset(ref[1]) : null;
      return (
        <div class="gtile" key={k}>
          <span class="gthumb">
            {a ? <img src={a.url} alt="" /> : <span>not in<br />project</span>}
          </span>
          <span class="gmeta">
            <RowInput n={n} c={c} k={k} prop="alt" placeholder="Alt text — describe it" />
            <RowInput n={n} c={c} k={k} prop="caption" placeholder="Caption (optional)" />
          </span>
          <span class="gacts"><RowActs n={n} c={c} k={k} /></span>
        </div>
      );
    })}
    <div style={{ display: 'flex', gap: '6px', marginTop: arr.length ? '6px' : '0' }}>
      <button class="btn grow" style={{ fontSize: 'var(--fs-2)' }} onClick={upload}>
        <Icon name="image" size={13} /> Upload
      </button>
      {L.assetCount() ? (
        <button class="btn grow" style={{ fontSize: 'var(--fs-2)' }}
          title="Pick from the Media library"
          onClick={async () => {
            const id = await L.mediaPicker();
            if (id && L.asset(id)) C.edit(() => rows(n, c).push(tile(id)));
          }}><Icon name="copy" size={13} /> Library</button>
      ) : null}
    </div>
    <div class="note">Alt text is what a screen reader reads.</div>
  </Field>;
}
