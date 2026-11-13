import { beforeEach, expect, test, vi } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';

const echartsMock = vi.hoisted(() => {
  const chart = {
    setOption: vi.fn(),
    dispatchAction: vi.fn(),
    getDataURL: vi.fn(() => 'data:image/png;base64,chart'),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    chart,
    init: vi.fn(() => chart),
    use: vi.fn(),
  };
});

vi.mock('echarts/core', () => ({
  init: echartsMock.init,
  use: echartsMock.use,
}));

import {
  buildCrmChartOption,
  formatCompactMoneyMinorUnits,
  formatExactMoneyMinorUnits,
  mountCrmCharts,
  parseCrmChartSpec,
  prepareCrmChartData,
  type CrmChartSpec,
} from '../src/founder-crm-client/charts.ts';

const moneySpec = (points: CrmChartSpec['points'], currencyCode = 'USD'): CrmChartSpec => ({
  kind: 'line',
  title: 'Collected charges',
  unit: 'money',
  currencyCode,
  points,
});

beforeEach(() => {
  for (const mock of Object.values(echartsMock.chart)) {
    if (typeof mock === 'function' && 'mockClear' in mock) mock.mockClear();
  }
  echartsMock.init.mockClear();
});

test('chart specs reject unsafe data and bound work to 1,000 points', () => {
  expect(parseCrmChartSpec({
    kind: 'line', title: 'Unsafe', unit: 'money', currencyCode: 'USD',
    points: [{ label: 'Now', value: Number.MAX_SAFE_INTEGER + 1 }],
  })).toBeNull();
  expect(parseCrmChartSpec({
    kind: 'line', title: 'Infinite', unit: 'count', points: [{ label: 'Now', value: Infinity }],
  })).toBeNull();
  expect(parseCrmChartSpec({
    kind: 'line', title: 'Overflow', unit: 'count', points: [{ label: 'Now', value: '9'.repeat(1_000) }],
  })).toBeNull();
  expect(parseCrmChartSpec({
    kind: 'line', title: 'Bad currency', unit: 'money', currencyCode: 'usd', points: [{ label: 'Now', value: '1' }],
  })).toBeNull();
  expect(parseCrmChartSpec({
    kind: 'line', title: 'Too many', unit: 'count',
    points: Array.from({ length: 1_001 }, (_, index) => ({ label: String(index), value: index })),
  })).toBeNull();
  expect(parseCrmChartSpec('{not-json')).toBeNull();
});

test('money geometry stays finite across huge mixed signs while exact values survive', () => {
  const spec = moneySpec([
    { label: 'Refund', value: '-900719925474099312345678901' },
    { label: 'Zero', value: '0' },
    { label: 'Charge', value: '1801439850948198624691357802' },
  ]);
  const prepared = prepareCrmChartData(spec)!;
  expect(prepared.normalized).toBe(true);
  expect(prepared.points.map(point => point.geometryValue)).toEqual([-500_000, 0, 1_000_000]);
  expect(prepared.points.every(point => Number.isFinite(point.geometryValue))).toBe(true);
  expect(prepared.points[0].exactValue).toBe('-900719925474099312345678901');
  expect(prepared.points[2].formattedValue).toBe('$18,014,398,509,481,986,246,913,578.02');
});

test('exact money formatting retains signs, cents, large integers, and currency precision', () => {
  expect(formatExactMoneyMinorUnits('-123', 'USD')).toBe('-$1.23');
  expect(formatExactMoneyMinorUnits('900719925474099300', 'USD')).toBe('$9,007,199,254,740,993.00');
  expect(formatExactMoneyMinorUnits('9007199254740993', 'JPY')).toBe('¥9,007,199,254,740,993');
  expect(formatExactMoneyMinorUnits('123', 'NZD')).toBe('NZ$1.23');
  expect(formatExactMoneyMinorUnits('123')).toBe('1.23');
  expect(formatCompactMoneyMinorUnits('125000000', 'USD')).toBe('$1.2M');
  expect(formatCompactMoneyMinorUnits('-1801439850948198624691357802', 'USD')).toBe('-$1.8e25');
});

test('line and bar axes include zero and line charts provide both zoom controls', () => {
  const line = buildCrmChartOption({
    kind: 'line', title: 'Accounts', unit: 'count', points: [{ label: 'Mon', value: 5 }, { label: 'Tue', value: 8 }],
  }) as any;
  expect(line.yAxis.min({ min: 5 })).toBe(0);
  expect(line.yAxis.max({ max: -3 })).toBe(0);
  expect(line.dataZoom.map((zoom: { type: string }) => zoom.type)).toEqual(['inside', 'slider']);

  const bar = buildCrmChartOption({
    kind: 'bar', title: 'Pipeline', unit: 'count', points: [{ label: 'Lead', value: -2 }, { label: 'Won', value: 3 }],
  }) as any;
  expect(bar.xAxis.min({ min: 2 })).toBe(0);
  expect(bar.xAxis.max({ max: -2 })).toBe(0);
});

