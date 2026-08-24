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

/* `askConfirm` takes HTML, so the one value interpolated into it is escaped by hand — the same
   reason Add.tsx has this line. */
const esc = (v: string) => String(v ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

/** A collapsible group. Its open state is keyed by widget type and title, so folding
    Spacing away on a Section does not fold it on every Heading too. */
function Group({ title, n, items, gk }: { title: string; n: PcNode; items?: Control[]; gk?: string; children?: any }) {
  const key = gk || (n.type + ':' + title);
  const closed = C.state.ui.open[key] === false;
  /* `when` lets a control depend on the node: a background's position appears once
     there is a background, the collection filter's operator once a field is chosen. */
  const shown = items ? items.filter(c => !c.when || c.when(n)) : null;
  /* A group whose every control is out of scope for this widget is not an empty group,
     it is no group — a heading has no Background section to collapse. */
  if (shown && !shown.length) return null;
  return (
    <div class={'group' + (closed ? ' closed' : '')}>
      <div class="gh" onClick={() => { C.state.ui.open[key] = closed; repaint('right'); }}>
        <Icon name="caret" size={10} /> {title}
      </div>
      <div class="gb">
        {shown ? shown.map((c, i) => <Ctl key={c.t + (c.c || c.k || i)} n={n} c={c} />) : null}
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
          <Icon name="caretUp" size={13} />
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
        ? <>Reaches all {C.classUsage(target)} element{C.classUsage(target) === 1 ? '' : 's'} using it.</>
        : 'This element only.'}</div>
    </Panel>
  );
}

/* Which interactive state the Style tab writes to. It sits inside Styling, under the class
   picker, because it is the same kind of question: not *what* the value is but *where* it
   goes. Both pickers compose — a hover on a class restyles every card's hover at once.

   Resting is not a state, it is the absence of one, which is why it is the empty string and
   why every control wrote there before this existed. */
/* Above every group, because that is what it governs: every control on the tab writes to
   whichever state is picked here. It spent a version at the foot of the Styling group, under a
   note, where it read as a footnote to the class picker rather than as the mode for everything
   below it.

   A `.pick` rather than a `.tabs`, too. Tabs are how this panel navigates — Content, Style,
   Advanced — and a second row of them directly beneath the first read as more navigation. A
   segmented control with a label is what the panel uses for a setting, which is what this is.

   Shown on Advanced as well as Style, since both tabs write CSS. Hiding it on one while it was
   still in force is the hidden mode this is meant to avoid. */
/* Which variant an instance is. Only drawn when the definition declares one, and only on an
   instance — a definition with no variants should not carry a control that says "Default" and
   nothing else.

   Above the properties rather than among them, because it decides several of them: a property
   whose value comes from the variant reads differently once you know which variant is on. And
   "Save as variant" lives here rather than in the Components tab for the reason a text style is
   made from an element — the values are already in front of somebody who has just got them
   right, and a dialog to retype them is how a variant ends up not quite matching the thing it
   was meant to capture. */
