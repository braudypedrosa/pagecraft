/**
 * Portable package renderer revisions describe generated HTML/CSS behavior.
 * They advance independently from the editable document schema.
 */
export const PORTABLE_RENDERER_REVISION = 'pagecraft-renderer-2' as const;
export const PORTABLE_RENDERER_REVISIONS = [
  'pagecraft-renderer-1',
  PORTABLE_RENDERER_REVISION,
] as const;
// Keep this schema tag stable for installed WordPress readers. Independent
// renderer revisions preserve the same editable document contract.
export const portableRendererVersionForSchema = (schemaVersion: number) => `pagecraft-core-${schemaVersion}`;

/**
 * Packages created before independent renderer revisions used the document schema
 * as their renderer version. Keep those immutable archives importable, but accept
 * only an exact schema tag and either no independent revision (legacy) or a
 * renderer revision shipped by this reader.
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
  return rendererRevision === undefined
    || PORTABLE_RENDERER_REVISIONS.includes(rendererRevision as typeof PORTABLE_RENDERER_REVISIONS[number]);
}
