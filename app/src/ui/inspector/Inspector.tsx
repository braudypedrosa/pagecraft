/* The inspector.

   The last panel across, and the one the whole port was for. What stood here was 846
   lines split three ways: `renderRight` built the panel as a string, `ctlHtml` built
   each field as a string and numbered it `data-ci="i"`, and `bindRight` found the
   fields again by that number — through a module-level `CUR` array rebuilt on every
   render — to attach behaviour. build.mjs carries a guard asserting every `ctlHtml`
   case has a matching `bindRight` case, because they could drift apart and once did.

   None of that survives. A control's handlers are written beside its markup, `CUR` and
   `data-ci` are gone, and the guard has nothing left to check. */
import { useEffect } from 'preact/hooks';
import { C, L, repaint } from '../ctx';
import { Icon } from '../Icon';
import { Ctl } from './Controls';
import type { Control, Node as PcNode } from '../../core/types';

/** A collapsible group. Its open state is keyed by widget type and title, so folding
    Spacing away on a Section does not fold it on every Heading too. */
function Group({ title, n, items, gk }: { title: string; n: PcNode; items?: Control[]; gk?: string; children?: any }) {
  const key = gk || (n.type + ':' + title);
  const closed = C.state.ui.open[key] === false;
  return (
    <div class={'group' + (closed ? ' closed' : '')}>
      <div class="gh" onClick={() => { C.state.ui.open[key] = closed; repaint('right'); }}>
        <Icon name="caret" size={10} /> {title}
      </div>
      <div class="gb">
        {/* `when` lets a control depend on the node: the collection filter's operator and
            value appear once a field is chosen and not before. */}
        {items ? items.filter(c => !c.when || c.when(n))
          .map((c, i) => <Ctl key={c.t + (c.c || c.k || i)} n={n} c={c} />) : null}
      </div>
    </div>
  );
}

/** Same, but for a group whose body is markup rather than a control list. */
function Panel({ title, n, gk, children }: { title: string; n: PcNode; gk?: string; children: any }) {
  const key = gk || (n.type + ':' + title);
  const closed = C.state.ui.open[key] === false;
  return (
    <div class={'group' + (closed ? ' closed' : '')}>
      <div class="gh" onClick={() => { C.state.ui.open[key] = closed; repaint('right'); }}>
        <Icon name="caret" size={10} /> {title}
      </div>
      <div class="gb">{children}</div>
    </div>
  );
}

function Head({ h }: { h: NonNullable<ReturnType<typeof C.locate>> }) {
  const n = h.node, d = C.DEF[n.type];
  const ids = C.selIds(), many = ids.length > 1;
  /* With several picked, the fields still come from the primary — it is the one type
     whose controls are guaranteed to exist — and applyC fans each edit over the set.
     The header has to say so, or the count is the only clue that a slider just moved
     twelve things. */
  const kinds = [...new Set(C.selNodes().map(x => C.DEF[x.type].label))];
  return (
    <div class="sHead">
      <div class="ic"><Icon name={d.icon} size={14} /></div>
      <div class="tt">
        <b>{many ? ids.length + ' selected' : d.label}</b>
        <small>{many ? kinds.join(' · ') : '#' + C.domIdOf(n)}</small>
      </div>
      <button class="iconbtn" title="Copy this element's styling (⌘⇧C)"
        onClick={() => { C.copyStyles(n.id); L.toast('Styles copied from ' + C.styleClip.from); repaint('right'); }}>
        <Icon name="pipette" size={13} />
      </button>
      {!many && h.parent ? (
        <button class="iconbtn" title="Select parent (esc)"
          onClick={() => { const at = C.locate(n.id); L.select(at && at.parent ? at.parent.id : null); }}>
          <Icon name="caret" size={13} />
        </button>
      ) : null}
    </div>
  );
}

function ClipStrip() {
  if (!C.styleClip.css) return null;
  const ids = C.selIds(), many = ids.length > 1;
  const paste = () => {
    let k = 0;
    C.edit(() => { k = C.pasteStylesMany(C.selIds()); });
    L.toast(k > 1 ? `Styles pasted onto ${k} elements` : k ? 'Styles pasted' : 'Nothing changed');
  };
  return (
    <div class="stclip">
      <Icon name="pipette" size={12} />
      <span class="cn">Holding <b>{C.styleClip.from}</b></span>
      <button class="btn tiny" onClick={paste}
        title={`Replace the styling of ${many ? 'all ' + ids.length : 'this element'} (⌘⇧V)`}>
        Paste{many ? ' to ' + ids.length : ''}
      </button>
      <button class="x" title="Forget it"
        onClick={() => { C.styleClip.css = null; repaint('right'); L.toast('Style clipboard cleared'); }}>
        <Icon name="trash" size={11} />
      </button>
    </div>
  );
}

