/* The style-classes list, from the project dialog. Mounted into #mClasses.

   Renaming types into the model without repainting, for the same reason the colour
   rows do: a redraw would take the caret out of the field. Reordering and deleting do
   redraw, because both change the list itself. */
import { C, L, repaint } from './ctx';
import { Icon } from './Icon';

/** How many declarations a class carries, across all three breakpoints. It is the only
    number that tells you whether a class is doing anything. */
const declCount = (css: { d: object; t: object; m: object }) =>
  (['d', 't', 'm'] as const).reduce((k, b) => k + Object.keys(css[b] || {}).length, 0);

export function StyleClasses() {
  const list = C.classes();

  if (!list.length) {
    return <div class="note">No classes yet. Select an element, open <b>Style</b>, and
      save its styling as a class.</div>;
  }

  const remove = async (id: string) => {
    const c = C.findClass(id);
    if (!c) return;
    const uses = C.classUsage(id);
    if (uses && !await L.askConfirm('Delete this class?',
      `<b>${esc(c.name)}</b> is used by ${uses} element${uses === 1 ? '' : 's'}. They keep `
      + 'their current look — they just stop sharing it.', { ok: 'Delete class' })) return;
    C.edit(() => C.classDelete(id));
    repaint('classes');
    L.toast('Class deleted, looks kept');
  };

  return (
    <>
      {list.map((c, i) => {
        const props = declCount(c.css);
        return (
          <div class="arow" key={c.id}>
            <span style={{
              flex: '0 0 34px', textAlign: 'center', fontFamily: 'var(--label)',
              fontSize: '11px', color: 'var(--text-3)'
            }}>.{c.id.slice(0, 4)}</span>
            <span class="an">
              <input class="ctl" value={c.name} style={{ fontSize: '12.5px', fontWeight: 600 }}
                onInput={e => {
                  L.tx('clsname:' + c.id);
                  const cls = C.findClass(c.id);
                  if (cls) { cls.name = (e.target as HTMLInputElement).value; L.save(); }
                }} />
            </span>
            <span class="rowmeta" title={`${props} declaration${props === 1 ? '' : 's'} in this class`}>
              {props} decl
            </span>
            <button class="iconbtn" title="Raise precedence" disabled={i === 0}
              onClick={() => { C.edit(() => C.classMove(c.id, -1)); repaint('classes'); }}>
              <Icon name="caretUp" size={12} /></button>
            <button class="iconbtn" title="Delete — elements keep the look"
              onClick={() => remove(c.id)}><Icon name="trash" size={13} /></button>
          </div>
        );
      })}
      <div class="note">Lower overrides higher. Element styling wins.</div>
    </>
  );
}

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
