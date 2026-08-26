/* The Navigator, ported.
   First panel across because `#paneLayers` has exactly one writer, so Preact can own
   the container outright — anything sharing a mount point with a function that sets
   innerHTML would have its diff torn up underneath it.

   What this replaces is 70 lines split into a renderer that built HTML strings and a
   binder that queried the result back out of the DOM to attach handlers. That split is
   the whole reason build.mjs carries a control-parity guard: markup and its wiring
   could drift apart, and did. Here a row's handler is three lines below its markup and
   cannot be forgotten separately. */
import { C, L, repaint } from './ctx';
import { Icon } from './Icon';

function RegionRow({ kind, label }: { kind: string; label: string }) {
  const live = kind === L.scopeOf();
  const open = () => L.setMode(L.modeFor(kind));
  return (
    <div class={'lrow region' + (live ? ' live' : ' locked')}
      role="treeitem" tabIndex={0} aria-current={live ? 'true' : undefined}
      onClick={open}
      onKeyDown={e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault(); open();
      }}>
      <Icon name={kind === 'main' ? 'page' : 'globe'} size={13} cls="ico" />
      <span class="nm">{label}</span>
      {live ? <span class="badge">Editing</span> : <Icon name="lock" size={12} cls="lk" />}
    </div>
  );
}

function NodeRow({ n, depth }: { n: any; depth: number }) {
  const kids = n.children || [];
  const collapsed = !!C.state.ui.collapsed[n.id];
  const hidden = !!(n.hide && n.hide[C.dk()]);
  const primary = C.state.ui.sel === n.id;
  const alsoPicked = !primary && C.selIds().includes(n.id);

  /* a row's own buttons act on that row, not on whatever happens to be selected */
  const act = (e: MouseEvent, name: string) => { e.stopPropagation(); L.runAct(name, [n.id]); };

  return (
    <div class={'lrow' + (primary ? ' sel' : alsoPicked ? ' sel2' : '') + (collapsed ? ' collapsed' : '')}
      /* `data-id` is load-bearing, not decoration: startLayerDrag is still in
         builder.html and finds its drop target with
         `elementFromPoint(...).closest('.lrow[data-id]')`, then reads this back.
         Region rows deliberately carry none, which is what excludes them as targets.
         It comes off when the drag moves across too. */
      data-id={n.id}
      role="treeitem" tabIndex={0} aria-level={depth + 1}
      aria-selected={primary || alsoPicked ? 'true' : 'false'}
      aria-expanded={kids.length ? (collapsed ? 'false' : 'true') : undefined}
      style={{ paddingLeft: (6 + depth * 13) + 'px' }}
      onClick={e => L.select(n.id, { scroll: true, add: e.metaKey || e.ctrlKey, range: e.shiftKey })}
      onKeyDown={e => {
        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault(); L.select(n.id, { scroll: true });
      }}
      onContextMenu={e => {
        e.preventDefault();
        if (!C.selIds().includes(n.id)) L.select(n.id);
        L.openCtx(e.clientX, e.clientY, C.selIds());
      }}>
      <button type="button" class="tw" aria-label={collapsed ? 'Expand' : 'Collapse'}
        aria-expanded={kids.length ? (collapsed ? 'false' : 'true') : undefined}
        disabled={!kids.length} onClick={e => {
        e.stopPropagation();
        C.state.ui.collapsed[n.id] = !collapsed;
        repaint('layers');
      }}>{kids.length ? <Icon name="caret" size={10} /> : null}</button>
      <button type="button" class="gr" title="Drag to reorder" aria-label="Drag to reorder"
        onPointerDown={e => L.startLayerDrag(e as unknown as PointerEvent, n.id)}>
        <Icon name="drag" size={11} />
      </button>
      <Icon name={C.DEF[n.type].icon} size={13} cls="ico" />
      <span class="nm">{C.nameOf(n)}</span>
      <span class="act">
        <button title={(hidden ? 'Show' : 'Hide') + ' on ' + C.DEV_LABEL[C.dk()]}
          onClick={e => act(e, 'hide')}><Icon name={hidden ? 'eyeoff' : 'eye'} size={12} /></button>
        <button title="Duplicate" onClick={e => act(e, 'dup')}><Icon name="copy" size={12} /></button>
        <button title="Delete" onClick={e => act(e, 'del')}><Icon name="trash" size={12} /></button>
      </span>
    </div>
  );
}

/** A subtree, flattened to rows the way the old renderer did — depth as padding
    rather than as nesting, so a row's hit area spans the full width of the panel. */
function Rows({ list, depth }: { list: any[]; depth: number }) {
  const out: any[] = [];
  const walk = (arr: any[], d: number) => arr.forEach(n => {
    out.push(<NodeRow key={n.id} n={n} depth={d} />);
    if ((n.children || []).length && !C.state.ui.collapsed[n.id]) walk(n.children, d + 1);
  });
  walk(list, depth);
  return <>{out}</>;
}

export function Layers() {
  const scope = L.scopeOf();
  const list = C.tree();
  return (
    <div class="layers" role="tree" aria-label="Page content">
      {L.regions().map(R => (
        <>
          <RegionRow key={'r-' + R.kind} kind={R.kind} label={R.label} />
          {R.kind !== scope ? null
            : list.length ? <Rows list={list} depth={1} />
              : <div class="empty" style={{ padding: '14px 16px' }}>
                Empty.<br />Add an element from the <b>Add</b> panel.
              </div>}
        </>
      ))}
    </div>
  );
}