test('tooltips use safe rich text and return exact source values without HTML rendering', () => {
  const title = '<img src=x onerror=alert(1)>{bad|style}';
  const option = buildCrmChartOption(moneySpec([{ label: title, value: '900719925474099301' }])) as any;
  expect(option.tooltip.renderMode).toBe('richText');
  expect(option.tooltip.extraCssText).toBeUndefined();
  expect(option.tooltip.formatter([{ dataIndex: 0 }])).toBe(`${title}\n$9,007,199,254,740,993.01`);
  expect(option.series[0].data[0]).toBe(1_000_000);
});

test('empty sources and unusable donut values stay with their server fallback', () => {
  expect(buildCrmChartOption({ kind: 'line', title: 'No source', unit: 'count', points: [] })).toBeNull();
  expect(buildCrmChartOption({
    kind: 'donut', title: 'No distribution', unit: 'count', points: [{ label: 'Unknown', value: 0 }],
  })).toBeNull();
  expect(buildCrmChartOption({
    kind: 'donut', title: 'Invalid distribution', unit: 'count', points: [{ label: 'Refund', value: -1 }],
  })).toBeNull();
});

test('reduced motion disables animation and accessible chart descriptions retain scope', () => {
  const option = buildCrmChartOption({
    kind: 'donut', title: 'Manual sources', unit: 'count',
    points: [{ label: 'Referral', value: 2 }, { label: 'Organic', value: 1 }],
  }, true) as any;
  expect(option.animation).toBe(false);
  expect(option.aria).toEqual(expect.objectContaining({ enabled: true, description: 'Manual sources. 2 data points.' }));
  expect(option.legend.type).toBe('scroll');
});

test('mounting succeeds once, preserves the data disclosure, and cleanup restores fallback state', () => {
  const dom = new JSDOM(`<!doctype html><body><figure data-crm-chart>
    <div class="chart-fallback">Server chart</div>
    <div class="chart-library-host" hidden></div>
    <details class="chart-data"><summary>View chart data</summary><table><tr><td>7</td></tr></table></details>
    <script type="application/json" data-chart-spec></script>
  </figure></body>`);
  const spec: CrmChartSpec = {
    kind: 'line', title: 'Accounts', unit: 'count', points: [{ label: 'Mon', value: 7 }],
  };
  dom.window.document.querySelector('script')!.textContent = JSON.stringify(spec);
  dom.window.matchMedia = () => ({ matches: false }) as any;
  const disconnect = vi.fn();
  dom.window.ResizeObserver = class {
    observe() {}
    disconnect() { disconnect(); }
  } as any;

  const cleanup = mountCrmCharts(dom.window.document);
  const duplicateCleanup = mountCrmCharts(dom.window.document);
  const figure = dom.window.document.querySelector<HTMLElement>('figure')!;
  const host = figure.querySelector<HTMLElement>('.chart-library-host')!;
  const fallback = figure.querySelector<HTMLElement>('.chart-fallback')!;
  expect(echartsMock.init).toHaveBeenCalledTimes(1);
  expect(host.hidden).toBe(false);
  expect(host.getAttribute('aria-label')).toContain('Interactive line chart');
  expect(fallback.hidden).toBe(true);
  expect(figure.dataset.chartReady).toBe('true');
  expect(figure.querySelector('.chart-data')).not.toBeNull();
  expect([...figure.querySelectorAll<HTMLButtonElement>('.hq-chart-actions button')].map(button => [button.type, button.textContent]))
    .toEqual([['button', 'Reset zoom'], ['button', 'Download chart']]);

  figure.querySelector<HTMLButtonElement>('.hq-chart-actions button')!.click();
  expect(echartsMock.chart.dispatchAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'dataZoom' }));
  duplicateCleanup();
  expect(echartsMock.chart.dispose).not.toHaveBeenCalled();
  cleanup();
  expect(echartsMock.chart.dispose).toHaveBeenCalledTimes(1);
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(host.hidden).toBe(true);
  expect(fallback.hidden).toBe(false);
  expect(figure.dataset.chartReady).toBeUndefined();
  expect(figure.querySelector('.hq-chart-actions')).toBeNull();
  dom.window.close();
});

test('phone viewports do not replace the server-rendered chart', () => {
  const dom = new JSDOM(`<figure data-crm-chart><div class="chart-fallback">Server chart</div>
    <div class="chart-library-host" hidden></div><script type="application/json" data-chart-spec>
    {"kind":"bar","title":"Pipeline","unit":"count","points":[{"label":"Lead","value":2}]}
    </script></figure>`);
  dom.window.matchMedia = (query: string) => ({ matches: query.includes('max-width') }) as any;
  const cleanup = mountCrmCharts(dom.window.document);
  expect(echartsMock.init).not.toHaveBeenCalled();
  expect(dom.window.document.querySelector<HTMLElement>('.chart-fallback')!.hidden).toBe(false);
  cleanup();
  dom.window.close();
});
