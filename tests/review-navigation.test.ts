import { test, expect, vi } from 'vitest';
import * as core from '../app/src/core/index';
import { openReviewTarget } from '../app/src/ui/review-navigation';
import type { Legacy } from '../app/src/ui/ctx';
test('review navigation finds exported node IDs without editing the document', () => {
  core.seed();
  const page = core.state.pages[0], node = page.tree[0];
  const before = JSON.stringify({pages:core.state.pages,header:core.state.header,footer:core.state.footer});
  const legacy = {appRender:vi.fn(),select:vi.fn()} as unknown as Legacy;
  openReviewTarget(core, legacy, '?reviewPage='+page.slug+'.html&reviewNode='+encodeURIComponent(core.domIdOf(node)));
  expect(legacy.select).toHaveBeenCalledWith(node.id,{scroll:true});
  expect(JSON.stringify({pages:core.state.pages,header:core.state.header,footer:core.state.footer})).toBe(before);
  vi.mocked(legacy.select).mockClear();
  openReviewTarget(core, legacy, '?reviewPage='+page.slug+'.html&reviewNode=pc-review-anchor-missing');
  expect(legacy.select).not.toHaveBeenCalled();
  vi.mocked(legacy.appRender).mockClear();
  openReviewTarget(core, legacy, '?reviewPage=missing.html');
  expect(legacy.appRender).not.toHaveBeenCalled();
});
