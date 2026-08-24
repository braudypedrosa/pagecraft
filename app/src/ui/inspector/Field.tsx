/* The frame every control sits in: its label, its two badges, and its note.

   The badges are the reason this is one component rather than markup repeated 22
   times. The responsive badge has to say whether *this* breakpoint owns the value, not
   whether a value exists — a mobile field inheriting the desktop size is not an
   override, and drawing it as one is how you end up clearing something that was never
   set. The binding badge stays live even when the control itself is inert, because
   unbinding is the one thing you still need to do to a bound field. */
import { C, L } from '../ctx';
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

export function Field({ n, c, children }: { n: PcNode; c: Control; children?: any }) {
  const { scope, fid } = bound(n, c);
  const bindable = c.k && C.bindableKeys(n.type).includes(c.k);
  const f = fid && scope ? C.findField(scope.col, fid) : null;

  return (
    <div class={'f' + (fid ? ' bound' : '')}>
      <label>
        {c.label || ''}
        {c.r ? <ResponsiveBadge n={n} c={c} /> : null}
        {bindable ? <BindBadge n={n} c={c} /> : null}
      </label>
      {children}
      {fid
        ? <div class="note">From <b>{(f || { name: 'a missing field' }).name}</b> on the item shown above.</div>
        : c.note ? <div class="note">{c.note}</div> : null}
    </div>
  );
}