/** Which object styling lands on: this element, or one of its classes. */
function StylingTarget({ n }: { n: PcNode }) {
  const applied = C.nodeClasses(n);
  const target = C.state.ui.target && C.findClass(C.state.ui.target)
    && applied.some(c => c.id === C.state.ui.target) ? C.state.ui.target : '';
  const pool = C.classes().filter(c => !applied.some(x => x.id === c.id));
  const pick = (id: string) => { C.state.ui.target = id; repaint('right'); };

  const add = async (v: string, el: HTMLSelectElement) => {
    if (!v) return;
    if (v === '__new') {
      const name = await L.askText('New class', 'Class name', C.DEF[n.type].label,
        { ok: 'Create class', note: 'Restyling it reaches every element using it.' });
      if (name === null) { el.value = ''; return; }
      C.edit(() => { C.state.ui.target = C.classFrom(n, name); });
      L.toast('Class created from this element');
      return;
    }
    C.edit(() => { C.classApply(n, v); C.state.ui.target = v; });
  };

  return (
    <Panel title="Styling" n={n} gk={n.type + ':Styling'}>
      <div class="tgrow">
        <button class={'tg' + (target ? '' : ' on')} onClick={() => pick('')}>This element</button>
      </div>
      {applied.map(c => {
        const uses = C.classUsage(c.id);
        return (
          <div class="tgrow" key={c.id}>
            <button class={'tg' + (target === c.id ? ' on' : '')} onClick={() => pick(c.id)}>.{c.id}</button>
            <small>{uses} use{uses === 1 ? '' : 's'}</small>
            <button class="tgx" title="Remove this class from the element"
              onClick={() => {
                if (C.state.ui.target === c.id) C.state.ui.target = '';
                C.edit(() => C.classRemove(n, c.id));
              }}><Icon name="trash" size={12} /></button>
          </div>
        );
      })}
      <select class="ctl" style={{ marginTop: 'var(--gap-1)' }} value=""
        onChange={e => add((e.target as HTMLSelectElement).value, e.target as HTMLSelectElement)}>
        <option value="">Add a class…</option>
        {pool.map(c => (
          <option key={c.id} value={c.id}>.{c.id} · {C.classUsage(c.id)} use{C.classUsage(c.id) === 1 ? '' : 's'}</option>
        ))}
        <option value="__new">＋ New class from this element…</option>
      </select>
      <div class="note">{target
        ? <>Editing <b>.{target}</b> — every change here reaches all {C.classUsage(target)} element
          {C.classUsage(target) === 1 ? '' : 's'} using it.</>
        : applied.length
          ? 'Editing this element only. Its classes are listed above; pick one to edit it instead.'
          : 'Editing this element only. Save its styling as a class to reuse it elsewhere.'}</div>

      <StatePick />
    </Panel>
  );
}

/* Which interactive state the Style tab writes to. It sits inside Styling, under the class
   picker, because it is the same kind of question: not *what* the value is but *where* it
   goes. Both pickers compose — a hover on a class restyles every card's hover at once.

   Resting is not a state, it is the absence of one, which is why it is the empty string and
   why every control wrote there before this existed. */
function StatePick() {
  const cur = C.state.ui.st || '';
  const set = (k: string) => { C.state.ui.st = k as '' | 'hover' | 'focus'; repaint('right'); };
  return (
    <>
      <div class="tabs" style={{ marginTop: 'var(--gap-2)' }}>
        <button class={cur ? '' : 'on'} onClick={() => set('')}>Resting</button>
        {C.STATES.map(([k, label]) => (
          <button key={k} class={cur === k ? 'on' : ''} onClick={() => set(k)}>{label}</button>
        ))}
      </div>
      {cur ? (
        <div class="note">
          Editing the <b>{cur === 'hover' ? 'hover' : 'keyboard-focus'}</b> state. Only what you
          set here changes on {cur === 'hover' ? 'hover' : 'focus'}; everything else stays as it
          rests. Give it a <b>Transition</b> on the Advanced tab and it animates.
        </div>
      ) : null}
    </>
  );
}

/* The Advanced tab's fixed control list. It is not part of any widget definition
   because every widget gets the same one. */
const advControls = (n: PcNode): Control[] => [
  { t: 'text', k: '_id', label: 'HTML id', ph: C.autoId(n), note: 'Auto-generated unless you set one. This is what a link anchor targets.' },
  { t: 'text', k: '_cls', label: 'CSS classes', ph: 'hero card--dark' },
  { t: 'select', c: 'position', label: 'Position', opts: [['', 'Static'], ['relative', 'Relative'], ['absolute', 'Absolute'], ['sticky', 'Sticky'], ['fixed', 'Fixed']] },
  { t: 'unit', c: 'top', label: 'Top', r: 1, units: ['px', '%', 'rem'] },
  { t: 'unit', c: 'z-index', label: 'Z-index', units: [''] },
  { t: 'select', c: 'overflow', label: 'Overflow', opts: [['', 'Visible'], ['hidden', 'Hidden'], ['auto', 'Auto']] },
  { t: 'unit', c: 'max-width', label: 'Max width', r: 1, units: ['px', 'rem', '%', 'ch'] },
  { t: 'area', k: '_css', label: 'Custom CSS', rows: 4, ph: '& { … }' }
];

