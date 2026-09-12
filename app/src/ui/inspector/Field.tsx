/* The frame every control sits in: its label, its two badges, and its note.

   The badges are the reason this is one component rather than markup repeated 22
   times. The responsive badge has to say whether *this* breakpoint owns the value, not
   whether a value exists — a mobile field inheriting the desktop size is not an
   override, and drawing it as one is how you end up clearing something that was never
   set. The binding badge stays live even when the control itself is inert, because
   unbinding is the one thing you still need to do to a bound field. */
import { C, L, repaint } from '../ctx';
import { Icon } from '../Icon';
import { bound, writer } from './ctl';
import type { Control, Node as PcNode } from '../../core/types';
import { useId } from 'preact/hooks';
import { cloneElement, Fragment, isValidElement, toChildArray } from 'preact';

/** Associate native leaves with this field without replacing their DOM nodes. Composite
 * parts declare a suffix; badge actions never become part of the input's name. */
function labelControls(children: any, label: string, id: string, help?: string, path = '', ids: string[] = []): any {
  return toChildArray(children).map((child, index) => {
    if (!isValidElement(child) || (typeof child.type !== 'string' && child.type !== Fragment)) return child;
    const props = child.props as any;
    const key = `${path}-${index}`;
    const leaf = typeof child.type === 'string' && ['input', 'textarea', 'select'].includes(child.type);
    const part = props['data-field-part'];
    if (leaf) ids.push(props.id || `${id}${key}`);
    return cloneElement(child, {
      ...(leaf ? {
        id: props.id || `${id}${key}`,
        ...(!props['aria-label'] && !props['aria-labelledby']
          ? part ? { 'aria-label': `${label} ${part}` } : { 'aria-labelledby': id } : {}),
        'aria-describedby': [props['aria-describedby'], help].filter(Boolean).join(' ') || undefined,
      } : {}),
      ...(props.children != null ? { children: labelControls(props.children, label, id, help, key, ids) } : {}),
    });
  });
}

const DEV_ICON: Record<string, string> = { d: 'desktop', t: 'tablet', m: 'mobile' };

const BOX_SIDES = ['top', 'right', 'bottom', 'left'];

/** Whether this exact editing layer owns a value. Inherited values are still shown by the
 * control, but they are already at their default for this layer and have nothing to reset. */
