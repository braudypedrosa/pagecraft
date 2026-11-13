import { C, L, repaint } from '../ctx';
import type { Node as PcNode } from '../../core/types';

/** Mobile layouts use the same native component canvas as reusable site sections. */
export function MobileMenuBuilder({ n }: { n: PcNode }) {
  const mode = C.mobileMenuMode(n);
  const menus = C.mobileMenuComponents().filter(menu => menu.mobileMenuSource !== 'follow');
  const selected = C.mobileMenuDefinition(n);
  const choose = (id: string) => {
    C.edit(() => { n.props.mobileMenuComponent = id; });
    repaint('right');
  };
  const chooseMode = (next: 'follow' | 'custom') => {
    if (next === mode) return;
    C.setMobileMenuMode(n, next);
    repaint('right');
  };
  const open = () => {
    let id = selected?.id;
    if (!id) C.edit(() => { id = C.ensureMobileMenuComponent(n, mode).id; });
    if (id) {
      const rootId = C.findComponent(id)?.node.id;
      C.prepareMobileMenuEdit(n, id);
      L.editComponent(id);
      /* Component mode clears selection. Seed its root as the predictable Add target so the
         first element click works without a preparatory canvas click. */
      if (rootId) L.select(rootId, { scroll: false });
    }
  };
  return (
    <>
      <div class="f">
        <label htmlFor="mobile-menu-content">Content</label>
        <select id="mobile-menu-content" data-mobile-menu-mode value={mode}
          onChange={e => chooseMode((e.target as HTMLSelectElement).value === 'custom' ? 'custom' : 'follow')}>
          <option value="follow">Follow navigation</option>
          <option value="custom">Custom content</option>
        </select>
      </div>
      {mode === 'custom' && menus.length ? <div class="f">
        <label htmlFor="mobile-menu-layout">Custom layout</label>
        <select id="mobile-menu-layout" value={selected?.id || ''}
          onChange={e => choose((e.target as HTMLSelectElement).value)}>
          <option value="">New custom layout</option>
          {menus.map(menu => <option key={menu.id} value={menu.id}>{menu.name}</option>)}
        </select>
      </div> : null}
      <button type="button" class="btn" onClick={open}>{selected ? 'Edit layout' : 'Build menu'}</button>
    </>
  );
}
