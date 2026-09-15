import type { Core, Legacy } from './ctx';

/** A review URL changes the editor's view only; normal server membership checks still apply. */
export function openReviewTarget(core: Core, legacy: Legacy, search: string) {
  const query = new URLSearchParams(search);
  const path = query.get('reviewPage');
  if (!path) return;
  const index = core.state.pages.findIndex(p => p.slug + '.html' === path);
  if (index < 0) return;
  core.state.cur = index;
  core.state.ui.mode = 'page';
  core.selSet([]);
  const target = query.get('reviewNode');
  let found: { id: string; mode: "page" | "header" | "footer" } | undefined;
  for (const [mode, nodes] of [['page', core.state.pages[index].tree], ['header', core.state.header], ['footer', core.state.footer]] as const) {
    core.eachNode(nodes, node => {
      if (!found && target && core.domIdOf(node) === target) found = {id: node.id, mode};
    });
  }
  if (found) core.state.ui.mode = found.mode;
  legacy.appRender();
  if (found) legacy.select(found.id, {scroll: true});
}
