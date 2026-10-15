export const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function resolveEditorVersion(packageVersion, override = process.env.PAGECRAFT_EDITOR_VERSION) {
  const base = String(packageVersion || '').trim();
  if (!SEMVER.test(base)) throw new Error(`@pagecraft/editor package version “${base}” is not valid semver.`);
  const requested = String(override || '').trim();
  if (requested && !SEMVER.test(requested)) {
    throw new Error(`PAGECRAFT_EDITOR_VERSION “${requested}” is not valid semver.`);
  }
  return requested || base;
}
