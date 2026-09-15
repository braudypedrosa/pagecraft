import { test, expect, vi } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import { reviewBridge } from '../src/live-review-client.ts';

function fixture() {
  const dom = new JSDOM('<body><section id="hero"><h1 id="title"><span>Our work</span></h1><a href="pricing.html">Pricing</a></section></body>', {runScripts:'outside-only'});
  const w = dom.window;
  w.ResizeObserver = class {observe(){} disconnect(){}} as any;
  const sent = vi.fn(); w.postMessage = sent;
  w.eval(`(${reviewBridge.toString()})('channel')`);
  const message = (data: object, source: any = w) => w.dispatchEvent(new w.MessageEvent('message', {source, data:{reviewChannel:'channel',...data}}));
  return {dom,w,sent,message};
}

test('element and section targeting highlight before placement and retain the chosen anchor', () => {
  const {dom,w,sent,message} = fixture();
  const span = w.document.querySelector('h1 span')!;
  const outline = w.document.getElementById('pc-review-outline')!;
  span.dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true}));
  expect(outline.hidden).toBe(false);
  span.dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:25,clientY:50,detail:1}));
  expect(sent.mock.lastCall?.[0].pin.nodeId).toBe(span.id);
  expect(span.id).toMatch(/^pc-review-anchor-/);
  message({pending:null,targetMode:'section'});
  span.dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true}));
  expect(outline.textContent).toContain('Section');
  span.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  expect(sent.mock.lastCall?.[0].pin.nodeId).toBe('hero');
  // A second click cannot move a pin while its draft is being composed.
  const calls = sent.mock.calls.length;
  w.document.querySelector('a')!.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  expect(sent).toHaveBeenCalledTimes(calls);
  dom.window.close();
});

test('browse mode removes hover chrome; foreign messages cannot switch mode; generated anchors survive reloads', () => {
  const first = fixture(), second = fixture();
  expect(first.w.document.querySelector('h1 span')!.id).toBe(second.w.document.querySelector('h1 span')!.id);
  first.message({mode:'browse'}, null);
  const link = first.w.document.querySelector('a')!;
  link.dispatchEvent(new first.w.MouseEvent('click',{bubbles:true,cancelable:true}));
  expect(first.sent.mock.lastCall?.[0].pin).toBeTruthy();
  first.message({mode:'browse',pending:null,selected:null});
  expect(first.w.document.getElementById('pc-review-outline')!.hidden).toBe(true);
  link.dispatchEvent(new first.w.MouseEvent('click',{bubbles:true,cancelable:true}));
  expect(first.sent.mock.lastCall?.[0].navigate).toBe('pricing.html');
  first.dom.window.close(); second.dom.window.close();
});

test('site outline maps elements to their containing section', () => {
  const {dom,sent,message} = fixture();
  message({requestOutline:true});
  const data = sent.mock.lastCall?.[0];
  expect(data.outline).toEqual([{id:'hero',label:'Our work'}]);
  expect(data.anchors).toContainEqual({id:'title',sectionId:'hero',label:'Heading · Our work'});
  dom.window.close();
});