function ContentSource({ n }: { n: PcNode }) {
  const col = n.src ? C.findCollection(n.src) : null;
  return (
    <Panel title="Content source" n={n}>
      <select class="ctl" value={n.src || ''}
        onChange={e => {
          const v = (e.target as HTMLSelectElement).value;
          C.edit(() => C.srcSet(n, v));
          /* not "Bound to X" — that is what binding a *field* does, and reusing the
             word here is most of why setting a source reads as though it should have
             changed something on its own */
          L.toast(v ? C.findCollection(v)!.name + ' is the scope — now bind a field' : 'Content source cleared');
        }}>
        <option value="">— None —</option>
        {C.collections().map(c => (
          <option key={c.id} value={c.id}>{c.name} · {c.items.length} item{c.items.length === 1 ? '' : 's'}</option>
        ))}
      </select>
      {col ? (
        <button class="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--gap-1)' }}
          onClick={() => L.bindModal(n.id)}><Icon name="cms" size={13} /> Bind the fields inside…</button>
      ) : null}
      <div class="note">{col
        ? <>Nothing on the canvas changes yet — this only opens the scope. Select something
          inside and click the badge beside a field to take its value from <b>{col.name}</b>.
          The bar above shows which item is previewed; to repeat the whole set instead,
          use a <b>Collection list</b>.</>
        : C.collections().length
          ? 'Point this at a collection and everything inside it can bind to a field.'
          : <>No collections yet — make one in <b>CMS</b>.</>}</div>
    </Panel>
  );
}

const DEV_ICON: Record<string, string> = { d: 'desktop', t: 'tablet', m: 'mobile' };

function Visibility({ n }: { n: PcNode }) {
  return (
    <Panel title="Visibility" n={n}>
      {(['d', 't', 'm'] as const).map(b => (
        <div class="tog-row" key={b} style={{ marginBottom: 'var(--gap-1)' }}>
          <span><Icon name={DEV_ICON[b]} size={12} /> Hide on {C.DEV_LABEL[b]}</span>
          <button class={'sw-tog' + (n.hide && n.hide[b] ? ' on' : '')}
            onClick={() => C.edit(() => { n.hide = n.hide || {}; n.hide[b] = !n.hide[b]; })}><i /></button>
        </div>
      ))}
      <div class="note">Ghosted on the canvas, so you can still select them.</div>
    </Panel>
  );
}

export function Inspector() {
  const h = C.state.ui.sel ? C.locate(C.state.ui.sel) : null;

  /* Joining or leaving changes the canvas width, so the selection frame and the px
     readout need recomputing once layout settles. select() paints the HUD before this
     runs, which is why it is an effect rather than inline. */
  useEffect(() => {
    const host = document.getElementById('right');
    if (!host) return;
    const want = !h;
    if (host.hidden === want) return;
    host.hidden = want;
    requestAnimationFrame(() => { L.layoutCanvas(); L.positionHud(); L.renderDim(); });
  });

  /* With nothing selected there is nothing to inspect, so the panel leaves and the
     canvas takes the space. What the empty state used to hold — the shortcut table —
     lives in the ? dialog, which is always reachable. */
  if (!h) return null;

  const n = h.node, d = C.DEF[n.type], tab = C.state.ui.stab;
  const content = d.controls.content || [];
  const style = d.controls.style || [];
  const many = C.selIds().length > 1;

  return (
    <>
      <Head h={h} />
      <ClipStrip />
      <div class="tabs">
        {[['content', 'Content'], ['style', 'Style'], ['advanced', 'Advanced']].map(([k, label]) => (
          <button key={k} class={tab === k ? 'on' : ''}
            onClick={() => { C.state.ui.stab = k; repaint('right'); }}>{label}</button>
        ))}
      </div>
      <div class="pane">
        {tab === 'content' ? (
          content.length
            ? <Group title={d.label} n={n} items={content} />
            : <Panel title={d.label} n={n}>
              <div class="note">No content options — use the Style tab.</div>
            </Panel>
        ) : tab === 'style' ? (
          <>
            <StylingTarget n={n} />
            {style.length ? <Group title="Typography & fill" n={n} items={style} /> : null}
            {C.COMMON_STYLE.map(g => <Group key={g.g} title={g.g} n={n} items={g.items} />)}
          </>
        ) : (
          <>
            <Group title="Identity & layout" n={n} items={advControls(n)} />
            {d.level < 4 ? <ContentSource n={n} /> : null}
            <Visibility n={n} />
          </>
        )}
      </div>
      <div class="sFoot">
        <button class="btn" onClick={() => L.runAct('dup', C.selIds())}>
          <Icon name="copy" size={13} /> Duplicate{many ? ' all' : ''}</button>
        <button class="btn danger" onClick={() => L.runAct('del', C.selIds())}>
          <Icon name="trash" size={13} /> Delete{many ? ' all' : ''}</button>
      </div>
    </>
  );
}
