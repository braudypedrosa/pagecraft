/* The four repeater controls: nav items, form fields, accordion Q&A, gallery images.

   All four have the same shape — a list of rows, each editable, each with move-up and
   remove, and an add button — so the row plumbing is shared and only the row's own
   fields differ. In builder.html each of the four repeated its own `arr()`, its own
   `fld()` binder and its own move/remove handlers: four copies of the same twenty
   lines, in the file the parity guard exists to police. */
import { C, L } from '../ctx';
import { Icon } from '../Icon';
import { Field } from './Field';
import { valueOf, rows, liftRow, dropRow } from './ctl';
import type { Control, Node as PcNode } from '../../core/types';

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
  return <button class="btn" onClick={onClick}
    style={{ width: '100%', justifyContent: 'center', marginTop: gap ? '6px' : '0', fontSize: small ? '11px' : '12px' }}>
    <Icon name="plus" size={12} /> {label}
  </button>;
}

export function ItemsCtl({ n, c }: P) {
  const arr = list(n, c);
  return <Field n={n} c={c}>
    {arr.map((_, k) => (
      <div class="irow" key={k}>
        <RowInput n={n} c={c} k={k} prop="label" placeholder="Label" />
        <RowInput n={n} c={c} k={k} prop="href" placeholder="#anchor or page.html" />
        <RowActs n={n} c={c} k={k} />
      </div>
    ))}
    <AddButton label="Add link" gap={!!arr.length} small
      onClick={() => C.edit(() => rows(n, c).push({ label: 'New link', href: '' }))} />
  </Field>;
}

const FIELD_TYPES: string[][] = [['text', 'Text'], ['email', 'Email'], ['tel', 'Phone'],
  ['number', 'Number'], ['textarea', 'Long text'], ['select', 'Dropdown'], ['checkbox', 'Checkbox']];

export function FieldsCtl({ n, c }: P) {
  const arr = list(n, c);
  const key = n.id + '|' + (c.c || c.k || c.t);
  return <Field n={n} c={c}>
    {arr.map((f, k) => (
      <div class="frow" key={k}>
        <div class="frow-a">
          <RowInput n={n} c={c} k={k} prop="label" placeholder="Label" />
          {/* changing the type changes which second-row input is drawn, so this one
              commits and re-renders rather than coalescing */}
          <select class="ctl" value={f.type || 'text'}
            onChange={e => {
              L.tx(key);
              rows(n, c)[k].type = (e.target as HTMLSelectElement).value;
              L.endTx(); L.paint(); L.save();
              L.appRender();
            }}>
            {FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <RowActs n={n} c={c} k={k} />
        </div>
        <div class="frow-b">
          <RowInput n={n} c={c} k={k} prop="name"
            placeholder={C.slugify(f.label) || 'field-name'}
            title="The name submitted with the value" />
          {f.type === 'select'
            ? <RowInput n={n} c={c} k={k} prop="opts" placeholder="Option one, Option two" />
            : <RowInput n={n} c={c} k={k} prop="ph" placeholder="Placeholder" />}
          <button class={'freq' + (f.required ? ' on' : '')} title="Required"
            onClick={() => C.edit(() => {
              const a = rows(n, c);
              a[k].required = a[k].required ? 0 : 1;
            })}>Req</button>
        </div>
      </div>
    ))}
    <AddButton label="Add field" gap={!!arr.length}
      onClick={() => C.edit(() => rows(n, c).push({ type: 'text', label: 'New field', name: '', required: 0, ph: '' }))} />
  </Field>;
}

/* A list of two-field rows: a line and a block. The accordion's questions and answers, and the
   tabs' labels and panels, are the same control with different words on it — so the prop names
   and the wording come off the control rather than being written in here twice. */
export function QaCtl({ n, c }: P) {
  const arr = list(n, c);
  const key = n.id + '|' + (c.c || c.k || c.t);
  const [kA, kB] = c.rowKeys || ['q', 'a'];
  const [phA, phB] = c.rowPhs || ['Question', 'Answer — leave a blank line to start a new paragraph'];
  return <Field n={n} c={c}>
    {arr.map((it, k) => (
      <div class="qarow" key={k}>
        <div class="qarow-a">
          <RowInput n={n} c={c} k={k} prop={kA} placeholder={phA} />
          <RowActs n={n} c={c} k={k} />
        </div>
        <textarea class="ctl" rows={2} value={it[kB] || ''} placeholder={phB}
          onInput={e => {
            L.tx(key);
            rows(n, c)[k][kB] = (e.target as HTMLTextAreaElement).value;
            L.repaint();
          }} onBlur={L.endTx} />
      </div>
    ))}
    <AddButton label={c.addLabel || 'Add question'} gap={!!arr.length}
      onClick={() => C.edit(() => {
        const [vA, vB] = c.rowNew || ['A new question', ''];
        rows(n, c).push({ [kA]: vA, [kB]: vB });
      })} />
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
      const ref = String(it.src || '').match(/^asset:([a-z0-9]+)$/);
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
      <button class="btn" style={{ flex: 1, justifyContent: 'center', fontSize: '12px' }} onClick={upload}>
        <Icon name="image" size={13} /> Upload
      </button>
      {L.assetCount() ? (
        <button class="btn" style={{ flex: 1, justifyContent: 'center', fontSize: '12px' }}
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
