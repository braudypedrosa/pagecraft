import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { BarSeriesOption, LineSeriesOption, PieSeriesOption } from 'echarts/charts';
import type {
  AriaComponentOption,
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from 'echarts/components';
import type { ComposeOption, EChartsType } from 'echarts/core';

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  AriaComponent,
  CanvasRenderer,
]);

export interface CrmChartSpec {
  kind: 'line' | 'bar' | 'donut';
  title: string;
  unit: 'count' | 'money';
  currencyCode?: string;
  points: { label: string; value: number | string }[];
}

export type CrmChartOption = ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | PieSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
  | AriaComponentOption
>;

export interface PreparedCrmChartPoint {
  label: string;
  geometryValue: number;
  formattedValue: string;
  exactValue: string;
}

export interface PreparedCrmChartData {
  points: PreparedCrmChartPoint[];
  normalized: boolean;
  maxAbsoluteMinorUnits?: bigint;
}

const MAX_POINTS = 1_000;
const MAX_TEXT_LENGTH = 240;
const MAX_SPEC_LENGTH = 1_000_000;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const NORMALIZED_SCALE = 1_000_000n;
const INTEGER = /^[+-]?\d+$/;
const DECIMAL = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const mountedFigures = new WeakMap<HTMLElement, MountedChart>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validText = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT_LENGTH;

const validValue = (value: unknown, unit: CrmChartSpec['unit']) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && (unit === 'count' || Number.isSafeInteger(value));
  }
  if (typeof value !== 'string' || value.length === 0 || value.length > 1_000) return false;
  return unit === 'money' ? INTEGER.test(value) : DECIMAL.test(value) && Number.isFinite(Number(value));
};

export function parseCrmChartSpec(raw: string | unknown): CrmChartSpec | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length === 0 || raw.length > MAX_SPEC_LENGTH) return null;
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isRecord(value)) return null;
  if (value.kind !== 'line' && value.kind !== 'bar' && value.kind !== 'donut') return null;
  if (value.unit !== 'count' && value.unit !== 'money') return null;
  if (!validText(value.title) || !Array.isArray(value.points) || value.points.length > MAX_POINTS) return null;
  if (value.currencyCode !== undefined &&
    (typeof value.currencyCode !== 'string' || !/^[A-Z]{3}$/.test(value.currencyCode))) return null;
  const points: CrmChartSpec['points'] = [];
  for (const point of value.points) {
    if (!isRecord(point) || !validText(point.label) || !validValue(point.value, value.unit)) return null;
    points.push({ label: point.label as string, value: point.value as number | string });
  }
  return {
    kind: value.kind,
    title: value.title as string,
    unit: value.unit,
    ...(value.currencyCode === undefined ? {} : { currencyCode: value.currencyCode }),
    points,
  };
}

const currencyDigits = (currencyCode?: string) => {
  if (!currencyCode) return 2;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode })
      .resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
};

const currencySymbol = (currencyCode?: string) => {
  if (!currencyCode) return '';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode })
      .formatToParts(0).find(part => part.type === 'currency')?.value ?? `${currencyCode} `;
  } catch {
    return `${currencyCode} `;
  }
};

const groupInteger = (value: bigint) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
  useGrouping: true,
}).format(value);

export function formatExactMoneyMinorUnits(value: string | bigint, currencyCode?: string): string {
  const amount = typeof value === 'bigint' ? value : BigInt(value);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const digits = currencyDigits(currencyCode);
  const scale = 10n ** BigInt(digits);
  const major = absolute / scale;
  const fraction = digits ? `.${(absolute % scale).toString().padStart(digits, '0')}` : '';
  return `${negative ? '-' : ''}${currencySymbol(currencyCode)}${groupInteger(major)}${fraction}`;
}

