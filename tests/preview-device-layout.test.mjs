import { afterEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { canvasWidth, fitZoom, zoomFor } from '../app/src/core/index';

const builder = readFileSync('builder.html', 'utf8');
const windows = [];
afterEach(() => { for (const dom of windows.splice(0)) dom.window.close(); });

// Exercise the actual editor layout and device handlers with explicit dimensions:
// JSDOM cannot lay out the stage, but does preserve the iframe's authored size.
function harness(width = 1400, height = 900) {
  const dom = new JSDOM(`<body class="preview"><div id="devSeg">${['desktop', 'tablet', 'mobile'].map(dev => `<button data-dev="${dev}"></button>`).join('')}</div><div id="stage"><div id="frameWrap"><iframe id="canvas"></iframe></div></div></body>`, { runScripts: 'outside-only' });
  windows.push(dom);
  const w = dom.window, d = w.document;
  const stage = d.querySelector('#stage'), wrap = d.querySelector('#frameWrap'), canvas = d.querySelector('#canvas');
  Object.defineProperty(stage, 'clientWidth', { get: () => width });
  Object.defineProperty(wrap, 'clientHeight', { get: () => height });
  Object.assign(w, { canvasWidth, fitZoom, zoomFor, state: { ui: { dev: 'desktop', zoom: '0.5' }, meta: { maxWidth: '1200px' } },
    $: selector => d.querySelector(selector), $$: selector => [...d.querySelectorAll(selector)],
    cdoc: canvas.contentDocument, render: () => w.layoutCanvas(), positionHud: () => {}, renderDim: () => {} });
  w.eval('let zoomK = 1;\n' + builder.slice(builder.indexOf('function layoutCanvas() {'), builder.indexOf('\nfunction renderDim() {')));
  w.eval(builder.slice(builder.indexOf('function setDev(d) {'), builder.indexOf('\nfunction togglePreview() {')));
  for (const button of d.querySelectorAll('#devSeg button')) button.addEventListener('click', () => w.setDev(button.dataset.dev));
  return { w, d, wrap, canvas, resize: (nextWidth, nextHeight = height) => { width = nextWidth; height = nextHeight; w.layoutCanvas(); },
    device: dev => d.querySelector(`[data-dev="${dev}"]`).click() };
}

test('preview device switches retain tablet and mobile widths and return desktop to full width', () => {
  const { d, wrap, canvas, device } = harness();
  for (const [dev, width] of [['tablet', 834], ['mobile', 414], ['desktop', 1400]]) {
    device(dev);
    expect(wrap.style.width).toBe(`${width}px`);
    expect(canvas.style.width).toBe(`${width}px`);
    expect(canvas.style.height).toBe('900px');
    expect(canvas.style.transform).toBe('none');
    expect(d.querySelector(`[data-dev="${dev}"]`).getAttribute('aria-pressed')).toBe('true');
    expect(d.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
  }
});

test('device preview fits a narrower viewport without changing its responsive breakpoint', () => {
  const { wrap, canvas, device, resize } = harness(320, 640);
  device('mobile');
  expect(wrap.style.width).toBe('320px');
  expect(canvas.style.width).toBe('414px');
  expect(canvas.style.height).toBe('828px');
  expect(canvas.style.transform).toBe(`scale(${320 / 414})`);
  resize(1000, 800);
  expect(wrap.style.width).toBe('414px');
  expect(canvas.style.height).toBe('800px');
  expect(canvas.style.transform).toBe('none');
});

test('leaving preview restores editor zoom and re-entering ignores that zoom', () => {
  const { w, d, wrap, canvas, device } = harness();
  device('tablet');
  d.body.classList.remove('preview');
  w.layoutCanvas();
  expect(wrap.style.width).toBe('417px');
  expect(canvas.style.height).toBe('1800px');
  expect(canvas.style.transform).toBe('scale(0.5)');
  d.body.classList.add('preview');
  w.layoutCanvas();
  expect(wrap.style.width).toBe('834px');
  expect(canvas.style.height).toBe('900px');
  expect(canvas.style.transform).toBe('none');
});
