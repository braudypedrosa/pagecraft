import { describe, expect, it } from "vitest";
import { extractHostedEditorAssets } from "../server/src/editor-assets.ts";

const text = (body: Uint8Array) => new TextDecoder().decode(body);
const long = (value: string) => value.repeat(Math.ceil(4096 / value.length));

describe("hosted editor asset extraction", () => {
  it("is deterministic and keeps tag ordering and attributes", () => {
    const source = `<style id="a" media="screen">${long(".a{color:red}")}</style>`
      + '<script id="small">window.small=1</script>'
      + `<script type="text/javascript" defer data-x="1">${long("window.large=1;")}</script>`
      + `<style data-last>${long(".b{color:blue}")}</style>`;
    const first = extractHostedEditorAssets(source);
    const second = extractHostedEditorAssets(source);
    expect(first.html).toBe(second.html);
    expect([...first.assets.keys()]).toEqual([...second.assets.keys()]);
    expect(first.html.indexOf('href="/brand/builder-assets/')).toBeLessThan(first.html.indexOf('id="small"'));
    expect(first.html).toContain('<link rel="stylesheet" href="');
    expect(first.html).toContain('id="a" media="screen"');
    expect(first.html).toContain('<script id="small">window.small=1</script>');
    expect(first.html).toContain('<script type="text/javascript" defer data-x="1" src="/brand/builder-assets/');
    expect(first.html.indexOf('src="/brand/builder-assets/')).toBeLessThan(first.html.indexOf('data-last'));
  });

  it("keeps small boot styles inline", () => {
    const source = '<style id="loader">.boot{display:grid}</style>';
    const result = extractHostedEditorAssets(source);
    expect(result.html).toBe(source);
    expect(result.assets.size).toBe(0);
  });

  it("extracts fonts with byte-identical hashed assets and rewrites CSS URLs", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 255]);
    const encoded = bytes.toString("base64");
    const result = extractHostedEditorAssets(`<style>${long(".font{font-weight:400}")}@font-face{src:url(data:font/ttf;base64,${encoded})}</style>`);
    const fontPath = [...result.assets.keys()].find(path => path.endsWith(".ttf"));
    expect(fontPath).toMatch(/^\/brand\/builder-assets\/[a-f0-9]{64}\.ttf$/);
    const cssPath = [...result.assets.keys()].find(path => path.endsWith(".css"));
    expect(text(result.assets.get(cssPath!)!.body)).toContain(`url(${fontPath})`);
    expect([...result.assets.entries()].find(([path]) => path === fontPath)?.[1].body).toEqual(Uint8Array.from(bytes));
  });

  it("keeps the canvas font style inline while externalizing its font bytes", () => {
    const encoded = Buffer.from([3, 4, 5]).toString("base64");
    const result = extractHostedEditorAssets(`<style id="pc-fonts" data-x="1">@font-face{src:url(data:font/ttf;base64,${encoded})}</style>`);
    expect(result.html).toMatch(/^<style id="pc-fonts" data-x="1">/);
    expect(result.html).toContain("/brand/builder-assets/");
    expect([...result.assets.keys()].every(path => path.endsWith(".ttf"))).toBe(true);
  });

  it("leaves small, module, external, and runtime-config scripts inline", () => {
    const source = '<script type="module">' + long("export const x=1;") + '</script>'
      + '<script src="/already.js">' + long("ignored=1;") + '</script>'
      + '<script>' + long("window.PC_SERVER={doc:'keep'};") + '</script>'
      + '<script>small()</script>';
    const result = extractHostedEditorAssets(source);
    expect(result.html).toBe(source);
    expect(result.assets.size).toBe(0);
  });

  it("does not interpret asset-looking strings as paths or mutate the source", () => {
    const source = `<script>${long("const s='</script>'; // /brand/builder-assets/../../secret")}</script>`;
    const copy = source.slice();
    const result = extractHostedEditorAssets(source);
    expect(source).toBe(copy);
    expect(result.html).toContain("/brand/builder-assets/../../secret");
    for (const path of result.assets.keys()) expect(path).toMatch(/^\/brand\/builder-assets\/[a-f0-9]{64}\.(css|js|ttf)$/);
  });
});
