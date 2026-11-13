import { useEffect, useId, useState } from 'preact/hooks';
import type { HostPage } from '../host/types';
import type { NativePageSource } from './ctx';

export interface NativePageChoice {
  readonly id: string;
  readonly title: string;
  readonly status: HostPage['status'];
  readonly url: string;
  readonly current: boolean;
}

export type NativePageState =
  | { readonly status: 'absent'; readonly pages: readonly NativePageChoice[] }
  | { readonly status: 'loading'; readonly pages: readonly NativePageChoice[] }
  | { readonly status: 'ready'; readonly pages: readonly NativePageChoice[] }
  | { readonly status: 'error'; readonly pages: readonly NativePageChoice[] };

/** WordPress supplies the canonical URLs. Still constrain them at the UI boundary:
    a compromised or stale response must not turn the project-link picker into an
    arbitrary protocol or cross-origin link source. */
export function nativePageChoices(
  pages: unknown, currentPageId: string, origin: string
): readonly NativePageChoice[] {
  if (!Array.isArray(pages)) throw new TypeError('WordPress page catalogue must be an array');
  const seen = new Set<string>();
  const choices: NativePageChoice[] = [];
  for (const row of pages) {
    if (!row || typeof row !== 'object') continue;
    const page = row as Partial<HostPage>;
    if (typeof page.id !== 'string' || typeof page.title !== 'string' || typeof page.url !== 'string'
      || !['draft', 'publish', 'private', 'trash'].includes(String(page.status))) continue;
    const id = page.id.trim();
    const title = page.title.trim();
    if (!id || !title || page.status === 'trash' || !page.url) continue;
    try {
      const url = new URL(page.url, origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password) continue;
      const href = url.href;
      if (seen.has(href)) continue;
      seen.add(href);
      choices.push({ id, title, status: page.status as HostPage['status'], url: href, current: id === currentPageId });
    } catch { /* An unreadable destination is not a usable choice. */ }
  }
  return choices;
}

export function nativePageForValue(
  pages: readonly NativePageChoice[], value: unknown, origin: string
): NativePageChoice | null {
  const exact = String(value == null ? '' : value).trim();
  if (!exact) return null;
  try {
    const url = new URL(exact, origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) return null;
    return pages.find(page => page.url === url.href) || null;
  } catch { return null; }
}

export function useNativePages(source: NativePageSource | null): NativePageState & { retry(): void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<NativePageState>(() => source
    ? { status: 'loading', pages: [] }
    : { status: 'absent', pages: [] });

  useEffect(() => {
    let live = true;
    if (!source) {
      setState({ status: 'absent', pages: [] });
      return () => { live = false; };
    }
    setState({ status: 'loading', pages: [] });
    Promise.resolve().then(() => source.list()).then(pages => {
      const choices = nativePageChoices(pages, source.currentPageId, window.location.origin);
      if (live) setState({ status: 'ready', pages: choices });
    }).catch(() => { if (live) setState({ status: 'error', pages: [] }); });
    return () => { live = false; };
  }, [source, attempt]);

  return { ...state, retry: () => setAttempt(value => value + 1) };
}

const statusLabel = (page: NativePageChoice) => page.status === 'publish'
  ? ''
  : ` · ${page.status === 'private' ? 'Private' : 'Draft'}`;

export function NativePagePicker({ state, value, savedProjectPath, savedLabel, onChange }: {
  state: NativePageState & { retry(): void };
  value: unknown;
  savedProjectPath?: string;
  savedLabel?: string;
  onChange(url: string, page: NativePageChoice): void;
}) {
  const selectId = useId();
  const exact = nativePageForValue(state.pages, value, window.location.origin);
  const raw = String(value == null ? '' : value).trim();
  const savedValue = raw && !exact ? '__saved' : '';
  const selected = exact?.url || savedValue;
  const fallbackLabel = savedLabel || (savedProjectPath
    ? `Saved project link · ${savedProjectPath}`
    : `Saved URL · ${raw}`);

  return <div class="native-page-picker" style={{ marginTop: 'var(--gap-1)' }}>
    <label htmlFor={selectId}>WordPress page</label>
    <select id={selectId} data-field-part="wordpress-page" class="ctl" value={selected}
      aria-busy={state.status === 'loading'}
      disabled={state.status !== 'ready' || !state.pages.length}
      onChange={event => {
        const next = (event.target as HTMLSelectElement).value;
        const page = state.pages.find(choice => choice.url === next);
        if (next && next !== '__saved' && page) onChange(next, page);
      }}>
      {savedValue ? <option value="__saved">{fallbackLabel}</option> : null}
      {!selected ? <option value="">{state.status === 'loading'
        ? 'Loading WordPress pages…'
        : state.status === 'error'
          ? 'WordPress pages unavailable'
          : state.status === 'ready' && !state.pages.length
            ? 'No WordPress pages available'
            : 'Choose a WordPress page'}</option> : null}
      {state.pages.map(page => <option key={page.id} value={page.url}>
        {page.title}{page.current ? ' · Current page' : ''}{statusLabel(page)}
      </option>)}
    </select>
    {state.status === 'ready' && !state.pages.length
      ? <div class="note">No readable WordPress pages are available.</div> : null}
    {savedProjectPath ? <div class="note">Choose a WordPress page to replace this saved project link.</div> : null}
    {state.status === 'error' ? <div class="note" role="alert">
      Could not load WordPress pages. <button type="button" class="btn tiny" onClick={state.retry}>Retry</button>
    </div> : null}
  </div>;
}
