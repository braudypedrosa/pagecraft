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
import { isTemplateImage } from '../core/cms-validation';
import { useId } from 'preact/hooks';
import { useImageUpload } from './useImageUpload';

export function AssetField({ value, note, onChange, disabled = false }: {
  value: string | undefined;
  note?: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const key = useId();
  const {busy, choose, takeFiles} = useImageUpload('asset-field-' + key, ids => onChange('asset:' + ids[ids.length - 1]), false, disabled);
  const ref = String(value || '').match(/^asset:([A-Za-z0-9][A-Za-z0-9._:-]*)$/);
  const a = ref ? L.asset(ref[1]) : null;
  const shared = isTemplateImage(String(value || ''));
  const hasImage = !!a || shared;

  /* clearing and picking from the library write straight through, because neither goes
     via mediaTake — which is what saves after an upload */
  const commit = (v: string) => { onChange(v); L.writeNow(); };

  const over = (e: DragEvent, on: boolean) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.toggle('over', on);
  };

  return (
    <>
      {hasImage
        ? <div class="imgset">
          <img src={a ? a.url : value} alt="" />
          <span class="an">
            <b>{a ? a.name : 'Template image'}</b>
            {a ? <small>{C.kb(a.size)}{a.w ? ` · ${a.w} × ${a.h}` : ''}</small> : null}
          </span>
          <button type="button" class="x" disabled={disabled || busy} title="Remove" onClick={() => { commit(''); L.toast('Image removed from this field.'); }}>
            <Icon name="trash" size={12} />
          </button>
        </div>
        : <div class="imgdrop" role="button" tabIndex={disabled || busy ? -1 : 0} aria-disabled={disabled || busy} aria-busy={busy} aria-label="Upload an image" onClick={choose}
          onKeyDown={e => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault(); choose();
          }}
          onDragEnter={e => over(e, true)} onDragOver={e => over(e, true)}
          onDragLeave={e => over(e, false)}
          onDrop={e => { over(e, false); void takeFiles(e.dataTransfer?.files || []); }}>
          <b>{busy ? 'Uploading image…' : 'Drop an image here'}</b><span>{busy ? 'Please wait for the upload to finish.' : 'or choose a file'}</span>
        </div>}

      <div style={{ display: 'flex', gap: '6px', marginTop: 'var(--gap-1)' }}>
        <button type="button" class="btn grow" disabled={disabled || busy} aria-busy={busy} data-pc-pending={busy ? '' : undefined} onClick={choose}>
          {!busy && <Icon name="image" size={13} />} {busy ? 'Uploading…' : hasImage ? 'Replace' : 'Upload'}
        </button>
        {L.assetCount() ? (
          <button type="button" class="btn grow" disabled={disabled || busy}
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
