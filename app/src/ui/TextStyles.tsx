/* The text styles editor, from the project dialog. Mounted into #mStyles.

   Each row edits the two values people change most — size and weight — in place, and
   expands for the rest: line height, letter spacing, colour, font, the default HTML tag,
   and per-breakpoint overrides. The row used to carry a read-only meta line instead,
   which made every row two lines tall and could not be acted on.

   Which row is open, and which breakpoint it is showing, are module-level rather than
   component state: the dialog re-mounts this on every repaint, and the selection should
   survive that the way it did before. */
import { C, L, repaint } from './ctx';
import { Icon } from './Icon';
import { FontSelect } from './FontSelect';
import type { TextStyle, Bp } from '../core/types';

let openStyle: string | null = null;
let styleDev: Bp = 'd';

const WEIGHTS: string[][] = [['', 'Default'], ['300', 'Light 300'], ['400', 'Regular 400'],
  ['500', 'Medium 500'], ['600', 'Semibold 600'], ['700', 'Bold 700'],
  ['800', 'Extrabold 800'], ['900', 'Black 900']];
const CASES: string[][] = [['', 'None'], ['uppercase', 'UPPERCASE'],
  ['lowercase', 'lowercase'], ['capitalize', 'Capitalize']];
const TAGS: string[][] = [['', 'Leave as-is'], ['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'],
  ['h4', 'H4'], ['h5', 'H5'], ['h6', 'H6'], ['p', 'Paragraph'], ['div', 'div — not a heading']];
const DEV_ICON: Record<string, string> = { d: 'desktop', t: 'tablet', m: 'mobile' };