function VariantPick({ n }: { n: PcNode }) {
  const def = C.findComponent(n.use);
  if (!def) return null;
  const list = C.variantsOf(def);
  const own = C.instOwn(n).length;
  if (!list.length && !own) return null;

  const set = (vid: string) => {
    C.edit(() => C.variantSet(n, vid || null));
    L.paint(); L.save();
    repaint('right');
  };
  const save = async () => {
    const name = await L.askText('Save as variant', 'Name', 'Variant ' + (list.length + 1));
    if (!name) return;
    let made: string | null = null;
    C.edit(() => { made = C.variantFromInstance(n, name); });
    L.paint(); L.save();
    L.toast(made ? `“${name}” — every instance can be one now` : 'Nothing to save yet');
    repaint('right');
  };
  const reset = () => {
    C.edit(() => C.instOwn(n).forEach(k => C.instSet(n, k, undefined)));
    L.paint(); L.save();
    repaint('right');
  };

  return (
    <div class="f">
      <label>Variant</label>
      {list.length ? (
        <select value={n.variant || ''} onChange={e => set((e.target as HTMLSelectElement).value)}>
          <option value="">Default</option>
          {list.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      ) : null}
      <div class="row" style={{ marginTop: 'var(--gap-1)' }}>
        <button class="btn tiny" onClick={save} disabled={!own && !n.variant}>Save as variant</button>
        {own
          ? <button class="btn tiny" onClick={reset}>
            {n.variant ? 'Back to the variant' : 'Back to the defaults'}
          </button>
          : null}
      </div>
      {own
        ? <div class="note">
          {own === 1 ? 'One value is' : own + ' values are'} set on this instance
          {n.variant ? ', overriding the variant.' : '.'}
        </div>
        : null}
    </div>
  );
}

function StatePick() {
  const cur = C.state.ui.st || '';
  const set = (k: string) => { C.state.ui.st = k as '' | 'hover' | 'focus'; repaint('right'); };
  return (
    <div class={'f statepick' + (cur ? ' on' : '')}>
      <label>State</label>
      <div class="pick">
        <button class={cur ? '' : 'on'} onClick={() => set('')}>Resting</button>
        {C.STATES.map(([k, label]) => (
          <button key={k} class={cur === k ? 'on' : ''} onClick={() => set(k)}>{label}</button>
        ))}
      </div>
      {/* No note. It had one of 245 characters restating what the lit segment says — and a
          paragraph under every control is what makes a panel read as padding. */}
    </div>
  );
}

/* Everything that moves, in one group. It held only the scroll animation, while Transition sat
   two groups up under Effects and the state switcher told you to go and find it — three places
   for one subject, and the state switcher and this group both read as "motion" from their names
   alone. They are two different questions and now they are two labelled halves of one group:
   how a change is animated, and how the element arrives.

   Its own group rather than controls in a widget definition, because every element gets it —
   the same reason the Advanced tab's list lives out here. The scroll settings are not `Control`s
   either: they live on `n.anim` rather than in `props` or CSS, and bending `applyC` to write a
   fourth kind of destination to gain four rows of markup would have been the wrong trade. The
   timing fields appear once an animation is chosen, for the reason the collection filter's do. */
/* A function, not a constant. `C` is null until `install()` runs, and a module-level constant
   that reaches into it is evaluated when the bundle loads — which threw, took the whole UI
   bundle with it, and left the app rendering no pages at all. Every other control list here is
   a function for the same reason; this one wanted to be a constant and could not be. */
const transitionCtl = (): Control => ({
  t: 'opt', c: 'transition', label: 'Transition', opts: C.TRANSITIONS, ph: 'all .25s ease',
  note: 'Animates a hover, a focus, or a class change.'
});

function Motion({ n }: { n: PcNode }) {
  const a = n.anim || {};
  const set = (patch: Record<string, unknown>) => {
    C.edit(() => {
      const next = { ...(n.anim || {}), ...patch };
      /* dropped outright when there is nothing left in it, so a project carries no empty blocks
         and `animUsed` cannot be fooled by one */
      if (!next.name) delete n.anim; else n.anim = next as typeof n.anim;
    });
    repaint('right');
  };
  const time = (k: 'dur' | 'delay', label: string, ph: string) => (
    <div class="f"><label>{label}</label>
      <input class="ctl" value={(a as Record<string, string>)[k] || ''} placeholder={ph}
        onChange={e => set({ [k]: (e.target as HTMLInputElement).value.trim() })} /></div>
  );

  return (
    <Panel title="Motion" n={n} gk={n.type + ':Motion'}>
      <div class="plabel">When it changes</div>
      <Ctl n={n} c={transitionCtl()} />

      <div class="plabel">When it enters the view</div>
      <div class="f"><label>Animation</label>
        <select class="ctl" value={a.name || ''}
          onChange={e => set({ name: (e.target as HTMLSelectElement).value })}>
          <option value="">— none —</option>
          {C.ANIM_NAMES.map(x => (
            <option key={x} value={x}>{x.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase())}</option>
          ))}
        </select>
        {a.name ? <div class="note">The canvas holds still — use Preview.</div> : null}
      </div>
      {a.name ? (
        <>
          {time('dur', 'Duration', '0.6s')}
          {time('delay', 'Delay', '0s')}
          <div class="f"><label>Easing</label>
            <input class="ctl" value={a.ease || ''} placeholder="ease-in-out"
              onChange={e => set({ ease: (e.target as HTMLInputElement).value.trim() })} /></div>
          <label class="swrow" style={{ marginTop: 'var(--gap-1)' }}>
            <input type="checkbox" checked={!!a.once}
              onChange={e => set({ once: (e.target as HTMLInputElement).checked ? 1 : 0 })} />
            <span>Only the first time it comes into view</span>
          </label>
        </>
      ) : null}
    </Panel>
  );
}

/* The Advanced tab's fixed control list. It is not part of any widget definition
   because every widget gets the same one. */
const advControls = (n: PcNode): Control[] => [
  { t: 'text', k: '_id', label: 'HTML id', ph: C.autoId(n), note: 'What a link anchor targets. Auto unless you set one.' },
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
        <button class="btn block" style={{ marginTop: 'var(--gap-1)' }}
          onClick={() => L.bindModal(n.id)}><Icon name="cms" size={13} /> Bind the fields inside…</button>
      ) : null}
      <div class="note">{col
        ? 'Select something inside, then bind a field to it.'
        : C.collections().length
          ? 'Point this at a collection to bind fields inside it.'
          : <>No collections yet — make one in <b>CMS</b>.</>}</div>
    </Panel>
  );
}

