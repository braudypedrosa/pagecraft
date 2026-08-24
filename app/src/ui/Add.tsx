/* The Add panel — widgets, blocks and templates.

   Three functions in builder.html became one component tree, and that is the point:
   `renderPalette` owned #paneAdd while `drawAddBody` and `drawBlocks` both wrote
   #addBody, so the container had two writers and a tab switch meant re-running the
   right one by hand. A component has one owner by construction and the tab is just a
   branch.

   Every item here is both draggable and clickable, which is why `consumeDragMoved`
   exists: the click fires after the drag ends, and without swallowing it the dragged
   element would also be appended where it started. */
import { C, L, repaint } from './ctx';
import { Icon } from './Icon';

/* Lives here because the Add panel is the only thing that reads it: which widgets are
   offered, and how they are grouped. */
const PAL: { g: string; items: [string, string][] }[] = [
  {
    /* No bare Column. Every route it offered is already covered: dropped on the root
       or a section it built the same Section > Row > Column that Columns does, and
       dropped on a row it did what the row's own 1-6 count control does. The type
       stays in DEF — cols(), wrap(), applyCols() and every template depend on it; it
       is just not something you add by hand. */
    g: 'Layout', items: [
      ['section', 'Section'], ['columns', 'Columns'], ['row', 'Row'], ['slider', 'Slider'], ['list', 'Collection']
    ]
  },
  {
    g: 'Content', items: [
      ['heading', 'Heading'], ['text', 'WYSIWYG'], ['quote', 'Quote'], ['table', 'Table'], ['code', 'Code'],
      ['image', 'Image'], ['gallery', 'Gallery'], ['video', 'Video'], ['icon', 'Icon']
    ]
  },
  {
    /* Grouped by what they do rather than by how they are built, which is why the
       Accordion sits with the Form: both are things a visitor operates. */
    g: 'Interactive', items: [
      ['button', 'Button'], ['nav', 'Nav menu'], ['crumbs', 'Breadcrumb'], ['form', 'Form'], ['accordion', 'Accordion'],
      ['tabs', 'Tabs'], ['embed', 'Embed']
    ]
  },
  { g: 'Spacing', items: [['divider', 'Divider'], ['spacer', 'Spacer']] }
];

const TABS: [string, string][] = [['widgets', 'Widgets'], ['components', 'Components'], ['blocks', 'Blocks'], ['templates', 'Templates']];
const tab = () => C.state.ui.atab || 'widgets';

