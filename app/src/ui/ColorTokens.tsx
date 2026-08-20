/* The colour tokens editor, from the project dialog.

   Mounted into `#mColors`, which the dialog otherwise never touches — the same
   one-writer rule the panels were chosen by, applied inside a still-legacy dialog.

   The one subtlety is deliberate and inherited: typing must not repaint. Three things
   show a token's value — the swatch, the colour picker and the hex field — and a
   re-render on every keystroke would take the caret out of whichever one you are
   typing in. So the row updates its siblings imperatively while you type, exactly as
   the original did, and a full redraw happens only on add and delete. */
import { C, L, repaint } from './ctx';
import { Icon } from './Icon';

function Row({ id }: { id: string }) {
  const t = C.findColor(id);
  if (!t) return null;
  const locked = C.RESERVED.includes(t.id);
  const hexish = /^#[0-9a-f]{6}$/i.test(t.value) ? t.value : '#888888';

  /* one write path for both inputs, so the picker and the hex field cannot disagree */
  const set = (row: HTMLElement, v: string) => {
    L.tx('tok:' + id);
    const tok = C.findColor(id);
    if (!tok) return;
    tok.value = v;
    const sw = row.querySelector('.sw i') as HTMLElement | null;
    if (sw) sw.style.background = v;
    const cp = row.querySelector('input[type=color]') as HTMLInputElement | null;
    const cv = row.querySelector('.hexval') as HTMLInputElement | null;
    if (cp && /^#[0-9a-f]{6}$/i.test(v) && cp.value !== v) cp.value = v;
    if (cv && cv.value !== v) cv.value = v;
    L.paintCss(); L.save();
  };

  const remove = async () => {
    const used = C.colorUsage(id);
    if (used && !await L.askConfirm('Delete this colour token?',
      `<b>${esc(t.name)}</b> is used ${used}×. Those elements keep the colour, as a `
      + 'literal value — they just stop following the token.', { ok: 'Delete token' })) return;
    C.edit(() => C.colorDelete(id));
    repaint('colors');
    L.toast('Token deleted, colours kept');
  };

  const row = (e: Event) => (e.target as HTMLElement).closest('.arow') as HTMLElement;

  return (
    <div class="arow">
      <span class="sw">
        <i style={{ background: t.value }} />
        <input type="color" value={hexish} onInput={e => set(row(e), (e.target as HTMLInputElement).value)} />
      </span>
      <span class="an">
        <input class="ctl" value={t.name} style={{ fontSize: '12.5px', fontWeight: 600 }}
          onInput={e => {
            L.tx('tokname:' + id);
            const tok = C.findColor(id);
            if (tok) { tok.name = (e.target as HTMLInputElement).value; L.save(); }
          }} />
      </span>
      <input class="ctl hexval" value={t.value}
        style={{ width: '92px', flex: '0 0 92px', fontFamily: 'var(--mono)', fontSize: '11px' }}
        onInput={e => set(row(e), (e.target as HTMLInputElement).value.trim())} />
      {locked
        ? <span class="rowlock" title="Built in — part of the brand, so it cannot be deleted">
          <Icon name="lock" size={13} /></span>
        : <button class="iconbtn" title="Delete — usages keep this colour as a literal"
          onClick={remove}><Icon name="trash" size={13} /></button>}
    </div>
  );
}

export function ColorTokens() {
  const add = async () => {
    const name = await L.askText('New colour token', 'Colour name', 'New colour', { ok: 'Add colour' });
    if (name === null) return;
    C.edit(() => C.colorAdd(name, '#888888'));
    repaint('colors');
  };
  return (
    <>
      {C.colors().map(t => <Row key={t.id} id={t.id} />)}
      <button class="btn" style={{ width: '100%', justifyContent: 'center', fontSize: '11px' }}
        onClick={add}><Icon name="plus" size={12} /> Add colour</button>
    </>
  );
}

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
