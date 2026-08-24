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

const DEV_ICON: Record<string, string> = { d: 'desktop', t: 'tablet', m: 'mobile' };

const BOX_SIDES = ['top', 'right', 'bottom', 'left'];

function ResponsiveBadge({ n, c }: { n: PcNode; c: Control }) {
  const dev = C.dk();
  const o = C.tgtObj(n);
  /* A box control writes `padding-top` and friends, never `padding`, so checking its own
     `c` found nothing: the badge never lit up for Padding or Margin, and `clearOverride`'s
     four-side branch was unreachable code. Carried over from the string version, which had
     the same test — a component test is what finally showed it. */
  /* the block being edited, which is the resting one or a state's — `stRead` is the same
     resolver `cssVal` uses, so the badge and the field can never disagree about which
     declaration they are talking about */
  const src = C.stRead(o);
  const owns = !!(c.c && src[dev] && (c.t === 'box'
    ? BOX_SIDES.some(s => src[dev][c.c + '-' + s] !== undefined)
    : src[dev][c.c] !== undefined));
  const clearable = owns && dev !== 'd';
  const w = writer(n, c);
  return (
    <span class={'rsp' + (clearable ? ' ovr' : '')}
      title={dev === 'd' ? 'Editing the desktop base value'
        : owns ? 'Overridden on ' + C.DEV_LABEL[dev] + ' — click to clear'
          : 'Set a ' + C.DEV_LABEL[dev] + ' override'}
      onClick={clearable ? () => w.clearOverride() : undefined}>
      <Icon name={DEV_ICON[dev]} size={9} />
    </span>
  );
}

function BindBadge({ n, c }: { n: PcNode; c: Control }) {
  const scope = C.bindScope(n.id);
  if (!scope) return null;
  /* the CMS's own badge, so a prop-sourced binding is not its business */
  const fid = C.boundField(n, c.k!);
  /* `fieldPaths` rather than the field list: a reference is only worth having if you can read
     through it, so the picker offers `Author → Name` beside the collection's own fields. The
     label of whatever is bound comes from the same list, so a two-hop binding reads back as
     the path it is rather than as a field id that does not exist here. */
  const paths = C.fieldPaths(scope.col);
  const shown = paths.find(x => x.path === fid);

  const pick = async () => {
    const chosen = await L.askPick(`Bind to ${scope.col.name}`,
      [['', '— No binding, use the value typed here —'],
        ...paths.map(x => [x.path, `${x.label} · ${x.type}`])], fid);
    if (chosen === null) return;
    C.edit(() => C.bindSet(n, c.k!, C.bindField(chosen)));
    const to = paths.find(x => x.path === chosen);
    L.toast(chosen ? 'Bound to ' + (to ? to.label : chosen) : 'Binding cleared');
  };

  return (
    <span class={'bnd' + (fid ? ' on' : '')} onClick={pick}
      title={fid ? (shown ? `Bound to ${shown.label} — click to change` : 'Bound to a field that no longer exists')
        : `Bind to a field in ${scope.col.name}`}>
      <Icon name="cms" size={9} />
    </span>
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

  return (
    <span class={'bnd' + (bound ? ' on' : '')} onClick={pick}
      title={bound
        ? (pr ? `Varies per instance — “${pr.label}” — click to change` : 'Bound to a property that no longer exists')
        : 'Make this vary between instances'}>
      <Icon name="component" size={9} />
    </span>
  );
}

export function Field({ n, c, children }: { n: PcNode; c: Control; children?: any }) {
  const { scope, fid } = bound(n, c);
  const bindable = c.k && C.bindableKeys(n.type).includes(c.k);
  /* Anything a control writes can vary between instances — a colour, a variant, a link — so
     this is not restricted to `bindableKeys`, which is the CMS's narrower question about what
     an item can hold. What it excludes is a property editing itself. */
  const varies = !!c.k && !c.k.startsWith(C.VAL) && !!C.PROP_KIND[c.t];
  const f = fid && scope ? C.findField(scope.col, fid) : null;
  /* what this control reads on each instance, if anything — shown as a note for the same
     reason a bound field is: the panel and the canvas have to agree about where a value
     comes from */
  const pb = c.k && !c.k.startsWith(C.VAL) ? C.bindGet(n, c.k) : null;
  const pbound = pb && pb.src === 'prop'
    ? (C.findProp(C.findComponent(C.state.ui.cedit), pb.path) || { label: pb.path }).label
    : '';

  return (
    <div class={'f' + (fid ? ' bound' : '')}>
      <label>
        {c.label || ''}
        {c.r ? <ResponsiveBadge n={n} c={c} /> : null}
        {bindable ? <BindBadge n={n} c={c} /> : null}
        {varies ? <PropBadge n={n} c={c} /> : null}
      </label>
      {children}
      {fid
        ? <div class="note">From <b>{(f || { name: 'a missing field' }).name}</b> on the item shown above.</div>
        : pbound
          ? <div class="note">Set on each instance — <b>{pbound}</b>.</div>
          : c.note ? <div class="note">{c.note}</div> : null}
    </div>
  );
}