export function formatCompactMoneyMinorUnits(value: string | bigint, currencyCode?: string): string {
  const amount = typeof value === 'bigint' ? value : BigInt(value);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const digits = currencyDigits(currencyCode);
  const scale = 10n ** BigInt(digits);
  const major = absolute / scale;
  if (major < 1_000_000n) return formatExactMoneyMinorUnits(amount, currencyCode);

  const majorText = major.toString();
  const signAndSymbol = `${negative ? '-' : ''}${currencySymbol(currencyCode)}`;
  const exponent = Math.floor((majorText.length - 1) / 3) * 3;
  const suffix = ({ 3: 'K', 6: 'M', 9: 'B', 12: 'T' } as Record<number, string>)[exponent];
  if (!suffix) {
    const decimal = majorText[1] && majorText[1] !== '0' ? `.${majorText[1]}` : '';
    return `${signAndSymbol}${majorText[0]}${decimal}e${majorText.length - 1}`;
  }
  const tenths = (absolute * 10n) / (scale * (10n ** BigInt(exponent)));
  const decimal = tenths % 10n === 0n ? '' : `.${tenths % 10n}`;
  return `${signAndSymbol}${tenths / 10n}${decimal}${suffix}`;
}

const formatExactCount = (value: string | number) => {
  const source = String(value);
  if (INTEGER.test(source)) return groupInteger(BigInt(source));
  const negative = source.startsWith('-');
  const unsigned = source.replace(/^[+-]/, '');
  const [integer = '0', fraction = ''] = unsigned.split('.');
  const grouped = groupInteger(BigInt(integer || '0'));
  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
};

export function formatCrmChartValue(value: number | string, unit: CrmChartSpec['unit'], currencyCode?: string) {
  if (unit === 'money') return formatExactMoneyMinorUnits(typeof value === 'number' ? BigInt(value) : value, currencyCode);
  return formatExactCount(value);
}

const scaledBigInt = (value: bigint, maxAbsolute: bigint) => {
  if (value === 0n || maxAbsolute === 0n) return 0;
  const absolute = value < 0n ? -value : value;
  const scaled = Number((absolute * NORMALIZED_SCALE) / maxAbsolute);
  const visible = scaled === 0 ? 1 : scaled;
  return value < 0n ? -visible : visible;
};

export function prepareCrmChartData(spec: CrmChartSpec): PreparedCrmChartData | null {
  if (spec.points.length === 0 || spec.points.length > MAX_POINTS) return null;

  if (spec.unit === 'money') {
    const exactValues = spec.points.map(point => BigInt(point.value));
    const maxAbsolute = exactValues.reduce((maximum, value) => {
      const absolute = value < 0n ? -value : value;
      return absolute > maximum ? absolute : maximum;
    }, 0n);
    const normalized = maxAbsolute > MAX_SAFE_BIGINT;
    return {
      normalized,
      ...(normalized ? { maxAbsoluteMinorUnits: maxAbsolute } : {}),
      points: spec.points.map((point, index) => ({
        label: point.label,
        geometryValue: normalized ? scaledBigInt(exactValues[index], maxAbsolute) : Number(exactValues[index]),
        formattedValue: formatExactMoneyMinorUnits(exactValues[index], spec.currencyCode),
        exactValue: exactValues[index].toString(),
      })),
    };
  }

  return {
    normalized: false,
    points: spec.points.map(point => ({
      label: point.label,
      geometryValue: Number(point.value),
      formattedValue: formatExactCount(point.value),
      exactValue: String(point.value),
    })),
  };
}

const tooltipDataIndex = (params: unknown) => {
  const first = Array.isArray(params) ? params[0] : params;
  if (!isRecord(first) || typeof first.dataIndex !== 'number') return -1;
  return first.dataIndex;
};

const tooltipFormatter = (points: PreparedCrmChartPoint[]) => (params: unknown) => {
  const point = points[tooltipDataIndex(params)];
  return point ? `${point.label}\n${point.formattedValue}` : '';
};

const valueRange = {
  min: (range: { min: number }) => Math.min(0, range.min),
  max: (range: { max: number }) => Math.max(0, range.max),
};