const DEV_ICON: Record<string, string> = { d: 'desktop', t: 'tablet', m: 'mobile' };

/* A component's declared properties, listed where the component itself is.

   Nothing listed them. The badge on a control declares one and binds it in a single click,
   which is the right way to *make* one — and it left no way to see what a component declares,
   rename a property, reorder them or remove one. The first component built with this ended up
   with properties called "Heading text" and "Rich text", named after the controls they came
   from, which is what a guess made at the moment of declaring looks like on nine instances.

   Shown on the definition's root, because that is the node that stands for the component. The
   order is the order of the controls on every instance's panel, so moving one is a real
   decision rather than bookkeeping. */
function ComponentProps({ n }: { n: PcNode }) {
  const cid = C.state.ui.cedit;
  if (C.state.ui.mode !== 'component' || !cid) return null;
  const def = C.findComponent(cid);
  if (!def || def.node.id !== n.id) return null;
  const list = def.props || [];

  const rename = async (k: string, label: string) => {
    const name = await L.askText('Rename property', 'Label', label);
    if (!name) return;
    C.edit(() => C.propRename(cid, k, name));
    repaint('right');
  };
  const move = (k: string, dir: number) => {
    C.edit(() => C.propMove(cid, k, dir));
    repaint('right');
  };
  const remove = async (k: string, label: string) => {
    const pr = C.findProp(def, k);
    const used = C.componentUsage(cid);
    const ok = await L.askConfirm('Remove this property?',
      `<b>${esc(label)}</b> stops varying between instances. Every element that reads it goes back `
      + `to the value written in the definition`
      + (used ? `, on ${used === 1 ? 'the one instance' : 'all ' + used + ' instances'}.` : '.'),
      { ok: 'Remove property' });
    if (!ok) return;
    C.edit(() => C.propDelete(cid, k));
    L.paint(); L.save();
    repaint('right');
    void pr;
  };

  return (
    <Panel title="Properties" n={n}>
      {list.length ? list.map((pr, i) => (
        <div class="lrow" key={pr.k} style={{ paddingLeft: 0, paddingRight: 0 }}>
          <span class="nm" style={{ cursor: 'pointer' }} onClick={() => rename(pr.k, pr.label)}
            title="Rename">
            <b>{pr.label}</b> <small style={{ opacity: .6 }}>{pr.t}</small>
          </span>
          <button class="bx" title="Move up" disabled={i === 0}
            onClick={() => move(pr.k, -1)}><Icon name="toTop" size={11} /></button>
          <button class="bx" title="Move down" disabled={i === list.length - 1}
            onClick={() => move(pr.k, 1)}><Icon name="toBottom" size={11} /></button>
          <button class="bx" title="Remove this property"
            onClick={() => remove(pr.k, pr.label)}><Icon name="trash" size={11} /></button>
        </div>
      )) : (
        <div class="note">
          Nothing varies between instances yet. Every control that holds a value has a
          <b> component badge</b> beside its label — press it to make that value a property.
        </div>
      )}
    </Panel>
  );
}

/* "Show only if" — a condition on a value rather than on a breakpoint.

   It sits in Visibility because that is the question it answers, next to the three breakpoint
   toggles: "not at this width" and "not for this item" are the two ways an element can be
   absent, and an author looking for one will look where the other is.

   The sources it offers are the two a binding can name — a field on the collection in scope,
   and a property of the component being edited. Both, when both apply. Nothing to offer means
   the control is not drawn: a condition with no value to test is a switch that does nothing. */