function ownsValue(n: PcNode, c: Control) {
  if (!c.c) return false;
  const src = C.stRead(C.tgtObj(n));
  const bag = src[C.dk()] || {};
  if (c.paint) return bag[c.c!] !== undefined
    || /^linear-gradient\(/i.test(String(bag['background-image'] || ''))
    || /^linear-gradient\(/i.test(String(bag.background || ''));
  return c.t === 'box'
    ? bag[c.c] !== undefined || BOX_SIDES.some(s => bag[c.c + '-' + s] !== undefined)
    : bag[c.c] !== undefined;
}

function ResponsiveBadge({ n, c }: { n: PcNode; c: Control }) {
  const dev = C.dk();
  /* A box control writes `padding-top` and friends, never `padding`, so checking its own
     `c` found nothing: the badge never lit up for Padding or Margin, and `clearOverride`'s
     four-side branch was unreachable code. Carried over from the string version, which had
     the same test — a component test is what finally showed it. */
  /* the block being edited, which is the resting one or a state's — `stRead` is the same
     resolver `cssVal` uses, so the badge and the field can never disagree about which
     declaration they are talking about */
  const owns = ownsValue(n, c);
  const clearable = owns && dev !== 'd';
  const w = writer(n, c);
  const label = dev === 'd' ? 'Editing the desktop base value'
    : owns ? 'Clear ' + C.DEV_LABEL[dev] + ' override for ' + c.label
      : 'Set a ' + C.DEV_LABEL[dev] + ' override';
  return clearable
    ? <button type="button" class="rsp ovr" title={label} aria-label={label}
        onClick={() => w.clearOverride()}><Icon name={DEV_ICON[dev]} size={9} /></button>
    : <span class="rsp" title={label}><Icon name={DEV_ICON[dev]} size={9} /></span>;
}

function ResetBadge({ n, c }: { n: PcNode; c: Control }) {
  /* Responsive overrides already turn the device badge into their reset action. On the
     desktop base, and for non-responsive CSS controls, use the same explicit reset glyph. */
  if (!ownsValue(n, c) || (c.r && C.dk() !== 'd')) return null;
  const label = 'Restore default for ' + c.label;
  return <button type="button" class="rst" title={label} aria-label={label}
    onClick={() => writer(n, c).clearOverride()}><Icon name="reset" size={9} /></button>;
}

function BindBadge({ n, c }: { n: PcNode; c: Control }) {
  const scope = C.bindScope(n.id);
  const fid = C.boundField(n, c.k!);
  if (!L.canStructure() || (!scope && !fid && !n.use)) return null;
  const paths = C.fieldPaths(scope?.col || null).filter(field => C.cmsFieldTypes(c).includes(field.type));
  const shown = paths.find(x => x.path === fid);
  const pick = async () => {
    if (!scope && !fid) return;
    const chosen = await L.askPick(scope ? `Bind to ${scope.col.name}` : 'CMS connection',
      [['', '— No binding, use the saved value —'],
        ...paths.map(x => [x.path, `${x.label} · ${x.type}`])], fid);
    if (chosen === null) return;
    C.edit(() => C.bindSet(n, c.k!, C.bindField(chosen)));
    L.toast(chosen ? 'Bound to ' + (paths.find(x => x.path === chosen)?.label || chosen) : 'Binding cleared');
  };
  const label = fid
    ? (shown ? `Bound to ${shown.label}` : 'Missing CMS field or source. Choose another field or disconnect.')
    : scope ? 'Connect a CMS field' : 'Choose a content source or place this component in a Collection to connect CMS fields';
  return (
    <button type="button" aria-label={label} disabled={!scope && !fid}
      class={'bnd' + (fid ? ' on' : '')} onClick={pick} title={label}>
      <Icon name="cms" size={9} />
    </button>
  );
}

/* The badge that says "this varies between instances". Only while a component definition is
   open, because that is the only place the question makes sense: on a page you are looking at
   an instance, whose panel already shows the properties.

   One click declares the property, takes the value in front of you as its default and binds
   this control to it. Three steps done separately is three chances to end up with a property
   nothing reads — the badge on the control that will read it is the whole point. */
function PropBadge({ n, c }: { n: PcNode; c: Control }) {
  const cid = C.state.ui.cedit;
  if (C.state.ui.mode !== 'component' || !cid) return null;
  const def = C.findComponent(cid);
  if (!def) return null;
  const b = C.bindGet(n, c.k!);
  const bound = b && b.src === 'prop' ? b.path : '';
  const pr = bound ? C.findProp(def, bound) : null;

  const pick = async () => {
    const mine = (def.props || []).filter(x => x.t === (C.PROP_KIND[c.t] || ''));
    const chosen = await L.askPick('This value on each instance',
      [['', '— The same on every instance —'],
        ['+', 'New property from this value'],
        ...mine.map(x => [x.k, `${x.label} · ${x.t}`])] as [string, string][], bound);
    if (chosen === null) return;
    if (chosen === '+') {
      let made: string | null = null;
      C.edit(() => { made = C.propFromControl(cid, n.id, c); });
      L.toast(made ? `“${c.label || c.k}” now varies between instances` : 'That value cannot be a property');
    } else {
      C.edit(() => C.bindSet(n, c.k!, chosen ? { src: 'prop', path: chosen } : null));
      L.toast(chosen ? 'Reads the property' : 'The same on every instance');
    }
    repaint('right');
    L.paint();
  };

  const label = bound
        ? (pr ? `Varies per instance — “${pr.label}” — click to change` : 'Bound to a property that no longer exists')
        : 'Make ' + c.label + ' vary between instances';
  return (
    <button type="button" class={'bnd' + (bound ? ' on' : '')} onClick={pick}
      title={label} aria-label={label}>
      <Icon name="component" size={9} />
    </button>
  );
}

export function Field({ n, c, children }: { n: PcNode; c: Control; children?: any }) {
  const labelId = useId();
  const { scope, fid } = bound(n, c);
  const bindable = C.cmsBindable(n, c);
  /* Anything a control writes can vary between instances — a colour, a variant, a link — so
     this is not restricted to `bindableKeys`, which is the CMS's narrower question about what
     an item can hold. What it excludes is a property editing itself. */
  const varies = !!c.k && !c.k.startsWith(C.VAL) && !!C.PROP_KIND[c.t];
  const f = fid && scope ? C.fieldPaths(scope.col).find(field => field.path === fid) : null;
  /* what this control reads on each instance, if anything — shown as a note for the same
     reason a bound field is: the panel and the canvas have to agree about where a value
     comes from */
  const pb = c.k && !c.k.startsWith(C.VAL) ? C.bindGet(n, c.k) : null;
  const pbound = pb && pb.src === 'prop'
    ? (C.findProp(C.findComponent(C.state.ui.cedit), pb.path) || { label: pb.path }).label
    : '';
  const helpId = fid || pbound || c.note ? `${labelId}-help` : undefined;
  const inputIds: string[] = [];
  const controls = labelControls(children, c.label || 'Value', labelId, helpId, '', inputIds);

  return (
    <div class={'f' + (c.layout === 'inline' && c.t !== 'color' && !(bindable && C.bindScope(n.id)) && !pbound && C.state.ui.mode !== 'component' ? ' f-inline' : '') + (fid ? ' bound' : '')} role="group" aria-labelledby={labelId}>
      <label for={inputIds[0]}>
        <span id={labelId}>{c.label || ''}</span>
        {c.r ? <ResponsiveBadge n={n} c={c} /> : null}
        <ResetBadge n={n} c={c} />
        {bindable ? <BindBadge n={n} c={c} /> : null}
        {varies ? <PropBadge n={n} c={c} /> : null}
      </label>
      {controls}
      {fid
        ? <div id={helpId} class="note">{f ? <>From <b>{f.label}</b> · {scope!.col.name}</> : <>CMS field or source is missing. Reconnect or clear the CMS binding.</>}</div>
        : pbound
          ? <div id={helpId} class="note">Set on each instance — <b>{pbound}</b>.</div>
          : c.note ? <div id={helpId} class="note">{c.note}</div> : null}
    </div>
  );
}