const baseOption = (spec: CrmChartSpec, prepared: PreparedCrmChartData, reducedMotion: boolean) => ({
  animation: !reducedMotion,
  color: ['#5c9a26', '#253d1b', '#8bc34a', '#7b847c', '#b7cf9d', '#456b2c'],
  textStyle: { fontFamily: 'Manrope, sans-serif', color: '#172617', fontSize: 13 },
  aria: {
    enabled: true,
    description: `${spec.title}. ${prepared.points.length} data ${prepared.points.length === 1 ? 'point' : 'points'}.`,
  },
  tooltip: {
    trigger: spec.kind === 'line' ? 'axis' as const : 'item' as const,
    triggerOn: 'mousemove|click|mousewheel' as const,
    renderMode: 'richText' as const,
    confine: true,
    formatter: tooltipFormatter(prepared.points),
    backgroundColor: '#172119',
    borderWidth: 0,
    padding: [9, 11],
    textStyle: { color: '#f7f9f4', fontFamily: 'Manrope, sans-serif', fontSize: 14, lineHeight: 20 },
  },
});

const approximateMoneyAxisValue = (value: number, prepared: PreparedCrmChartData, spec: CrmChartSpec) => {
  if (!prepared.normalized || prepared.maxAbsoluteMinorUnits === undefined) {
    return formatCompactMoneyMinorUnits(BigInt(Math.round(value)), spec.currencyCode);
  }
  const scaled = BigInt(Math.round(Math.abs(value) * 1_000));
  const absolute = (prepared.maxAbsoluteMinorUnits * scaled) / (NORMALIZED_SCALE * 1_000n);
  return formatCompactMoneyMinorUnits(value < 0 ? -absolute : absolute, spec.currencyCode);
};

const axisFormatter = (value: number, spec: CrmChartSpec, prepared: PreparedCrmChartData) =>
  spec.unit === 'money'
    ? approximateMoneyAxisValue(value, prepared, spec)
    : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export function buildCrmChartOption(spec: CrmChartSpec, reducedMotion = false): CrmChartOption | null {
  const prepared = prepareCrmChartData(spec);
  if (!prepared) return null;
  if (spec.kind === 'donut' &&
    (prepared.points.some(point => point.geometryValue < 0) || prepared.points.every(point => point.geometryValue === 0))) return null;

  const base = baseOption(spec, prepared, reducedMotion);
  if (spec.kind === 'line') {
    return {
      ...base,
      grid: { left: 12, right: 18, top: 16, bottom: 72, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: prepared.points.map(point => point.label),
        axisLine: { lineStyle: { color: '#cfd5cc' } },
        axisTick: { show: false },
        axisLabel: { color: '#667067', hideOverlap: true, margin: 12 },
      },
      yAxis: {
        type: 'value',
        ...valueRange,
        ...(spec.unit === 'count' ? { minInterval: 1 } : {}),
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#e1e5de', type: 'dashed' } },
        axisLabel: { color: '#667067', formatter: (value: number) => axisFormatter(value, spec, prepared) },
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none', start: 0, end: 100 },
        {
          type: 'slider', xAxisIndex: 0, filterMode: 'none', start: 0, end: 100,
          bottom: 8, height: 24, borderColor: '#cfd5cc', fillerColor: 'rgba(92,154,38,.18)',
          handleStyle: { color: '#5c9a26', borderColor: '#345f19' },
          moveHandleStyle: { color: '#5c9a26' },
          dataBackground: { lineStyle: { color: '#7b847c' }, areaStyle: { color: '#e1ead8' } },
          selectedDataBackground: { lineStyle: { color: '#5c9a26' }, areaStyle: { color: '#cfdfbf' } },
          showDetail: false,
        },
      ],
      series: [{
        name: spec.title,
        type: 'line',
        data: prepared.points.map(point => point.geometryValue),
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { color: '#5c9a26', width: 2 },
        itemStyle: { color: '#f7f8f5', borderColor: '#4f8e1f', borderWidth: 2 },
        areaStyle: { color: 'rgba(183,243,74,.18)' },
        emphasis: { focus: 'series', scale: 1.4 },
      }],
    } as CrmChartOption;
  }

  if (spec.kind === 'bar') {
    return {
      ...base,
      grid: { left: 10, right: 34, top: 10, bottom: 18, containLabel: true },
      xAxis: {
        type: 'value',
        ...valueRange,
        ...(spec.unit === 'count' ? { minInterval: 1, splitNumber: 3 } : {}),
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#e1e5de', type: 'dashed' } },
        axisLabel: { color: '#667067', hideOverlap: true, formatter: (value: number) => axisFormatter(value, spec, prepared) },
      },
      yAxis: {
        type: 'category',
        data: prepared.points.map(point => point.label),
        axisLine: { lineStyle: { color: '#cfd5cc' } },
        axisTick: { show: false },
        axisLabel: { color: '#354038', width: 90, overflow: 'truncate' },
      },
      series: [{
        name: spec.title,
        type: 'bar',
        data: prepared.points.map(point => point.geometryValue),
        barMaxWidth: 28,
        itemStyle: { color: '#6da72d', borderRadius: [0, 3, 3, 0] },
        label: {
          show: true,
          position: 'right',
          color: '#354038',
          formatter: (params: { dataIndex?: number }) => prepared.points[params.dataIndex ?? -1]?.formattedValue ?? '',
        },
        emphasis: { focus: 'series', itemStyle: { color: '#4f8e1f' } },
      }],
    } as CrmChartOption;
  }

  return {
    ...base,
    legend: {
      type: 'scroll',
      bottom: 0,
      textStyle: { color: '#4d574f', fontSize: 13 },
      pageTextStyle: { color: '#667067' },
      pageIconColor: '#4f8e1f',
      pageIconInactiveColor: '#aab1aa',
    },
    series: [{
      name: spec.title,
      type: 'pie',
      radius: ['46%', '70%'],
      center: ['50%', '43%'],
      avoidLabelOverlap: true,
      minAngle: 2,
      itemStyle: { borderColor: '#f7f8f5', borderWidth: 2 },
      label: {
        show: true,
        position: 'inside',
        color: '#172617',
        backgroundColor: '#f7f8f5',
        padding: [2, 4],
        borderRadius: 3,
        fontSize: 13,
        fontWeight: 600,
        formatter: (params: { dataIndex?: number }) => {
          const point = prepared.points[params.dataIndex ?? -1];
          return point?.formattedValue ?? '';
        },
      },
      labelLine: { show: false },
      labelLayout: { hideOverlap: true },
      data: prepared.points.map(point => ({ name: point.label, value: point.geometryValue })),
      emphasis: { scaleSize: 5 },
    }],
  } as CrmChartOption;
}

