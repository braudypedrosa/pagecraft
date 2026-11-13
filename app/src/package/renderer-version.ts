/**
 * Portable package renderer revisions describe generated HTML/CSS behavior.
 * They advance independently from the editable document schema.
 */
export const PORTABLE_RENDERER_REVISION = 'pagecraft-renderer-3' as const;
export const PORTABLE_RENDERER_REVISIONS = [
  'pagecraft-renderer-1',
  'pagecraft-renderer-2',
  PORTABLE_RENDERER_REVISION,
] as const;
const RICH_TABS_SCHEMA = 15;
export const portableRendererRevisionForSchema = (schemaVersion: number) =>
  schemaVersion >= RICH_TABS_SCHEMA ? PORTABLE_RENDERER_REVISION : 'pagecraft-renderer-2';
// Keep this schema tag stable for installed WordPress readers. Independent
// renderer revisions preserve the same editable document contract.
export const portableRendererVersionForSchema = (schemaVersion: number) => `pagecraft-core-${schemaVersion}`;

/**
 * Schema 15 introduces editable tab panels and requires renderer 3. Earlier schemas
 * retain their original renderer contract so immutable customer packages stay readable.
 */
export function supportsPortableRendererContract(
  rendererVersion: unknown,
  rendererRevision: unknown,
  schemaVersion: number,
  currentSchemaVersion: number,
) {
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > currentSchemaVersion) {
    return false;
  }
  if (rendererVersion !== portableRendererVersionForSchema(schemaVersion)) return false;
  if (schemaVersion >= RICH_TABS_SCHEMA) return rendererRevision === portableRendererRevisionForSchema(schemaVersion);
  return rendererRevision === undefined
    || (rendererRevision !== PORTABLE_RENDERER_REVISION
      && PORTABLE_RENDERER_REVISIONS.includes(rendererRevision as typeof PORTABLE_RENDERER_REVISIONS[number]));
}