/** The expanded editor for one style at one breakpoint. */
function Editor({ t }: { t: TextStyle }) {
  const b = t.css[styleDev] || {};
  const base = t.css.d || {};
  /* away from desktop, the base value shows as a placeholder — so an empty field reads
     as "inherits this" rather than as "nothing" */
  const ph = (k: string) => styleDev === 'd' ? '' : (base[k] || '');
  const bucket = () => (t.css[styleDev] = t.css[styleDev] || {});
  const commit = () => { L.paintCss(); L.save(); };

  const write = (prop: string, raw: string, unit?: string) => {
    L.tx('tsval:' + t.id + prop);
    if (raw === '') delete bucket()[prop];
    else bucket()[prop] = unit ? raw + unit : raw;
    commit();
  };

  /** number-and-unit pair, reading the unit off its own select so the two stay together */
  const Unit = ({ prop, units }: { prop: string; units: string[] }) => {
    const p = C.parseU(b[prop]);
    const u = units.includes(p.u) ? p.u : units[0];
    const push = (root: HTMLElement) => {
      const numEl = root.querySelector('input') as HTMLInputElement;
      const unitEl = root.querySelector('select') as HTMLSelectElement;
      write(prop, String(numEl.value).trim(), unitEl.value);
    };
    return (
      <div class="unit">
        <input class="ctl" type="number" step="any" value={p.n}
          placeholder={C.parseU(ph(prop)).n || 'auto'}
          onInput={e => push((e.target as HTMLElement).parentElement!)}
          onBlur={() => { L.endTx(); repaint('styles'); }} />
        <select class="ctl" value={u}
          onChange={e => { push((e.target as HTMLElement).parentElement!); L.endTx(); }}>
          {units.map(x => <option key={x} value={x}>{x || '—'}</option>)}
        </select>
      </div>
    );
  };

  const Choice = ({ prop, opts, label }: { prop: string; opts: string[][]; label: string }) => (
    <div class="f"><label>{label}</label>
      <select class="ctl" value={b[prop] || ''}
        onChange={e => {
          write(prop, (e.target as HTMLSelectElement).value);
          L.endTx(); repaint('styles');
        }}>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  const colVal = b.color || '';
  const tok = C.refId(colVal) ? C.findColor(C.refId(colVal)!) : null;
  const setColor = (v: string | null) => {
    L.tx('tsval:' + t.id + 'color');
    if (v === null) delete bucket().color; else bucket().color = v;
    L.endTx(); commit(); repaint('styles');
  };

  return (
    <div class="tsedit">
      <div class="pick" style={{ marginBottom: 'var(--gap-2)' }}>
        {(['d', 't', 'm'] as Bp[]).map(d => (
          <button key={d} class={styleDev === d ? 'on' : ''}
            onClick={() => { styleDev = d; repaint('styles'); }}>
            <Icon name={DEV_ICON[d]} size={12} /> {C.DEV_LABEL[d]}
          </button>
        ))}
      </div>

      <div class="row2">
        <div class="f"><label>Size</label><Unit prop="font-size" units={C.U.size} /></div>
        <Choice prop="font-weight" opts={WEIGHTS} label="Weight" />
      </div>
      <div class="row2">
        <div class="f"><label>Line height</label><Unit prop="line-height" units={C.U.line} /></div>
        <div class="f"><label>Letter spacing</label><Unit prop="letter-spacing" units={C.U.track} /></div>
      </div>
      <div class="f"><label>Font</label>
        <FontSelect value={b['font-family'] || ''} ariaLabel="Font" onChange={v => {
          L.tx('tsval:' + t.id + 'font');
          if (v) bucket()['font-family'] = v; else delete bucket()['font-family'];
          L.endTx(); commit(); repaint('styles');
        }} />
      </div>

      {/* the tag is a property of the style itself, not of a breakpoint */}
      {styleDev === 'd' ? (
        <div class="f">
          <label>Default HTML tag <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>
            — applied when a heading takes this style</span></label>
          <select class="ctl" value={t.tag || ''}
            onChange={e => {
              L.tx('tstag:' + t.id);
              const v = (e.target as HTMLSelectElement).value;
              if (v) t.tag = v; else delete t.tag;
              L.endTx(); L.save();
            }}>
            {TAGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      ) : null}

      <div class="row2">
        <Choice prop="text-transform" opts={CASES} label="Transform" />
        <div class="f"><label>Colour</label>
          <div class="clr">
            <span class="sw"><i style={{ background: C.resolveColor(colVal) || 'transparent' }} /></span>
            {tok
              ? <span class="tokchip"><Icon name="link" size={10} /> {tok.name}</span>
              : <input class="ctl hex" value={colVal} placeholder={ph('color') || 'inherit'}
                onInput={e => write('color', (e.target as HTMLInputElement).value.trim())}
                onBlur={() => { L.endTx(); repaint('styles'); }} />}
            <button class="x" title="Clear" onClick={() => setColor(null)}>
              <Icon name="trash" size={11} /></button>
          </div>
          <div class="toks">
            {C.colors().map(c => (
              <button key={c.id} class={'tok' + (tok && tok.id === c.id ? ' on' : '')}
                title={c.name} style={{ background: c.value }}
                onClick={() => setColor(C.cvar(c.id))} />
            ))}
          </div>
        </div>
      </div>

      <div class="note">{styleDev === 'd'
        ? 'The base values. Switch to Tablet or Mobile to override only what differs there.'
        : 'Only what you set here overrides desktop. Empty fields fall through to the base value shown as a placeholder.'}</div>
    </div>
  );
}

function Row({ t }: { t: TextStyle }) {
  const d = t.css.d || {};
  const open = openStyle === t.id;

  /* the preview letters take the style's own weight and size, clamped so a display
     style does not blow the row open */
  const previewSize = Math.min(19, parseInt(d['font-size'] || '16', 10) || 16);

  const remove = async () => {
    const used = C.tsUsage(t.id);
    if (used && !await L.askConfirm('Delete this text style?',
      `<b>${esc(t.name)}</b> is used by ${used} element${used === 1 ? '' : 's'}. They keep `
      + 'their current look — they just stop following the style.', { ok: 'Delete style' })) return;
    C.edit(() => C.styleDelete(t.id));
    if (openStyle === t.id) openStyle = null;
    repaint('styles');
    L.toast('Style deleted, looks kept');
  };

  /* size and weight are editable in the row itself; both write the desktop base, and the
     expanded editor is where breakpoints live */
  const setSize = (raw: string) => {
    L.tx('tssize:' + t.id);
    const base = (t.css.d = t.css.d || {});
    const p = C.parseU(raw.trim());
    if (raw.trim() === '' || p.n === '') delete base['font-size'];
    else base['font-size'] = p.n + (p.u || 'px');      // a bare number means px
    L.paintCss(); L.save();
  };

  return (
    <>
      <div class={'arow' + (open ? ' open' : '')}>
        <span style={{
          flex: '0 0 40px', textAlign: 'center', color: 'var(--text)',
          fontWeight: d['font-weight'] || 500, fontSize: previewSize + 'px'
        }}>Aa</span>
        <span class="an">
          <input class="ctl" value={t.name} style={{ fontSize: 'var(--fs-2)', fontWeight: 600 }}
            onInput={e => {
              L.tx('tsname:' + t.id);
              const s = C.findStyle(t.id);
              if (s) { s.name = (e.target as HTMLInputElement).value; L.save(); }
            }} onBlur={L.endTx} aria-label="Text style name" />
        </span>
        <input class="ctl" value={d['font-size'] || ''} placeholder="auto"
          title="Base size — expand the row to set a Tablet or Mobile override"
          style={{ width: '74px', flex: '0 0 74px', fontFamily: 'var(--mono)', fontSize: 'var(--fs-1)' }}
          onInput={e => setSize((e.target as HTMLInputElement).value)}
          onBlur={() => { L.endTx(); repaint('styles'); }} />
        <select class="ctl" title="Base weight"
          style={{ width: '118px', flex: '0 0 118px', fontSize: 'var(--fs-1)' }}
          value={d['font-weight'] || ''}
          onChange={e => {
            L.tx('tsweight:' + t.id);
            const base = (t.css.d = t.css.d || {});
            const v = (e.target as HTMLSelectElement).value;
            if (v === '') delete base['font-weight']; else base['font-weight'] = v;
            L.endTx(); L.paintCss(); L.save(); repaint('styles');
          }}>
          {WEIGHTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button class={'iconbtn' + (open ? ' flip' : '')}
          title={open ? 'Close' : 'Line height, letter spacing, colour, and per-breakpoint overrides'}
          onClick={() => { openStyle = open ? null : t.id; styleDev = 'd'; repaint('styles'); }}>
          <Icon name="caret" size={13} /></button>
        <button class="iconbtn" title="Delete — elements keep the look" onClick={remove}>
          <Icon name="trash" size={13} /></button>
      </div>
      {open ? <Editor t={t} /> : null}
    </>
  );
}

export function TextStyles() {
  const add = async () => {
    const name = await L.askText('New text style', 'Style name', 'New style', { ok: 'Add style' });
    if (name === null) return;
    let id = '';
    C.edit(() => { id = C.styleAdd(name); });
    openStyle = id; styleDev = 'd';
    repaint('styles');
    L.toast('Text style created — set its values below');
  };

  return (
    <>
      {C.styles().map(t => <Row key={t.id} t={t} />)}
      <button class="btn block" onClick={add}>
        <Icon name="plus" size={12} /> Add text style
      </button>
    </>
  );
}

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
