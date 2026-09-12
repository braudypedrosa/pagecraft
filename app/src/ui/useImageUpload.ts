import { L } from './ctx';
import { useProcessingAction } from './useProcessingAction';

/** Inspector, gallery, CMS and SEO fields share one upload gesture and result. */
export function useImageUpload(key: string, take: (ids: string[]) => void, multiple = false, disabled = false) {
  const action = useProcessingAction(key);
  const uploadFiles = async (files: FileList | File[]) => {
    const selected = Array.from(files || []);
    if (!selected.length || disabled) return;
    return await action.run<string[]>({pending: 'Uploading images…', success: ids => `${ids.length === 1 ? 'Image' : ids.length + ' images'} uploaded.`}, async progress => {
      const ids: string[] = [], failed: string[] = [];
      for (const file of selected) {
        progress.update('Uploading ' + file.name + '…');
        try { const id = await L.mediaTake(file, {feedback:false}); if (id) ids.push(id); }
        catch { failed.push(file.name); }
      }
      if (ids.length) take(ids);
      if (failed.length) throw new Error(`${ids.length ? ids.length + ' uploaded. ' : ''}Could not upload ${failed.join(', ')}. Retry those files.`);
      return ids.length ? ids : false;
    });
  };
  const choose = async () => {
    if (disabled || action.isPending()) return;
    const id = await L.mediaPicker({view:'upload', multiple, onFiles:async files => (await uploadFiles(files))?.status === 'success'});
    if (id) { take([id]); L.writeNow(); }
  };
  return {busy:action.busy, choose, takeFiles: async (files: FileList | File[]) => { await uploadFiles(files); }};
}
