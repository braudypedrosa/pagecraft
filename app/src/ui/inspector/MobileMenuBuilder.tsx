import { C, L, repaint } from '../ctx';
import type { Node as PcNode } from '../../core/types';

/** Mobile layouts use the same native component canvas as reusable site sections. */
export function MobileMenuBuilder({ n }: { n: PcNode }) {
  const menus = C.mobileMenuComponents();
  const selected = menus.find(menu => menu.id === n.props.mobileMenuComponent);
  const choose = (id: string) => {
    C.edit(() => { n.props.mobileMenuComponent = id; });
    repaint('right');
  };
  const open = () => {
    let id = selected?.id;
    if (!id) C.edit(() => { id = C.ensureMobileMenuComponent(n).id; });
    if (id) {
      const rootId = C.findComponent(id)?.node.id;
      L.editComponent(id);
      /* Component mode clears selection. Seed its root as the predictable Add target so the
         first element click works without a preparatory canvas click. */
      if (rootId) L.select(rootId, { scroll: false });
    }
  };
  return (
    <>
      <div class="f">
        <label htmlFor="mobile-menu-layout">Menu layout</label>
        <select id="mobile-menu-layout" value={selected?.id || ''}
          onChange={e => choose((e.target as HTMLSelectElement).value)}>
          <option value="">Use menu links</option>
          {menus.map(menu => <option key={menu.id} value={menu.id}>{menu.name}</option>)}
        </select>
      </div>
      <button type="button" class="btn" onClick={open}>{selected ? 'Edit menu' : 'Build menu'}</button>
    </>
  );
}
