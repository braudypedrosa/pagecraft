/* The Add panel — widgets, templates, components, blocks and libraries.

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
import { Disclosure } from './Disclosure';
import { Libraries, addToLibrary, fromLabel, linkOf } from './Libraries';
import type { LibraryItemKind } from '../core/libraries';
import { useLayoutEffect, useState } from 'preact/hooks';
import { createRecentElementsStore } from './recent-elements';
import { FirstEditGuide } from './FirstEditGuide';
import {
  actionDestinationOptions, applyRegionSetup, firstAction, placementIndex,
  placementOptions, selectedSectionIndex, starterNavItems, suggestedActionDestination,
  type SectionPlacement
} from './section-insertion';

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
      ['section', 'Section'], ['columns', 'Columns'], ['row', 'Row'],
      /* Flex, Grid and Link block are one widget with a different Layout — but a palette that
         offered "Box" and a dropdown would hide two layouts this editor never had behind a
         control nobody would open. */
      ['flex', 'Flex'], ['grid', 'Grid'], ['box', 'Box'], ['linkbox', 'Link block'],
      ['slider', 'Slider'], ['list', 'Collection']
    ]
  },
  {
    g: 'Content', items: [
      ['heading', 'Heading'], ['text', 'Rich text'], ['quote', 'Quote'], ['table', 'Table'], ['code', 'Code'],
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

const recentElements = createRecentElementsStore(PAL.flatMap(group => group.items.map(([key]) => key)));
/* Called by the successful click/drop insertion paths, never by hover or drag start. */
export const recordElementUse = recentElements.record;

const ALIASES: Record<string, string> = {
  heading: 'title headline',
  text: 'paragraph copy wysiwyg',
  image: 'photo picture media',
  button: 'link call to action cta',
  section: 'layout container wrapper',
  columns: 'layout column row split',
  row: 'layout columns horizontal',
  flex: 'layout align alignment stack',
  grid: 'layout tiles repeated',
  box: 'layout container wrapper',
  linkbox: 'layout clickable card link',
  slider: 'carousel slideshow',
  list: 'collection cms dynamic',
};

const TABS = [
  ['widgets', 'Elements', 'plus'],
  ['templates', 'Templates', 'section'],
  ['components', 'Components', 'component'],
  ['blocks', 'Blocks', 'copy'],
  /* Only where libraries exist: the hosted editor, for the site's owner. */
  ['libraries', 'Libraries', 'library']
] as const;
type AddTab = (typeof TABS)[number][0];
const tabs = () => L.libraries() ? TABS : TABS.filter(([key]) => key !== 'libraries');
const tab = (): AddTab => {
  const want = C.state.ui.atab || 'widgets';
  return (tabs().find(([key]) => key === want) || TABS[0])[0];
};

const STARTER_SECTIONS = [
  ['hero-split', 'Image beside text'],
  ['features-3', 'Three columns'],
  ['contact', 'Contact section']
] as const;

/* A row's library line and its "Add to library…" button, shared by Components and Blocks. */
function LibraryFrom({ kind, id }: { kind: LibraryItemKind; id: string }) {
  const link = L.libraries() ? linkOf(kind, id) : null;
  return link ? <small class="lib-from">{fromLabel(link)}</small> : null;
}
function LibraryAdd({ kind, id }: { kind: LibraryItemKind; id: string }) {
  if (!L.libraries()) return null;
  return (
    <button class="bx" title="Add to library…" aria-label="Add to library…"
      onClick={e => { e.stopPropagation(); addToLibrary({ kind, id }); repaint('add'); }}>
      <Icon name="library" size={11} />
    </button>
  );
}

type PaletteGroup = (typeof PAL)[number];

function WidgetTiles({ group }: { group: PaletteGroup }) {
  return (
    <div class="pgrid">
      {group.items.map(([k, label]) => (
        <button type="button" class="pitem" key={k} title={L.insertionHint(k)}
          onFocus={() => L.previewInsertion(k)}
          onMouseEnter={() => L.previewInsertion(k)}
          onBlur={() => L.previewInsertion(null)}
          onMouseLeave={() => L.previewInsertion(null)}
          onPointerDown={e => L.startDrag(e as unknown as PointerEvent,
            { kind: 'new', type: k, label: C.labelOf(k), icon: C.iconOf(k) }, false)}
          onClick={() => { if (!L.consumeDragMoved()) L.appendSmart(k); }}>
          <Icon name={C.iconOf(k)} size={19} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function Widgets({ templates }: { templates(): void }) {
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState(() => recentElements.read());
  useLayoutEffect(() => recentElements.subscribe(setRecent), []);
  const groups = PAL.map(group => ({
    ...group,
    items: group.items.filter(([key]) => key !== 'list' || L.dynamicContentProvider() === 'pagecraft')
  }));
  const allowed = groups.flatMap(group => group.items.map(item => ({ group: group.g, item })));
  const recentItems = recent.flatMap(key => {
    const found = allowed.find(({ item }) => item[0] === key);
    return found ? [found.item] : [];
  });
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = groups.map(group => ({
    ...group,
    items: group.items.filter(([key, label]) => {
      const haystack = `${group.g} ${label} ${key} ${ALIASES[key] || ''}`.toLowerCase();
      return terms.every(term => haystack.includes(term));
    })
  })).filter(group => group.items.length);
  const clear = () => setQuery('');

  return (
    <>
      <div class="pc-add-search">
        <label for="add-element-search">Find an element</label>
        <div>
          <Icon name="search" size={14} />
          <input id="add-element-search" type="search" value={query}
            placeholder="Search text, photo, layout…" autocomplete="off"
            onInput={e => setQuery(e.currentTarget.value)}
            onKeyDown={e => {
              if (e.key !== 'Escape') return;
              e.stopPropagation();
              if (query) { e.preventDefault(); clear(); }
            }} />
          {query ? <button type="button" class="bx" aria-label="Clear element search" onClick={clear}>
            <Icon name="close" size={12} />
          </button> : null}
        </div>
      </div>

      {terms.length ? (
        matches.length ? matches.map(group => (
          <div class="pc-add-group" key={group.g}>
            <div class="plabel">{group.g}</div>
            <WidgetTiles group={group} />
          </div>
        )) : (
          <div class="pc-add-empty" role="status">
            <b>No elements found</b>
            <span>Change or clear the search.</span>
            <button type="button" class="btn" onClick={clear}>Clear search</button>
          </div>
        )
      ) : (
        <>
          {recentItems.length ? <div class="pc-add-group">
            <div class="plabel">Recently used</div>
            <WidgetTiles group={{ g: 'Recently used', items: recentItems }} />
          </div> : null}
          <div class="pc-add-guide">
            <button type="button" class="btn" onClick={templates}>Browse starter sections</button>
          </div>
          {groups.filter(group => group.items.length).map(group => (
            <Disclosure class="pc-add-category" key={group.g} title={group.g} count={group.items.length}>
              <WidgetTiles group={group} />
            </Disclosure>
          ))}
        </>
      )}
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

  const place = async (id: string) => {
    if (L.consumeDragMoved()) return;
    const pat = C.PATTERNS.find(x => x.id === id)!;
    const originalMode = C.state.ui.mode;
    const originalPageId = C.page().id;

    if (!pat.scope) {
      const selectedId = selectedSectionIndex(C.page().tree, C.state.ui.sel) == null ? null : C.state.ui.sel;
      const options = placementOptions(C.page().tree, selectedId);
      let picked = 'end';
      if (options.length > 1) {
        const choice = await L.askPick('Place section', options, 'end');
        if (!choice) return;
        picked = choice;
        if (C.page().id !== originalPageId || (selectedId && !C.locate(selectedId, C.page().tree))) {
          L.toast('The page changed. Choose the section again.');
          return;
        }
      }
      const page = C.page();
      const index = placementIndex(page.tree, selectedId, picked as SectionPlacement);
      let made: { id: string } | null = null;
      /* patternInsert reads the active tree. Keep a global editing scope stable by using page
         mode only during the synchronous transaction, then restoring it before repaint. */
      C.state.ui.mode = 'page';
      C.edit(() => { made = C.patternInsert(id, null, index); }, 'Add section');
      C.state.ui.mode = originalMode;
      if (!made) { L.toast('That does not fit there'); return; }
      if (originalMode === 'page') L.select((made as { id: string }).id);
      L.toast(`${pat.name} added`);
      return;
    }

    const scope = pat.scope;
    const currentRegion = () => scope === 'header' ? C.state.header : C.state.footer;
    const regionSnapshot = JSON.stringify(currentRegion());
    const contextChanged = () => C.page().id !== originalPageId || JSON.stringify(currentRegion()) !== regionSnapshot;
    let action = 'add' as 'add' | 'replace' | 'edit';
    if (currentRegion().length) {
      const picked = await L.askPick(`Add or replace ${scope}`, [
        ['add', `Add another ${scope} — keep current ${scope}`],
        ['replace', `Replace current ${scope} — Undo restores it`],
        ['edit', `Edit existing ${scope} — no changes`]
      ], 'replace');
      if (!picked) return;
      if (contextChanged()) {
        L.toast(`The ${scope} changed. Choose the template again.`);
        return;
      }
      action = picked as 'add' | 'replace' | 'edit';
      if (action === 'edit') {
        L.setMode(scope);
        L.select(currentRegion()[0].id);
        L.toast(`Editing current ${scope}`);
        return;
      }
    }

    const navItems = starterNavItems(currentRegion(), C.state.pages);
    const staged = pat.build();

    let actionSetup: { label: string; href: string } | null = null;
    const button = firstAction(staged);
    if (button) {
      const label = await L.askText(`Set up ${scope} action`, 'Action label', String(button.props.text || ''), {
        ok: 'Continue'
      });
      if (label == null) return;
      if (contextChanged()) {
        L.toast(`The ${scope} changed. Choose the template again.`);
        return;
      }
      const destination = await L.askPick('Action destination', actionDestinationOptions(C.state.pages),
        suggestedActionDestination(C.state.pages));
      if (destination == null) return;
      if (contextChanged()) {
        L.toast(`The ${scope} changed. Choose the template again.`);
        return;
      }
      actionSetup = { label: label.trim() || 'Action', href: destination };
    }

    let made: { id: string } | null = null;
    L.setMode(scope);
    C.edit(() => {
      const region = currentRegion();
      const oldLength = region.length;
      made = C.patternInsert(id, null, region.length);
      if (!made) return;
      applyRegionSetup(made as any, navItems, actionSetup);
      if (action === 'replace') region.splice(0, oldLength);
    }, action === 'replace' ? `Replace global ${scope}` : `Add global ${scope}`);
    if (!made) { L.toast('That does not fit there'); return; }
    L.select((made as { id: string }).id);
    L.toast(action === 'replace'
      ? `${pat.name} replaced the current ${scope}. Undo restores it.`
      : `${pat.name} added — now editing the global ${scope}`);
  };

  return (
    <>
      <div class="pc-add-starters" aria-labelledby="starter-sections-label">
        <div class="plabel" id="starter-sections-label">Starter sections</div>
        <div class="pvgrid">
          {STARTER_SECTIONS.map(([id, label]) => {
            const pattern = C.PATTERNS.find(candidate => candidate.id === id);
            return pattern ? (
              <button type="button" class="pvcard pc-add-starter" key={id}
                title={`${pattern.desc} — drag onto the canvas, or click to choose where to place`}
                onPointerDown={e => L.startDrag(e as unknown as PointerEvent,
                  { kind: 'pattern', patId: pattern.id, label: pattern.name, icon: 'section' }, false)}
                onClick={() => place(pattern.id)}>
                <div dangerouslySetInnerHTML={{ __html: pattern.preview() }} />
                <span>{label}</span>
              </button>
            ) : null;
          })}
        </div>
      </div>
      {cats.map(cat => (
        <>
          <div class="plabel">{cat}</div>
          <div class="pvgrid">
            {C.PATTERNS.filter(t => t.cat === cat).map(t => (
              <button class="pvcard" key={t.id}
                title={t.scope
                  ? `${t.desc} — click to add, replace, or edit the global ${t.scope}`
                  : `${t.desc} — drag onto the canvas, or click to choose where to place`}
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
    C.edit(() => { made = C.blockInsert(id, undefined); });
    if (made) L.select((made as { id: string }).id);
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
    L.toast('Block removed from the library. Existing copies are kept.');
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
              <LibraryFrom kind="block" id={b.id} />
            </span>
            <LibraryAdd kind="block" id={b.id} />
            <button class="bx danger" title="Forget this block" onClick={e => forget(e, b.id)}>
              <Icon name="trash" size={11} />
            </button>
          </div>
        );
      }) : (
        <div class="hint">
          No saved blocks. Select an element to save one.
        </div>
      )}
      <button class="btn block" disabled={!sel}
        style={{ marginTop: 'var(--gap-1)', fontSize: 'var(--fs-2)' }}
        onClick={() => sel && L.saveBlockFlow(sel.node.id)}>
        <Icon name="plus" size={12} />
        {sel ? ' Save ' + C.kindOf(sel.node) + ' as block' : ' Select something to save'}
      </button>
    </>
  );
}

/* Components, beside Blocks rather than instead of it — for now. A block is a copy you paste
   and then own; a component is an instance that stays connected to its definition. The two
   are different answers and the panel says which is which, and the plan says what happens to
   blocks once components can do everything they can.

   Each row can place an instance, edit or rename the definition, or delete it.
   Delete says how many places it would change. */
function Components() {
  const sel = C.state.ui.sel ? C.locate(C.state.ui.sel) : null;
  const list = C.components();
  const editing = C.state.ui.mode === 'component' ? C.state.ui.cedit : null;

  const place = (id: string) => {
    if (L.consumeDragMoved()) return;
    let made: { id: string } | null = null;
    C.edit(() => { made = C.instanceInsert(id, undefined); });
    if (made) L.select((made as { id: string }).id);
    L.toast(made ? C.findComponent(id)!.name + ' placed' : 'That component does not fit there');
  };

  const open = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    L.editComponent(id);
  };

  const rename = async (e: MouseEvent, id: string) => {
    e.stopPropagation();
    const cd = C.findComponent(id);
    if (!cd) return;
    const name = (await L.askText('Rename component', 'Name', cd.name))?.trim().slice(0, 40);
    if (!name || name === cd.name) return;
    C.edit(() => { C.componentRename(id, name); });
    repaint('add');
    repaint('right');
  };

  const remove = async (e: MouseEvent, id: string) => {
    e.stopPropagation();
    const cd = C.findComponent(id);
    if (!cd) return;
    const n = C.instances(id).length;
    const menuUses = C.componentUsage(id) - n;
    const ok = await L.askConfirm('Delete this component?',
      `<b>${esc(cd.name)}</b> stops being a component. `
      + (n
        ? `The ${n === 1 ? 'one place' : n + ' places'} using it keep what they show, as ordinary elements — `
          + `they simply stop changing together.`
        : menuUses ? '' : `Nothing is using it.`)
      + (menuUses
        ? `${n ? ' ' : ''}${menuUses} mobile ${menuUses === 1 ? 'menu references' : 'menus reference'} this layout. These references will be removed. `
          + `If this layout is active, the menu will use its navigation links or existing Follow layout instead. Other layouts are kept.`
        : ''),
      { ok: 'Delete component' });
    if (!ok) return;
    C.edit(() => { C.componentDelete(id); });
    L.toast(menuUses ? 'Component deleted. Mobile menu references removed.'
      : 'Component deleted. Existing instances are now ordinary elements.');
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
        const used = C.instances(cd.id).length;
        const menuUses = C.componentUsage(cd.id) - used;
        const usage = (used || !menuUses ? `${used} ${used === 1 ? 'instance' : 'instances'}` : '')
          + (menuUses ? `${used ? ' · ' : ''}${menuUses} mobile ${menuUses === 1 ? 'menu' : 'menus'}` : '');
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
                {cd.mobileMenu && `${cd.mobileMenuSource === 'follow' ? 'Follow navigation' : 'Custom content'} · `}
                {usage}
                {props ? ` · ${props === 1 ? '1 property' : props + ' properties'}` : cd.mobileMenu ? '' : ' · no properties yet'}
              </small>
              <LibraryFrom kind="component" id={cd.id} />
            </span>
            <button class="bx" title="Edit this component" onClick={e => open(e, cd.id)}>
              <Icon name="edit" size={11} />
            </button>
            <button class="bx" title="Rename this component" aria-label="Rename this component" onClick={e => rename(e, cd.id)}>
              {/* Iconify lucide:text-cursor-input: https://api.iconify.design/lucide/text-cursor-input.svg */}
              <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 20h-1a2 2 0 0 1-2-2a2 2 0 0 1-2 2H6m7-12h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7m-8 0H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1m1-4h1a2 2 0 0 1 2 2a2 2 0 0 1 2-2h1M9 6v12" />
              </svg>
            </button>
            <LibraryAdd kind="component" id={cd.id} />
            <button class="bx danger" title="Delete this component" onClick={e => remove(e, cd.id)}>
              <Icon name="trash" size={11} />
            </button>
          </div>
        );
      }) : (
        <div class="hint">
          No components. Select an element to create one.
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
  const shown = tabs();

  const choose = (key: AddTab) => {
    C.state.ui.atab = key;
    repaint('add');
  };
  const current = shown.find(([key]) => key === t)!;
  // Internal shortcuts also change this select. Its enhanced label listens to input
  // events; setting the native value alone is not an observable DOM mutation.
  useLayoutEffect(() => {
    document.getElementById('add-category-select')?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [t]);

  return (
    <>
      <FirstEditGuide />
      <div class="addSwitcher pc-add-category-picker">
        <label for="add-category-select">Add</label>
        <select class="ctl" id="add-category-select" value={t}
          onChange={e => choose(e.currentTarget.value as AddTab)}>
          {shown.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      <div class="palette" id="add-category-panel" role="region" aria-label={`${current[1]} to add`}>
        {t === 'widgets' ? <Widgets templates={() => choose('templates')} />
          : t === 'components' ? <Components />
            : t === 'templates' ? <Templates />
              : t === 'libraries' ? <Libraries /> : <Blocks />}
      </div>
    </>
  );
}

/* askConfirm takes HTML, so this one value is escaped by hand. */
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
