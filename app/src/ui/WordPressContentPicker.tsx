import { C, L } from './ctx';
import type { WordPressContentItem, WordPressContentTarget } from './ctx';
import { useId } from 'preact/hooks';

export interface WordPressDestination {
  readonly target: WordPressContentTarget;
  readonly item: WordPressContentItem;
  readonly reference: string;
  readonly path: string;
}

/** Keep target ordering stable wherever the picker appears. Staging comes first to
    match Pagecraft's promotion flow, while each group retains WordPress's own order. */
export function wordpressContentTargets(): readonly WordPressContentTarget[] {
  return L.wordpressContent()
    .filter(target => target.items.length > 0)
    .slice()
    .sort((a, b) => a.environment === b.environment
      ? a.targetOrigin.localeCompare(b.targetOrigin)
      : a.environment === 'staging' ? -1 : 1);
}

/** Reduce an indexed absolute permalink to the route namespace below this target's
 * WordPress home. Staging and production may use different subdirectory paths. */
export function wordpressReferenceForItem(
  target: WordPressContentTarget,
  item: WordPressContentItem
): { reference: string; path: string } | null {
  try {
    const url = new URL(item.url);
    if (url.origin !== target.targetOrigin || url.hash || url.search) return null;
    const home = target.targetPath === '/' ? '' : target.targetPath.replace(/\/+$/, '');
    if (home && url.pathname !== home && !url.pathname.startsWith(home + '/')) return null;
    const path = home ? (url.pathname.slice(home.length) || '/') : url.pathname;
    const reference = C.buildWordPressContentReference(item.objectType, path);
    const parsed = C.parseWordPressContentReference(reference);
    return parsed ? { reference, path: parsed.path } : null;
  } catch { return null; }
}

/** Recognize a neutral reference and legacy exact indexed URLs. Newly committed
 * picker choices always use the target-neutral reference. */
export function wordpressDestinationForValue(value: unknown): WordPressDestination | null {
  const exact = String(value == null ? '' : value).trim();
  if (!exact) return null;
  const parsedReference = C.parseWordPressContentReference(exact);
  for (const target of wordpressContentTargets()) {
    for (const item of target.items) {
      const neutral = wordpressReferenceForItem(target, item);
      if (!neutral) continue;
      if (exact === item.url || (parsedReference
        && parsedReference.objectType === item.objectType
        && parsedReference.path === neutral.path)) {
        return { target, item, reference: neutral.reference, path: neutral.path };
      }
    }
  }
  return null;
}

export const wordpressTargetLabel = (target: WordPressContentTarget) =>
  `${target.environment === 'production' ? 'Production' : 'Staging'} · ${target.targetOrigin}${target.targetPath === '/' ? '' : target.targetPath}`;

const itemTypeLabel = (type: string) => {
  const clean = type.trim().replace(/[-_]+/g, ' ');
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Content';
};

/** The picker stores a typed route relative to WordPress home. The compiler turns it
    into a signed placeholder, so a target hostname never enters a release. */
export function WordPressContentPicker({ value, onChange }: {
  value: unknown;
  onChange: (reference: string) => void;
}) {
  const targets = wordpressContentTargets();
  const selectId = useId();
  const noteId = useId();
  if (!targets.length) return null;
  const selected = wordpressDestinationForValue(value)?.reference || '';

  return <div class="wp-link-picker">
    <label htmlFor={selectId}>WordPress content</label>
    <select id={selectId} class="ctl" value={selected} aria-describedby={noteId}
      onChange={event => onChange((event.target as HTMLSelectElement).value)}>
      <option value="">Use a custom URL</option>
      {targets.map(target => (
        <optgroup key={target.connectionId} label={wordpressTargetLabel(target)}>
          {target.items.map(item => {
            const neutral = wordpressReferenceForItem(target, item);
            return neutral ? <option key={`${target.connectionId}:${item.id}`} value={neutral.reference}>
              {item.title} · {itemTypeLabel(item.objectType)} · {neutral.path}
            </option> : null;
          })}
        </optgroup>
      ))}
    </select>
    <div class="note" id={noteId}>WordPress-owned content stays editable only in WordPress. Pagecraft stores its target-neutral route.</div>
  </div>;
}
