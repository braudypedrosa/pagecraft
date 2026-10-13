import {afterEach, expect, test, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

let dom;
afterEach(() => { dom?.window.close(); dom = null; vi.restoreAllMocks(); });

function setup() {
  dom = new JSDOM('<!doctype html><body></body>', {url:'http://localhost/'});
  const source = readFileSync('builder.html', 'utf8');
  const start = source.indexOf('function mediaChooseFiles(');
  const end = source.indexOf('/* Only OS file drags', start);
  const context = {document:dom.window.document};
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  return {window:dom.window, document:dom.window.document, choose:context.mediaChooseFiles};
}

test('the media file input stays attached through selection, forwards files once, then cleans up', () => {
  const {window, document, choose} = setup();
  let input;
  vi.spyOn(window.HTMLInputElement.prototype, 'click').mockImplementation(function () {
    input = this;
    expect(this.isConnected).toBe(true);
  });
  const takeFiles = vi.fn();
  choose(takeFiles, false);
  expect(input.accept).toBe('image/*');
  expect(input.multiple).toBe(false);
  expect(document.body.contains(input)).toBe(true);
  const files = [new window.File(['image'], 'chosen.png', {type:'image/png'})];
  Object.defineProperty(input, 'files', {value:files});
  input.dispatchEvent(new window.Event('change'));
  expect(takeFiles).toHaveBeenCalledOnce();
  expect(takeFiles).toHaveBeenCalledWith(files);
  expect(input.isConnected).toBe(false);
  input.dispatchEvent(new window.Event('change'));
  expect(takeFiles).toHaveBeenCalledOnce();
});

test('cancel removes the attached media file input without starting an upload', () => {
  const {window, document, choose} = setup();
  let input;
  vi.spyOn(window.HTMLInputElement.prototype, 'click').mockImplementation(function () { input = this; });
  const takeFiles = vi.fn();
  choose(takeFiles);
  expect(input.multiple).toBe(true);
  expect(document.body.contains(input)).toBe(true);
  input.dispatchEvent(new window.Event('cancel'));
  expect(takeFiles).not.toHaveBeenCalled();
  expect(input.isConnected).toBe(false);
});
