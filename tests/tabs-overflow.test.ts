import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

const longLabel = 'AvailabilityAndPoliciesForInternationalExpeditionReservationsWithoutBreaksOrSeparators';
const longPanel = 'BookingReferenceABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

beforeEach(() => C.blankProject('Tabs overflow'));

test.each([true, false])('Tabs contain unbroken labels and panel text in the %s CSS path', editing => {
  const css = C.baseCss(editing);
  const tabsRule = css.match(/\.pagecraft-tabs\{[^}]*\}/)?.[0] || '';
  const tabRule = css.match(/\.pagecraft-tab\{[^}]*\}/)?.[0] || '';

  expect(tabsRule).toContain('width:100%');
  expect(tabsRule).toContain('overflow-wrap:anywhere');
  expect(tabRule).toContain('min-width:0');
  expect(tabRule).toContain('max-width:100%');
  expect(css).not.toMatch(/(?:html|body)\{[^}]*overflow-x:hidden/);
});

test('long Tabs content and existing selection semantics survive rendering unchanged', () => {
  const tabs = C.N('tabs', {
    items: [
      { label: longLabel, panel: longPanel },
      { label: 'Travel', panel: 'Short panel' },
    ],
  });
  C.state.pages[0].tree = [tabs];

  const publicHtml = C.renderNode(tabs, { edit: false });
  expect(publicHtml).toContain(`>${longLabel}</button>`);
  expect(publicHtml).toContain(`<p>${longPanel}</p>`);
  expect(publicHtml).toContain('role="tablist"');
  expect(publicHtml).toContain('role="tab"');
  expect(publicHtml).toContain('aria-selected="true" tabindex="0"');
  expect(publicHtml).toContain('aria-selected="false" tabindex="-1"');
  expect(publicHtml.match(/data-tab-idle/g)).toHaveLength(1);

  C.state.ui.sel = tabs.id;
  const selectedHtml = C.renderNode(tabs, { edit: true });
  expect(selectedHtml).not.toContain('data-tab-idle');
  expect(selectedHtml).toContain(`>${longLabel}</button>`);
  expect(selectedHtml).toContain(`<p>${longPanel}</p>`);
});

test('containment leaves authored white-space, spacing and responsive styles intact', () => {
  const tabs = C.N('tabs', {
    items: [{ label: longLabel, panel: `<p>${longPanel}</p>` }],
  }, {
    d: { 'white-space': 'nowrap', '--tb-pad': '14px 7px' },
    t: { '--tb-size': '18px' },
    m: { '--tb-size': '13px', '--tb-gap': '9px' },
  });
  const css = C.treeCss([[tabs]], false);
  const selector = `.${C.nodeClass(tabs)}`;

  const baseRule = css.match(new RegExp(`\\${selector}\\{[^}]*\\}`))?.[0] || '';
  const tablet = css.match(new RegExp(`@media \\(max-width:1024px\\)\\{\\${selector}\\{[^}]*\\}`))?.[0] || '';
  const mobile = css.match(new RegExp(`@media \\(max-width:767px\\)\\{\\${selector}\\{[^}]*\\}`))?.[0] || '';
  expect(baseRule).toContain('white-space:nowrap');
  expect(baseRule).toContain('--tb-pad:14px 7px');
  expect(tablet).toContain('--tb-size:18px');
  expect(mobile).toContain('--tb-size:13px');
  expect(mobile).toContain('--tb-gap:9px');
  expect(C.baseCss(false).match(/\.pagecraft-tab\{[^}]*\}/)?.[0]).not.toContain('white-space:');
});