function Widgets() {
  return (
    <>
      {PAL.map(g => (
        <>
          <div class="plabel">{g.g}</div>
          <div class="pgrid">
            {g.items.map(([k, label]) => (
              <div class="pitem" key={k} title="Drag onto the canvas — or click to append"
                onPointerDown={e => L.startDrag(e as unknown as PointerEvent,
                  { kind: 'new', type: k, label: C.labelOf(k), icon: C.iconOf(k) }, false)}
                onClick={() => { if (!L.consumeDragMoved()) L.appendSmart(k); }}>
                <Icon name={C.iconOf(k)} size={19} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </>
      ))}
    </>
  );
}

function Templates() {
  /* Every group, always, whatever region is being edited — and the click puts each one
     where it belongs.

     Filtering the list by the current region was the first attempt and it was half a
     design: it did stop a `<header>` landmark being offered for the middle of an article,
     but it also meant the Header and Footer groups did not exist until you had already
     switched to editing that region. Someone looking for a header template opens this tab,
     sees the same twenty-six page sections as before, and concludes there aren't any. Being
     unfindable is not better than being misplaced.

     So the region a pattern belongs to is a property of the pattern, not of the moment.
     Clicking one switches to its region and inserts there; `tree()` follows the mode, so
     the insert lands correctly for the same reason it did before. */
  const seen: string[] = [];
  C.PATTERNS.forEach(t => { if (!seen.includes(t.cat)) seen.push(t.cat); });
  /* Header first, then Footer, then the page sections in the order the library declares
     them. The two regions are what you set once and set first, and they are two groups
     against twelve — left in declaration order they sat at the bottom of a long scroll,
     which is close to where they were when they did not appear at all. Kept as a display
     rule rather than by reordering PATTERNS, because it is a display rule. */
  const LEAD = ['Header', 'Footer'];
  const cats = [...LEAD.filter(c => seen.includes(c)), ...seen.filter(c => !LEAD.includes(c))];

  const place = (id: string) => {
    if (L.consumeDragMoved()) return;
    const pat = C.PATTERNS.find(x => x.id === id)!;
    const want = pat.scope || 'page';
    const jumped = C.state.ui.mode !== want;
    /* before the insert, because `patternInsert` reads `tree()` and `tree()` reads the
       mode. Mode is UI state and is not in the undo snapshot, so it sits outside the
       transaction on purpose — undoing the insert should not also move you. */
    if (jumped) L.setMode(want);

    let made: { id: string } | null = null;
    C.edit(() => { made = C.patternInsert(id, undefined); if (made) C.selSet([(made as { id: string }).id]); });
    if (!made) { L.toast('That does not fit there'); return; }
    /* say where it went when that is not where you were looking, or a header appearing to
       replace the page you had open reads as the template having gone wrong */
    L.toast(pat.scope && jumped
      ? `${pat.name} added — now editing the global ${pat.scope}`
      : `${pat.name} added`);
  };

  return (
    <>
      <div class="hint" style={{ paddingBottom: '12px' }}>
        Ready-made sections, built from this project's colours and text styles.
      </div>
      {cats.map(cat => (
        <>
          <div class="plabel">{cat}</div>
          <div class="pvgrid">
            {C.PATTERNS.filter(t => t.cat === cat).map(t => (
              <button class="pvcard" key={t.id}
                title={t.scope
                  ? `${t.desc} — click to add it to the global ${t.scope}, shared by every page`
                  : `${t.desc} — drag onto the canvas, or click to append`}
                /* No drag for a region pattern. A drop lands wherever the drop target says,
                   which in page mode is page content — the one placement this must not
                   allow. There is also nowhere meaningful to aim a global header. */
                onPointerDown={t.scope ? undefined : e => L.startDrag(e as unknown as PointerEvent,
                  { kind: 'pattern', patId: t.id, label: t.name, icon: 'section' }, false)}
                onClick={() => place(t.id)}>
                {/* A div, not a span: `.pvcard span` styles the label with a border-top
                    and padding, so wrapping the preview in a span would draw a stray
                    line above every card. The preview is markup the pattern builds
                    from the project's own tokens — our data, not anyone's input. */}
                <div dangerouslySetInnerHTML={{ __html: t.preview() }} />
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </>
      ))}
    </>
  );
}

function Blocks() {
  const sel = C.state.ui.sel ? C.locate(C.state.ui.sel) : null;
  const list = C.blocks();

  const place = (id: string) => {
    if (L.consumeDragMoved()) return;
    let made: { id: string } | null = null;
    C.edit(() => { made = C.blockInsert(id, undefined); if (made) C.selSet([(made as { id: string }).id]); });
    L.toast(made ? C.findBlock(id)!.name + ' placed' : 'That block does not fit there');
  };

  const forget = async (e: MouseEvent, id: string) => {
    e.stopPropagation();
    const b = C.findBlock(id);
    if (!b) return;
    const ok = await L.askConfirm('Forget this block?',
      `<b>${esc(b.name)}</b> leaves the Blocks tab. Copies already placed stay.`,
      { ok: 'Forget block' });
    if (!ok) return;
    C.edit(() => C.blockDelete(id));
  };

  return (
    <>
      {list.length ? list.map(b => {
        const def = C.DEF[b.node.type];
        return (
          <div class="brow" key={b.id} title="Drag onto the canvas, or click to place it"
            onPointerDown={e => {
              if ((e.target as HTMLElement).closest('.bx')) return;
              L.startDrag(e as unknown as PointerEvent,
                { kind: 'block', blockId: b.id, label: b.name, icon: 'section' }, false);
            }}
            onClick={e => { if (!(e.target as HTMLElement).closest('.bx')) place(b.id); }}>
            <Icon name={def ? def.icon : 'section'} size={14} />
            <span class="bn">
              <b>{b.name}</b>
              <small>{def ? def.label : 'Block'}</small>
            </span>
            <button class="bx" title="Forget this block" onClick={e => forget(e, b.id)}>
              <Icon name="trash" size={11} />
            </button>
          </div>
        );
      }) : (
        <div class="hint">
          Nothing saved yet. Select something on the canvas and save it here to start from
          again on any page — a copy you then own. For something that stays connected
          everywhere you put it, use <b>Components</b>.
        </div>
      )}
      <button class="btn block" disabled={!sel}
        style={{ marginTop: 'var(--gap-1)', fontSize: 'var(--fs-2)' }}
        onClick={() => sel && L.saveBlockFlow(sel.node.id)}>
        <Icon name="plus" size={12} />
        {sel ? ' Save ' + C.DEF[sel.node.type].label + ' as block' : ' Select something to save'}
      </button>
    </>
  );
}

/* Components, beside Blocks rather than instead of it — for now. A block is a copy you paste
   and then own; a component is an instance that stays connected to its definition. The two
   are different answers and the panel says which is which, and the plan says what happens to
   blocks once components can do everything they can.

   Every row does three things, because a component is three things: place one, edit the
   definition, or delete it. Delete says how many places it would change. */
function Components() {
  const sel = C.state.ui.sel ? C.locate(C.state.ui.sel) : null;
  const list = C.components();
  const editing = C.state.ui.mode === 'component' ? C.state.ui.cedit : null;

  const place = (id: string) => {
    if (L.consumeDragMoved()) return;
    let made: { id: string } | null = null;
    C.edit(() => { made = C.instanceInsert(id, undefined); if (made) C.selSet([(made as { id: string }).id]); });
    L.toast(made ? C.findComponent(id)!.name + ' placed' : 'That component does not fit there');
  };

  const open = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    L.editComponent(id);
  };

  const remove = async (e: MouseEvent, id: string) => {
    e.stopPropagation();
    const cd = C.findComponent(id);
    if (!cd) return;
    const n = C.componentUsage(id);
    const ok = await L.askConfirm('Delete this component?',
      `<b>${esc(cd.name)}</b> stops being a component. `
      + (n
        ? `The ${n === 1 ? 'one place' : n + ' places'} using it keep what they show, as ordinary elements — `
          + `they simply stop changing together.`
        : `Nothing is using it.`),
      { ok: 'Delete component' });
    if (!ok) return;
    C.edit(() => { C.componentDelete(id); });
    /* Through the render cycle, not a panel repaint: every instance on the canvas just became
       an ordinary element, and the canvas is the thing that has to say so. */
    if (editing === id) L.editComponent(null); else L.setMode(C.state.ui.mode);
  };

  const make = async () => {
    if (!sel) return;
    const name = await L.askText('Save as component', 'Name', C.nameOf(sel.node));
    if (!name) return;
    let cid: string | null = null;
    C.edit(() => { cid = C.componentFromNode(sel.node.id, name); });
    if (cid) L.toast(`“${name}” is a component — this element is the first instance`);
    L.setMode(C.state.ui.mode);            // the canvas changes: one tree became a definition
  };

  return (
    <>
      {list.length ? list.map(cd => {
        const def = C.DEF[cd.node.type];
        const used = C.componentUsage(cd.id);
        const props = (cd.props || []).length;
        return (
          <div class={'brow' + (editing === cd.id ? ' sel' : '')} key={cd.id}
            title="Drag onto the canvas, or click to place one"
            onPointerDown={e => {
              if ((e.target as HTMLElement).closest('.bx')) return;
              L.startDrag(e as unknown as PointerEvent,
                { kind: 'component', componentId: cd.id, label: cd.name, icon: def ? def.icon : 'section' }, false);
            }}
            onClick={e => { if (!(e.target as HTMLElement).closest('.bx')) place(cd.id); }}>
            <Icon name={def ? def.icon : 'section'} size={14} />
            <span class="bn">
              <b>{cd.name}</b>
              <small>
                {used === 1 ? '1 instance' : `${used} instances`}
                {props ? ` · ${props === 1 ? '1 property' : props + ' properties'}` : ' · no properties yet'}
              </small>
            </span>
            <button class="bx" title="Edit this component" onClick={e => open(e, cd.id)}>
              <Icon name="edit" size={11} />
            </button>
            <button class="bx" title="Delete this component" onClick={e => remove(e, cd.id)}>
              <Icon name="trash" size={11} />
            </button>
          </div>
        );
      }) : (
        <div class="hint">
          Nothing yet. Select something on the canvas and save it as a component: every place
          you put it stays connected, and what varies between them is up to you.
        </div>
      )}
      <button class="btn block" disabled={!sel}
        style={{ marginTop: 'var(--gap-1)', fontSize: 'var(--fs-2)' }}
        onClick={make}>
        <Icon name="plus" size={12} />
        {sel ? ' Save ' + C.nameOf(sel.node) + ' as component' : ' Select something to save'}
      </button>
    </>
  );
}

export function Add() {
  const t = tab();
  return (
    <>
      <div class="tabs atabs">
        {TABS.map(([key, label]) => (
          <button key={key} class={t === key ? 'on' : ''}
            onClick={() => { C.state.ui.atab = key; repaint('add'); }}>{label}</button>
        ))}
      </div>
      <div class="palette">
        {t === 'widgets' ? <Widgets />
          : t === 'components' ? <Components />
            : t === 'templates' ? <Templates /> : <Blocks />}
      </div>
    </>
  );
}

/* askConfirm takes HTML, so this one value is escaped by hand. */
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
