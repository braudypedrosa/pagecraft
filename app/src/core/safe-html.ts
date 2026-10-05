/* Markup that somebody other than the owner may have written: a CMS entry, a library someone
   shared, an Embed drawn on the editor's own origin.

   Pure and DOM-free, so the editor, the published render and the library import share one
   answer. Every tag that survives is re-serialised from what was parsed here, with its values
   escaped — the browser then reads exactly what was checked, and a parsing difference between
   this tokenizer and a browser can only lose markup, never run it. */

/* Only link schemes that are safe to put in an exported href. Anything else
   (javascript:, vbscript:, data:text/html, …) becomes an empty link. */
export const safeUrl = (u: unknown) => {
  const v = String(u == null ? '' : u).trim();
  if (!v) return '';
  if (/^(https?:\/\/|mailto:|tel:|#|\/|\.{1,2}\/)/i.test(v)) return v;
  if (/^data:image\//i.test(v) || /^asset:[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v)) return v;
  if (/^[\w.-]+(\/|\?|#|$)/.test(v)) return v;            // page.html, example.com/x
  return '';
};

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Enough of the character references to read a URL the way a browser will. One this table does
   not know is written back literally (`&amp;name;`), so it can only stop a scheme matching. */
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', colon: ':', Tab: '\t', NewLine: '\n',
  sol: '/', lpar: '(', rpar: ')', period: '.', comma: ',', semi: ';', equals: '=', excl: '!', num: '#', quest: '?', plus: '+',
};
const decode = (s: string) => s.replace(/&(?:#(\d+)|#x([0-9a-f]+));?|&([A-Za-z]+);/gi, (whole, dec, hex, name) => {
  if (name) return Object.prototype.hasOwnProperty.call(NAMED, name) ? NAMED[name] : whole;
  const cp = dec ? parseInt(dec, 10) : parseInt(hex, 16);
  return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : '�';
});
/** What a browser resolves a URL attribute to, for a scheme check: references decoded, and the
    whitespace and control characters it strips removed. */
const urlProbe = (raw: string) => decode(raw).replace(/[\u0000- \u007f]/g, '').toLowerCase();

interface Attr { name: string; value: string | null }
interface StartTag { name: string; attrs: Attr[]; selfClosing: boolean; end: number }

const ws = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
/** One start tag from the `<` at `at`, read the way the HTML tokenizer reads one: quotes open a
    value only after `=`, `/` separates attributes, and a quoted value needs no space before the
    next attribute. Null when the input ends inside the tag, which a browser drops too. */
function startTag(src: string, at: number): StartTag | null {
  let i = at + 1, name = '';
  while (i < src.length && !ws(src[i]) && src[i] !== '/' && src[i] !== '>') name += src[i++];
  const attrs: Attr[] = [];
  let selfClosing = false;
  while (i < src.length) {
    const c = src[i];
    if (ws(c)) { i++; continue; }
    if (c === '>') return { name, attrs, selfClosing, end: i + 1 };
    if (c === '/') { i++; selfClosing = src[i] === '>'; continue; }
    selfClosing = false;
    let an = src[i++];
    while (i < src.length && !ws(src[i]) && src[i] !== '/' && src[i] !== '>' && src[i] !== '=') an += src[i++];
    while (i < src.length && ws(src[i])) i++;
    if (src[i] !== '=') { attrs.push({ name: an, value: null }); continue; }
    i++;
    while (i < src.length && ws(src[i])) i++;
    const q = src[i];
    if (q === '"' || q === "'") {
      const close = src.indexOf(q, i + 1);
      if (close < 0) return null;
      attrs.push({ name: an, value: decode(src.slice(i + 1, close)) });
      i = close + 1;
      continue;
    }
    let v = '';
    while (i < src.length && !ws(src[i]) && src[i] !== '>') v += src[i++];
    attrs.push({ name: an, value: decode(v) });
  }
  return null;
}

/* What the canvas is allowed to run from an Embed: nothing. The export ships the
   markup verbatim — that is the whole point of the widget — but the editor renders
   inside a live iframe on the same origin, so a pasted analytics tag or a widget
   loader would execute on every repaint, once per keystroke. Everything that can run goes:
   the `<script>` element, an `on*` handler however it is separated from its tag
   (`<svg/onload=…>`), a `javascript:` URL in any attribute, and an iframe's `srcdoc`.

   Every `<` followed by a letter is treated as a tag — inside a comment or a `<style>` too,
   where a browser would see text — so nothing a browser could read as a tag passes unexamined.
   Returns how many it held back, because an embed that renders as nothing needs to say why. */
export function stripScripts(html: unknown) {
  let stripped = 0;
  const src = String(html == null ? '' : html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, () => { stripped++; return ''; })
    .replace(/<script\b[^>]*\/?>/gi, () => { stripped++; return ''; });
  const tagAt = /<[a-z]/gi;
  let out = '', at = 0;
  for (;;) {
    tagAt.lastIndex = at;
    const hit = tagAt.exec(src);
    if (!hit) { out += src.slice(at); break; }
    out += src.slice(at, hit.index);
    const t = startTag(src, hit.index);
    if (!t) break;
    at = t.end;
    if (t.name.toLowerCase() === 'script') { stripped++; continue; }
    const kept = t.attrs.filter(a => {
      const name = a.name.toLowerCase();
      const value = a.value == null ? '' : urlProbe(a.value);
      const bad = !/^[a-z_:][-a-z0-9_:.]*$/.test(name) || name.startsWith('on') || name === 'srcdoc'
        || /(java|vb)script:/.test(value) || (name === 'attributename' && value.startsWith('on'));
      if (bad) stripped++;
      return !bad;
    });
    out += `<${t.name}${kept.map(a => ' ' + a.name + (a.value == null ? '' : `="${escAttr(a.value)}"`)).join('')}${t.selfClosing ? '/' : ''}>`;
  }
  return { html: out, stripped };
}

/* Rich text is content, but executable markup is not. The allowlist the server's `safe-html.ts`
   holds: the controls of the editor's rich-text toolbar, links with a safe scheme, and no
   attribute but a link's href. Other tags are dropped and their words kept, except where the
   words are code; comments go; and what is left open is closed, so a stray `<b>` in one entry
   cannot embolden the rest of the page. */
const RICH_TAGS = new Set(['p', 'br', 'h2', 'h3', 'blockquote', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'a', 'div']);
const DROP_WITH_TEXT = new Set(['script', 'style', 'textarea', 'option', 'noscript', 'template', 'title', 'iframe', 'xmp', 'noembed', 'noframes']);
/* Built at runtime: the core is inlined into the editor's own script, where a literal comment
   opener would change how the browser tokenizes it (`boot.test.mjs` enforces this). */
const COMMENT_OPEN = String.fromCharCode(60, 33, 45, 45);
/* opening one of these closes an open paragraph, as it does in a browser */
const CLOSES_P = new Set(['p', 'div', 'h2', 'h3', 'ul', 'ol', 'blockquote']);
const richHref = (v: string) => {
  const probe = urlProbe(v);
  if (/^(https?:|mailto:|tel:)/.test(probe)) return true;
  return !probe.startsWith('//') && !/^[^/?#]*:/.test(probe);       // relative, with no scheme
};

export function cleanRich(html: unknown): string {
  const src = String(html == null ? '' : html);
  const lower = src.toLowerCase();
  const endTag = /<\/([a-z][^\s/>]*)[^>]*>/iy;
  const open: string[] = [];
  const close = (k: number) => { let s = ''; while (open.length > k) s += `</${open.pop()}>`; return s; };
  let out = '', at = 0;
  while (at < src.length) {
    const lt = src.indexOf('<', at);
    if (lt < 0) { out += src.slice(at).replace(/>/g, '&gt;'); break; }
    out += src.slice(at, lt).replace(/>/g, '&gt;');
    const next = src[lt + 1] || '';
    if (src.startsWith(COMMENT_OPEN, lt)) {
      const end = src.indexOf('--' + '>', lt + 2);
      at = end < 0 ? src.length : end + 3;
      continue;
    }
    if (next === '!' || next === '?' || (next === '/' && !/[a-z]/i.test(src[lt + 2] || ''))) {
      const end = src.indexOf('>', lt);
      at = end < 0 ? src.length : end + 1;
      continue;
    }
    if (next === '/') {
      endTag.lastIndex = lt;
      const m = endTag.exec(src);
      if (!m) break;
      const k = open.lastIndexOf(m[1].toLowerCase());
      if (k >= 0) out += close(k);
      at = lt + m[0].length;
      continue;
    }
    if (!/[a-z]/i.test(next)) { out += '&lt;'; at = lt + 1; continue; }
    const t = startTag(src, lt);
    if (!t) break;
    const name = t.name.toLowerCase();
    at = t.end;
    if (DROP_WITH_TEXT.has(name)) {
      const shut = lower.indexOf(`</${name}`, at);
      const end = shut < 0 ? -1 : src.indexOf('>', shut);
      at = end < 0 ? src.length : end + 1;
      continue;
    }
    if (!RICH_TAGS.has(name)) continue;
    if (name === 'br') { out += '<br>'; continue; }
    if (CLOSES_P.has(name) && open.includes('p')) out += close(open.lastIndexOf('p'));
    if (name === 'li') {
      for (let k = open.length - 1; k >= 0 && !['ul', 'ol', 'blockquote', 'h2', 'h3'].includes(open[k]); k--) {
        if (open[k] === 'li') { out += close(k); break; }
      }
    }
    const href = name === 'a' ? t.attrs.find(a => a.name.toLowerCase() === 'href' && a.value != null) : null;
    out += href && richHref(href.value!) ? `<a href="${escAttr(href.value!)}">` : `<${name}>`;
    open.push(name);
  }
  return out + close(0);
}
