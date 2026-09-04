/* One image field: what is set, how to replace it, and how to clear it.

   Used by the Pages panel for the share image and by the project dialog for the favicon
   and the default share image. It replaces `assetField` + `wireAsset` in builder.html,
   which were a markup function and a separate wiring function that found the markup
   again by id prefix — the same split the inspector had, on a smaller scale.

   The project dialog is still legacy, so it mounts this into its own `#mFavBox` and
   `#mOgBox`. That works for the same reason the panels do: each of those divs has
   exactly one writer, so Preact can own it outright. */
import { C, L } from './ctx';
import { Icon } from './Icon';

export function AssetField({ value, note, onChange }: {
  value: string | undefined;
  note?: string;
  onChange: (v: string) => void;
}) {
  const ref = String(value || '').match(/^asset:([A-Za-z0-9][A-Za-z0-9._:-]*)$/);
  const a = ref ? L.asset(ref[1]) : null;

  const take = async (file: File | undefined) => {
    if (!file) return;
    const id = await L.mediaTake(file);
    if (id) onChange('asset:' + id);
  };
  const choose = () => {
    const fi = document.createElement('input');
    fi.type = 'file'; fi.accept = 'image/*';
    fi.onchange = () => void take(fi.files ? fi.files[0] : undefined);
    fi.click();
  };
  /* clearing and picking from the library write straight through, because neither goes
     via mediaTake — which is what saves after an upload */
  const commit = (v: string) => { onChange(v); L.writeNow(); };

  const over = (e: DragEvent, on: boolean) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.toggle('over', on);
  };

  return (
    <>
      {a
        ? <div class="imgset">
          <img src={a.url} alt="" />
          <span class="an">
            <b>{a.name}</b>
            <small>{C.kb(a.size)}{a.w ? ` · ${a.w} × ${a.h}` : ''}</small>
          </span>
          <button type="button" class="x" title="Remove" onClick={() => commit('')}>
            <Icon name="trash" size={12} />
          </button>
        </div>
        : <div class="imgdrop" role="button" tabIndex={0} aria-label="Upload an image" onClick={choose}
          onKeyDown={e => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault(); choose();
          }}
          onDragEnter={e => over(e, true)} onDragOver={e => over(e, true)}
          onDragLeave={e => over(e, false)}
          onDrop={e => { over(e, false); void take(e.dataTransfer?.files[0]); }}>
          <b>Drop an image here</b><span>or choose a file</span>
        </div>}

      <div style={{ display: 'flex', gap: '6px', marginTop: 'var(--gap-1)' }}>
        <button type="button" class="btn grow" onClick={choose}>
          <Icon name="image" size={13} /> {a ? 'Replace' : 'Upload'}
        </button>
        {L.assetCount() ? (
          <button type="button" class="btn grow"
            title="Pick from the Media library"
            onClick={async () => { const id = await L.mediaPicker(); if (id) commit('asset:' + id); }}>
            <Icon name="copy" size={13} /> Library
          </button>
        ) : null}
      </div>
      {note ? <div class="note" dangerouslySetInnerHTML={{ __html: note }} /> : null}
    </>
  );
}