interface MountedChart {
  chart: EChartsType;
  observer?: ResizeObserver;
  actions?: HTMLElement;
  fallback: HTMLElement | null;
  fallbackWasHidden: boolean | 'until-found';
  hostWasHidden: boolean | 'until-found';
  hostRole: string | null;
  hostAriaLabel: string | null;
}

const chartFigures = (root: Document | HTMLElement) => {
  const descendants = Array.from(root.querySelectorAll<HTMLElement>('figure[data-crm-chart]'));
  return root.nodeType === 1 && (root as HTMLElement).matches('figure[data-crm-chart]')
    ? [root as HTMLElement, ...descendants]
    : descendants;
};

const reducedMotion = (doc: Document) => doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const phoneViewport = (doc: Document) => doc.defaultView?.matchMedia?.('(max-width: 767px)').matches ?? false;

const createLineActions = (doc: Document, chart: EChartsType) => {
  const actions = doc.createElement('div');
  actions.className = 'hq-chart-actions';

  const reset = doc.createElement('button');
  reset.type = 'button';
  reset.className = 'button secondary compact';
  reset.textContent = 'Reset zoom';
  reset.addEventListener('click', () => chart.dispatchAction({
    type: 'dataZoom',
    batch: [{ dataZoomIndex: 0, start: 0, end: 100 }, { dataZoomIndex: 1, start: 0, end: 100 }],
  }));

  const download = doc.createElement('button');
  download.type = 'button';
  download.className = 'button secondary compact';
  download.textContent = 'Download chart';
  download.addEventListener('click', () => {
    const dataUrl = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#f7f8f5' });
    if (!dataUrl.startsWith('data:image/png')) return;
    const anchor = doc.createElement('a');
    anchor.href = dataUrl;
    anchor.download = 'pagecraft-crm-chart.png';
    anchor.hidden = true;
    doc.body.append(anchor);
    anchor.click();
    anchor.remove();
  });

  actions.append(reset, download);
  return actions;
};

