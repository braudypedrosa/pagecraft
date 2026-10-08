/**
 * Portable package renderer revisions describe generated HTML/CSS behavior.
 * They advance independently from the editable document schema.
 */
export const PORTABLE_RENDERER_REVISION = 'pagecraft-renderer-1' as const;
// Keep this schema tag stable for installed v1 WordPress readers. Coordinate
// reader support before incrementing PORTABLE_RENDERER_REVISION in new exports.
export const portableRendererVersionForSchema = (schemaVersion: number) => `pagecraft-core-${schemaVersion}`;

/**
 * Packages created before independent renderer revisions used the document schema
 * as their renderer version. Keep those immutable archives importable, but accept
 * only an exact schema tag and either no independent revision (legacy) or the
 * current independent renderer revision.
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
  return rendererRevision === undefined || rendererRevision === PORTABLE_RENDERER_REVISION;
}
