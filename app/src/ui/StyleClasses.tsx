/* The style-classes list, from the project dialog. Mounted into #mClasses.

   Renaming types into the model without repainting, for the same reason the colour
   rows do: a redraw would take the caret out of the field. Reordering and deleting do
   redraw, because both change the list itself. */
import { C, L, repaint } from './ctx';
import { Icon } from './Icon';

export function StyleClasses() {
  const list = C.classes();

  const add = async () => {
    const name = await L.askText('New class style', 'Class name', 'New class', {
      ok: 'Add class',
      note: 'Apply it to an element, then edit its shared styling from the Style tab.'
    });
    if (name === null) return;
    C.edit(() => C.classAdd(name));
    repaint('classes');
    L.toast('Class style added');
  };

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
      {!list.length && <div class="note">No class styles yet. Add one here, then apply it
        to an element and edit its shared styling from the <b>Style</b> tab.</div>}
      {list.map((c, i) => {
        return (
          <div class="arow" key={c.id}>
            <span style={{
              flex: '0 0 34px', textAlign: 'center', fontFamily: 'var(--label)',
              fontSize: 'var(--fs-1)', color: 'var(--text-3)'
            }}>.{c.id.slice(0, 4)}</span>
            <span class="an">
              <input class="ctl" value={c.name} style={{ fontSize: 'var(--fs-2)', fontWeight: 600 }}
                onInput={e => {
                  L.tx('clsname:' + c.id);
                  const cls = C.findClass(c.id);
                  if (cls) { cls.name = (e.target as HTMLInputElement).value; L.save(); }
                }} onBlur={L.endTx} aria-label="Class name" />
            </span>
            <button class="iconbtn" title="Raise precedence" disabled={i === 0}
              onClick={() => { C.edit(() => C.classMove(c.id, -1)); repaint('classes'); }}>
              <Icon name="caretUp" size={12} /></button>
            <button class="iconbtn" title="Delete — elements keep the look"
              onClick={() => remove(c.id)}><Icon name="trash" size={13} /></button>
          </div>
        );
      })}
      <button class="btn block" style={{ fontSize: 'var(--fs-1)' }} onClick={add}>
        <Icon name="plus" size={12} /> Add class style
      </button>
      <div class="note">Lower overrides higher. Element styling wins.</div>
    </>
  );
}

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