const restoreFigure = (figure: HTMLElement, mounted: MountedChart) => {
  mounted.observer?.disconnect();
  mounted.chart.dispose();
  mounted.actions?.remove();
  const host = figure.querySelector<HTMLElement>('.chart-library-host');
  if (host) {
    host.hidden = mounted.hostWasHidden;
    if (mounted.hostRole === null) host.removeAttribute('role');
    else host.setAttribute('role', mounted.hostRole);
    if (mounted.hostAriaLabel === null) host.removeAttribute('aria-label');
    else host.setAttribute('aria-label', mounted.hostAriaLabel);
  }
  if (mounted.fallback) mounted.fallback.hidden = mounted.fallbackWasHidden;
  delete figure.dataset.chartReady;
  mountedFigures.delete(figure);
};

export function mountCrmCharts(root: Document | HTMLElement = document): () => void {
  const figures = chartFigures(root);
  const created: HTMLElement[] = [];
  const doc = root.nodeType === 9 ? root as Document : (root as HTMLElement).ownerDocument;
  if (phoneViewport(doc)) return () => undefined;

  for (const figure of figures) {
    if (mountedFigures.has(figure)) continue;
    const script = figure.querySelector<HTMLScriptElement>('script[type="application/json"][data-chart-spec]');
    const host = figure.querySelector<HTMLElement>('.chart-library-host');
    if (!script || !host) continue;
    const spec = parseCrmChartSpec(script.textContent ?? '');
    if (!spec) continue;
    const option = buildCrmChartOption(spec, reducedMotion(doc));
    if (!option) continue;

    const fallback = figure.querySelector<HTMLElement>('.chart-fallback');
    const hostWasHidden = host.hidden;
    const fallbackWasHidden = fallback?.hidden ?? false;
    const hostRole = host.getAttribute('role');
    const hostAriaLabel = host.getAttribute('aria-label');
    let chart: EChartsType | undefined;
    let actions: HTMLElement | undefined;
    let observer: ResizeObserver | undefined;
    try {
      host.hidden = false;
      host.setAttribute('role', 'img');
      host.setAttribute('aria-label', `${spec.title}. Interactive ${spec.kind} chart with ${spec.points.length} data ${spec.points.length === 1 ? 'point' : 'points'}.`);
      chart = echarts.init(host, undefined, { renderer: 'canvas' });
      chart.setOption(option);
      if (spec.kind === 'line') {
        actions = createLineActions(doc, chart);
        host.insertAdjacentElement('afterend', actions);
      }
      const ResizeObserverConstructor = doc.defaultView?.ResizeObserver;
      if (ResizeObserverConstructor) {
        observer = new ResizeObserverConstructor(() => chart?.resize());
        observer.observe(host);
      }
      if (fallback) fallback.hidden = true;
      figure.dataset.chartReady = 'true';
      mountedFigures.set(figure, {
        chart,
        ...(observer ? { observer } : {}),
        ...(actions ? { actions } : {}),
        fallback,
        fallbackWasHidden,
        hostWasHidden,
        hostRole,
        hostAriaLabel,
      });
      created.push(figure);
    } catch {
      observer?.disconnect();
      actions?.remove();
      chart?.dispose();
      host.hidden = hostWasHidden;
      if (hostRole === null) host.removeAttribute('role');
      else host.setAttribute('role', hostRole);
      if (hostAriaLabel === null) host.removeAttribute('aria-label');
      else host.setAttribute('aria-label', hostAriaLabel);
      if (fallback) fallback.hidden = fallbackWasHidden;
      delete figure.dataset.chartReady;
    }
  }

  return () => {
    for (const figure of created) {
      const mounted = mountedFigures.get(figure);
      if (mounted) restoreFigure(figure, mounted);
    }
  };
}
