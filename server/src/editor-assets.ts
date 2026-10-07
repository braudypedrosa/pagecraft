import { createHash } from "node:crypto";

export type EditorAssetBody = Uint8Array;

export interface EditorAsset {
  body: EditorAssetBody;
  contentType: string;
}

export interface HostedEditorAssets {
  html: string;
  assets: Map<string, EditorAsset>;
}

const asset = (body: string | Uint8Array, contentType: string): EditorAsset => ({
  body: typeof body === "string" ? new TextEncoder().encode(body) : body,
  contentType,
});

const pathFor = (body: Uint8Array, extension: "css" | "js" | "ttf") => {
  const hash = createHash("sha256").update(body).digest("hex");
  return `/brand/builder-assets/${hash}.${extension}`;
};

const attrs = (raw: string) => raw.trim() ? ` ${raw.trim()}` : "";

const classicScript = (raw: string) => {
  const match = raw.match(/(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!match) return true;
  const type = (match[1] || match[2] || match[3] || "").toLowerCase();
  return type === "text/javascript" || type === "application/javascript"
    || type === "text/ecmascript" || type === "application/ecmascript"
    || type === "";
};

const hasRuntimeConfig = (body: string) => /(?:window\s*\.\s*|globalThis\s*\.\s*)?PC_(?:SERVER|WORDPRESS)\s*=/.test(body);

/**
 * Make a cacheable hosted variant while leaving the canonical single-file editor alone.
 * The input is treated as immutable source: only the returned HTML and asset map change.
 */
export function extractHostedEditorAssets(editorHtml: string): HostedEditorAssets {
  const assets = new Map<string, EditorAsset>();
  const add = (body: string, contentType: string, extension: "css" | "js" | "ttf") => {
    const bytes = new TextEncoder().encode(body);
    const path = pathFor(bytes, extension);
    if (!assets.has(path)) assets.set(path, asset(bytes, contentType));
    return path;
  };

  const rewriteFonts = (css: string) => css.replace(
    /url\(\s*(['"]?)data:font\/ttf;base64,([A-Za-z0-9+/=]+)\1\s*\)/gi,
    (_whole, quote: string, encoded: string) => {
      const bytes = Uint8Array.from(Buffer.from(encoded, "base64"));
      const path = pathFor(bytes, "ttf");
      if (!assets.has(path)) assets.set(path, asset(bytes, "font/ttf"));
      return `url(${quote}${path}${quote})`;
    },
  );

  // One pass over both tag kinds retains their original positions and attributes.
  const tag = /<(style|script)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
  const html = editorHtml.replace(tag, (whole, kind: string, rawAttrs: string, body: string) => {
    const lower = kind.toLowerCase();
    if (lower === "style") {
      // The canvas copies this element's text into its isolated preview document on boot.
      // Keep the element and its attributes, while still moving the font bytes out of HTML.
      if (/\bid\s*=\s*(?:"pc-fonts"|'pc-fonts'|pc-fonts)(?:\s|$)/i.test(rawAttrs)) {
        return `<style${attrs(rawAttrs)}>${rewriteFonts(body)}</style>`;
      }
      if (body.length < 4096) {
        return `<style${attrs(rawAttrs)}>${rewriteFonts(body)}</style>`;
      }
      const path = add(rewriteFonts(body), "text/css", "css");
      return `<link rel="stylesheet" href="${path}"${attrs(rawAttrs)}>`;
    }
    if (body.length < 4096 || !classicScript(rawAttrs) || /\bsrc\s*=/i.test(rawAttrs)
      || hasRuntimeConfig(body)) return whole;
    const path = add(body, "text/javascript", "js");
    return `<script${attrs(rawAttrs)} src="${path}"></script>`;
  });

  return { html, assets };
}

/** Public name used by the hosted route integration. */
export const prepareHostedEditor = extractHostedEditorAssets;