function ShowIf({ n }: { n: PcNode }) {
  const scope = C.bindScope(n.id);
  const cd = C.state.ui.mode === 'component' ? C.findComponent(C.state.ui.cedit) : null;
  const fields = scope ? C.fieldPaths(scope.col) : [];
  const props = cd ? (cd.props || []) : [];
  if (!fields.length && !props.length) return null;

  const cur = n.showIf || null;
  const key = cur ? cur.bind.src + ':' + cur.bind.path : '';
  const sources: [string, string][] = [
    ['', '— Always show —'],
    ...fields.map(f => [`field:${f.path}`, `${f.label} · ${f.type}`] as [string, string]),
    ...props.map(pr => [`prop:${pr.k}`, `${pr.label} · property`] as [string, string])
  ];

  const write = (k: string, op: string, value: string) => {
    C.edit(() => {
      if (!k) { C.condSet(n, null); return; }
      const i = k.indexOf(':');
      C.condSet(n, {
        bind: { src: k.slice(0, i) as 'field' | 'prop', path: k.slice(i + 1) },
        op: op as 'set' | 'empty' | 'eq' | 'ne',
        value
      });
    });
    L.paint(); L.save();
    repaint('right');
  };

  return (
    <>
      <div class="f">
        <label>Show only if</label>
        <select value={key} onChange={e => write((e.target as HTMLSelectElement).value,
          cur ? cur.op : 'set', cur && cur.value ? cur.value : '')}>
          {sources.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>
      {cur ? (
        <div class="f">
          <label>Condition</label>
          <select value={cur.op} onChange={e => write(key, (e.target as HTMLSelectElement).value,
            cur.value || '')}>
            {C.COND_OPS.map(([op, label]) => <option key={op} value={op}>{label}</option>)}
          </select>
          {cur.op === 'eq' || cur.op === 'ne' ? (
            <input class="ctl" style={{ marginTop: 'var(--gap-1)' }} value={cur.value || ''}
              placeholder="Value to compare"
              onChange={e => write(key, cur.op, (e.target as HTMLInputElement).value)} />
          ) : null}
          <div class="note">
            Dashed blue on the canvas when it is not showing for the item you are looking at.
            Left out of the exported page entirely.
          </div>
        </div>
      ) : null}
    </>
  );
}

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
      <ShowIf n={n} />
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

  const n = h.node, d = C.DEF[n.type];
  /* Forced, not merely defaulted: `stab` persists, so a session that was on Style before the
     role was known would otherwise render a Style pane with no tab row to leave it by. */
  const tab = L.canStructure() ? C.state.ui.stab : 'content';
  const style = d.controls.style || [];
  /* The Content tab is not the same line the server draws. It holds a heading's text, and
     also its HTML tag, its text style and its alignment — a tag is structure and the other
     two write CSS, so a content account offered them would be offered a refused save. The
     line that matches the server is `contentKeys`: a control writes content when it writes
     a declared text slot and no CSS property. */
  /* `contentControls` rather than the widget's own list: an instance's content is the
     properties its definition declares, and the widget it happens to be rooted on has nothing
     to say about it. Same reader for the content-role filter, for the same reason. */
  const all = C.contentControls(n);
  const keys = L.canStructure() ? null : C.contentKeysOf(n);
  const content = keys ? all.filter(c => !c.c && !!c.k && keys.has(c.k)) : all;
  const many = C.selIds().length > 1;

  return (
    <>
      <Head h={h} />
      <ClipStrip />
      {/* A content account gets Content and nothing else: the other two tabs write CSS and
          the server refuses CSS from them. One tab is no tab, so the row goes entirely. */}
      {L.canStructure() ? (
        <div class="tabs">
          {[['content', 'Content'], ['style', 'Style'], ['advanced', 'Advanced']].map(([k, label]) => (
            <button key={k} class={tab === k ? 'on' : ''}
              onClick={() => { C.state.ui.stab = k; repaint('right'); }}>{label}</button>
          ))}
        </div>
      ) : null}
      <div class="pane">
        {tab === 'content' || many ? null : <StatePick />}
        {tab === 'content' && n.use ? <VariantPick n={n} /> : null}
        {tab === 'content' ? <ComponentProps n={n} /> : null}
        {tab === 'content' ? (
          content.length
            ? <Group title={n.use ? C.nameOf(n) : d.label} n={n} items={content} />
            : <Panel title={n.use ? C.nameOf(n) : d.label} n={n}>
              {/* An instance with no properties is not a mistake — a component can be a fixed
                  piece of layout somebody wanted in twelve places. It is worth saying where
                  properties come from, because the answer is not on this panel. */}
              {n.use
                ? <div class="note">
                  Nothing varies between instances yet. Open this component in the
                  <b> Components</b> tab and mark what should.
                </div>
                : <div class="note">No content options — use the Style tab.</div>}
            </Panel>
        ) : tab === 'style' ? (
          <>
            <StylingTarget n={n} />
            {style.length ? <Group title={d.styleLabel || d.label} n={n} items={style} /> : null}
            {/* A group appears because the widget declares the capability it belongs to, not
                because a predicate excludes nine widget types by name. A heading has no
                `decoration`, so there is no Background group to hide controls inside. */}
            {C.COMMON_STYLE.filter(g => C.canDo(n, g.cap))
              .map(g => <Group key={g.g} title={g.g} n={n} items={g.items} />)}
            {/* Last, and only for a single selection: motion is one value per element and a
                group that wrote to several at once would be lying about what it edits.

                It asks the registry too. Every widget declares `animation` today, so this
                changes nothing on screen — and a declared capability that nothing reads is a
                wish rather than a description, which is the failure the registry exists to
                avoid. The day a widget should not move, saying so will be enough. */}
            {many || !C.canDo(n, 'animation') ? null : <Motion n={n} />}
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
