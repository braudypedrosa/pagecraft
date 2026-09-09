import { useEffect, useRef, useState } from 'preact/hooks';
import { C, L } from './ctx';
import type { Collection, Field, Item } from '../core/types';
import {
  cmsBoolean,
  cmsChoices,
  cmsSafeRich,
  validateCmsEntry,
} from '../core/cms-validation';
import { AssetField } from './AssetField';
import { Icon } from './Icon';

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const PAGE_SIZE = 25;
export function CmsWorkspace({
  collectionId,
  close,
}: {
  collectionId: string;
  close(): void;
}) {
  const [id, setId] = useState(collectionId);
  const [revision, refresh] = useState(0);
  const col = C.findCollection(id)!;
  const [entry, setEntry] = useState<Item | null>(null);
  const [schema, setSchema] = useState<Collection | null>(null);
  const [baseline, setBaseline] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const root = useRef<HTMLElement>(null);
  const dirty =
    !!(entry || schema) && JSON.stringify(entry || schema) !== baseline;
  const discard = () =>
    !dirty || window.confirm('Discard your unsaved CMS changes?');
  const leave = () => {
    if (!busy && discard()) close();
  };
  useEffect(() => {
    const navigate = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('#leftRail button, .topbar button, .topbar a')) return;
      if (target.closest('#leftRail button[data-t="cms"]') || busy || !discard()) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      close();
    };
    document.addEventListener('click', navigate, true);
    return () => document.removeEventListener('click', navigate, true);
  }, [dirty, busy, close]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty || busy) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, [dirty, busy]);
  useEffect(() => {
    root.current?.focus();
  }, []);
  useEffect(() => {
    root.current?.querySelector('.cms-content')?.scrollTo?.(0, 0);
    root.current
      ?.querySelector<HTMLElement>('form input, form [contenteditable]')
      ?.focus();
  }, [entry?.id, !!schema]);
  const reset = () => {
    setEntry(null);
    setSchema(null);
    setErrors({});
    setBaseline('');
  };
  const openEntry = (item?: Item) => {
    if (!discard()) return;
    const next = item
      ? copy(item)
      : { id: C.uid(), slug: '', draft: 1 as const, values: {} };
    reset();
    setEntry(next);
    setBaseline(item ? JSON.stringify(next) : '');
    setNotice('');
  };
  const commit = async (next: Collection[]) => {
    if (busy) return false;
    setBusy(true);
    setErrors({});
    try {
      await L.cmsCommit(next);
      refresh(revision + 1);
      setNotice('Saved to the site draft. Publish the site to make it public.');
      return true;
    } catch (e) {
      setErrors({
        _save:
          e instanceof Error
            ? e.message
            : 'Could not save. Your changes are still here.',
      });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const saveEntry = async () => {
    if (!entry) return;
    const next = copy(entry);
    next.slug =
      next.slug ||
      C.slugify(next.values[C.titleField(col)?.id || 'title'] || '');
    next.slugLocked = 1;
    const assets = new Set<string>();
    for (const f of col.fields)
      if (f.type === 'image') {
        const asset = next.values[f.id]?.match(/^asset:([^@]+)/)?.[1];
        if (asset && L.asset(asset)) assets.add(asset);
      }
    const validation = validateCmsEntry(C.doc(), col, next, assets);
    if (Object.keys(validation).length) {
      setErrors(validation);
      requestAnimationFrame(() => {
        const field = Object.keys(validation)[0];
        document
          .getElementById(field === '_slug' ? 'cms-slug' : 'cms-value-' + field)
          ?.focus();
      });
      return;
    }
    const old = col.items.find((i) => i.id === next.id);
    if (
      old &&
      old.slug !== next.slug &&
      !window.confirm(
        `Change /${col.slug}/${old.slug} to /${col.slug}/${next.slug}? Existing links will stop working; no redirect is created.`,
      )
    )
      return;
    const collections = copy(C.collections());
    const target = collections.find((c) => c.id === id)!;
    const at = target.items.findIndex((i) => i.id === next.id);
    if (at < 0) target.items.push(next);
    else target.items[at] = next;
    if (await commit(collections)) {
      setEntry(next);
      setBaseline(JSON.stringify(next));
    }
  };
  const saveSchema = async () => {
    if (!schema) return;
    const invalid: Record<string, string> = {};
    if (!schema.name.trim()) invalid._schema = 'Give this collection a name.';
    schema.fields.forEach((f) => {
      if (!f.name.trim()) invalid[f.id] = 'Give the field a name.';
      if (f.type === 'option' && !cmsChoices(f.opts).length)
        invalid[f.id] = 'Add at least one choice.';
      if (f.type === 'ref' && !C.findCollection(f.ref || ''))
        invalid[f.id] = 'Choose a reference collection.';
    });
    if (Object.keys(invalid).length) {
      setErrors(invalid);
      return;
    }
    const next = copy(C.collections());
    next[next.findIndex((c) => c.id === id)] = copy(schema);
    if (await commit(next)) setBaseline(JSON.stringify(schema));
  };
  const removeEntry = async (item: Item) => {
    if (
      !window.confirm(
        `Delete “${C.itemTitle(col, item) || item.slug}”? References to this entry will need updating. Its public page is removed on the next site publish.`,
      )
    )
      return;
    const next = copy(C.collections());
    next.find((c) => c.id === id)!.items = col.items.filter(
      (i) => i.id !== item.id,
    );
    await commit(next);
  };
  const updateField = (fid: string, changes: Partial<Field>) =>
    setSchema(
      (old) =>
        old && {
          ...old,
          fields: old.fields.map((f) =>
            f.id === fid ? { ...f, ...changes } : f,
          ),
        },
    );
  const filtered = col.items.filter(
    (i) =>
      (status === 'all' || (status === 'draft' ? !!i.draft : !i.draft)) &&
      [i.slug, ...Object.values(i.values)]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  return (
    <section
      class="cms-workspace"
      role="region"
      aria-label="CMS workspace"
      tabIndex={-1}
      ref={root}
      onKeyDown={(e) => {
        e.stopPropagation();
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          if (!busy) {
            if (entry) void saveEntry();
            else if (schema) void saveSchema();
          }
        }
        if (e.key === 'Escape') {
          e.stopPropagation();
          leave();
        }

      }}
    >
      <header class="cms-workspace-header">
        <div>
          <h1>CMS</h1>
          <p>Manage content, then connect it to your pages.</p>
        </div>
        <button class="btn" disabled={busy} onClick={leave}>
          Back to builder
        </button>
      </header>
      <div class="cms-workspace-layout">
        <nav class="cms-collections" aria-label="Collections">
          {C.collections().map((c) => (
            <button
              class={'btn block ' + (c.id === id ? 'primary' : '')}
              disabled={busy}
              onClick={() => {
                if (discard()) {
                  setId(c.id);
                  reset();
                  setNotice('');
                  setStatus('all');
                  setSearch('');
                  setPage(0);
                }
              }}
            >
              {c.name}
              <span>{c.items.length}</span>
            </button>
          ))}
        </nav>
        <main class="cms-content" aria-busy={busy}>
          <div class="cms-title">
            <div>
              <h2>{col.name}</h2>
              <p>
                {entry
                  ? col.items.some((i) => i.id === entry.id)
                    ? 'Edit entry'
                    : 'New entry'
                  : schema
                    ? 'Collection name and fields'
                    : `${col.items.length} entries`}
              </p>
            </div>
            {!entry && !schema && (
              <div class="cms-actions">
                {L.canStructure() && (
                  <button
                    class="btn"
                    onClick={() => {
                      const next = copy(col);
                      setSchema(next);
                      setBaseline(JSON.stringify(next));
                      setNotice('');
                    }}
                  >
                    Edit collection
                  </button>
                )}
                <button class="btn primary" onClick={() => openEntry()}>
                  New entry
                </button>
              </div>
            )}
          </div>
          {dirty && (
            <p class="cms-notice" role="status">
              Unsaved changes
            </p>
          )}
          {notice && !dirty && (
            <p class="cms-notice" role="status">
              {notice}
            </p>
          )}
          {Object.keys(errors).length > 0 && (
            <div class="cms-errors" role="alert">
              {Object.entries(errors).map(([key, message]) => (
                <p>
                  {key.startsWith('_')
                    ? ''
                    : `${col.fields.find((f) => f.id === key)?.name || key}: `}
                  {message}
                </p>
              ))}
            </div>
          )}
          {entry ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveEntry();
              }}
            >
              <fieldset disabled={busy} class="cms-entry-fields">
                {col.fields.map((f) => (
                  <div class="cms-field" key={f.id}>
                    <label
                      id={'cms-label-' + f.id}
                      htmlFor={'cms-value-' + f.id}
                    >
                      {f.name}
                      {f.required ? ' *' : ''}
                    </label>
                    <EntryValue
                      field={f}
                      disabled={busy}
                      error={errors[f.id]}
                      value={entry.values[f.id] || ''}
                      onChange={(value) =>
                        setEntry({
                          ...entry,
                          values: { ...entry.values, [f.id]: value },
                        })
                      }
                    />
                    {errors[f.id] && (
                      <small class="cms-error" id={'cms-error-' + f.id}>
                        {errors[f.id]}
                      </small>
                    )}
                  </div>
                ))}
                <div class="cms-field">
                  <label htmlFor="cms-slug">URL slug</label>
                  <input
                    class="ctl"
                    id="cms-slug"
                    value={entry.slug}
                    placeholder="Generated from the title on first save"
                    onInput={(e) =>
                      setEntry({ ...entry, slug: e.currentTarget.value })
                    }
                  />
                  <small>
                    /{col.slug}/{entry.slug || 'entry-slug'}
                  </small>
                </div>
                <label class="cms-check">
                  <input
                    type="checkbox"
                    checked={!entry.draft}
                    onChange={(e) =>
                      setEntry({
                        ...entry,
                        draft: e.currentTarget.checked ? undefined : 1,
                      })
                    }
                  />
                  Include on next publish
                </label>
                <p class="note">
                  Unchecked entries remain drafts and are hidden from the public
                  site.
                </p>
              </fieldset>
              <div class="cms-actions cms-form-actions">
                <button class="btn primary" disabled={busy} type="submit">
                  {busy ? 'Saving…' : 'Save entry'}
                </button>
                <button
                  type="button"
                  class="btn"
                  disabled={busy}
                  onClick={() => {
                    if (discard()) reset();
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : schema ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveSchema();
              }}
            >
              <fieldset disabled={busy} class="cms-entry-fields">
                <div class="cms-field">
                  <label htmlFor="cms-name">Collection name</label>
                  <input
                    id="cms-name"
                    class="ctl"
                    value={schema.name}
                    onInput={(e) =>
                      setSchema({ ...schema, name: e.currentTarget.value })
                    }
                  />
                </div>
                <p class="note">
                  Field IDs and the collection URL stay stable when names
                  change. Populated fields cannot change type.
                </p>
                {schema.fields.map((f, at) => (
                  <div class="cms-schema-field" key={f.id}>
                    <div class="cms-schema-inputs">
                      <label>
                        Field name
                        <input
                          class="ctl"
                          value={f.name}
                          onInput={(e) =>
                            updateField(f.id, { name: e.currentTarget.value })
                          }
                        />
                      </label>
                      <label>
                        Type
                        <select
                          class="ctl"
                          value={f.type}
                          disabled={col.items.some((i) => !!i.values[f.id])}
                          onChange={(e) =>
                            updateField(f.id, {
                              type: e.currentTarget.value as Field['type'],
                            })
                          }
                        >
                          {C.FIELD_TYPES.map(([value, label]) => (
                            <option value={value}>{label}</option>
                          ))}
                        </select>
                      </label>
                      {f.type === 'option' && (
                        <label>
                          Choices, separated by commas
                          <input
                            class="ctl"
                            value={f.opts || ''}
                            onInput={(e) =>
                              updateField(f.id, { opts: e.currentTarget.value })
                            }
                          />
                        </label>
                      )}
                      {f.type === 'ref' && (
                        <label>
                          Reference collection
                          <select
                            class="ctl"
                            value={f.ref || ''}
                            onChange={(e) =>
                              updateField(f.id, { ref: e.currentTarget.value })
                            }
                          >
                            <option value="">Choose a collection</option>
                            {C.collections().map((c) => (
                              <option value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label class="cms-check">
                        <input
                          type="checkbox"
                          checked={!!f.required}
                          onChange={(e) =>
                            updateField(f.id, {
                              required: e.currentTarget.checked ? 1 : 0,
                            })
                          }
                        />
                        Required
                      </label>
                    </div>
                    <div class="cms-actions">
                      <button
                        class="btn"
                        type="button"
                        disabled={at === 0}
                        onClick={() => {
                          const fields = [...schema.fields];
                          [fields[at - 1], fields[at]] = [
                            fields[at],
                            fields[at - 1],
                          ];
                          setSchema({ ...schema, fields });
                        }}
                      >
                        Move up
                      </button>
                      <button
                        class="btn"
                        type="button"
                        disabled={schema.fields.length === 1}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete ${f.name} and its stored values? ${bindingImpact(id, f.id)}`,
                            )
                          )
                            setSchema({
                              ...schema,
                              fields: schema.fields.filter(
                                (x) => x.id !== f.id,
                              ),
                              items: schema.items.map((i) => {
                                const values = { ...i.values };
                                delete values[f.id];
                                return { ...i, values };
                              }),
                            });
                        }}
                      >
                        Delete field
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  class="btn"
                  onClick={() =>
                    setSchema({
                      ...schema,
                      fields: [
                        ...schema.fields,
                        {
                          id: C.uniqueId(
                            'field',
                            schema.fields.map((f) => f.id),
                          ),
                          name: 'New field',
                          type: 'text',
                        },
                      ],
                    })
                  }
                >
                  Add field
                </button>
              </fieldset>
              <div class="cms-actions cms-form-actions">
                <button class="btn primary" disabled={busy}>
                  Save changes
                </button>
                <button
                  class="btn"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (discard()) reset();
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div class="cms-list-tools">
                <label>
                  Search entries
                  <input
                    type="search"
                    class="ctl"
                    value={search}
                    onInput={(e) => {
                      setSearch(e.currentTarget.value);
                      setPage(0);
                    }}
                  />
                </label>
                <label>
                  Status
                  <select
                    class="ctl"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.currentTarget.value);
                      setPage(0);
                    }}
                  >
                    <option value="all">All entries</option>
                    <option value="draft">Drafts</option>
                    <option value="ready">Included on next publish</option>
                  </select>
                </label>
              </div>
              <div class="cms-entry-list">
                {filtered
                  .slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
                  .map((item) => (
                    <div class="cms-entry-row" key={item.id}>
                      <button
                        class="cms-entry-open"
                        onClick={() => openEntry(item)}
                      >
                        <b>{C.itemTitle(col, item) || 'Untitled entry'}</b>
                        <small>
                          /{col.slug}/{item.slug}
                        </small>
                      </button>
                      <span>
                        {item.draft ? 'Draft' : 'Included on next publish'}
                      </span>
                      <button
                        class="btn"
                        aria-label={
                          'Delete ' + (C.itemTitle(col, item) || 'entry')
                        }
                        disabled={busy}
                        onClick={() => void removeEntry(item)}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  ))}
                {!filtered.length && (
                  <p class="empty">
                    {col.items.length
                      ? 'No entries match your search.'
                      : 'No entries yet. Create your first entry.'}
                  </p>
                )}
              </div>
              <div class="cms-actions cms-pagination">
                <button
                  class="btn"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {current + 1} of {pages} · {filtered.length} entries
                </span>
                <button
                  class="btn"
                  disabled={current + 1 >= pages}
                  onClick={() => setPage(current + 1)}
                >
                  Next
                </button>
              </div>

            </>
          )}
        </main>
      </div>
    </section>
  );
}

function EntryValue({
  field: f,
  value,
  onChange,
  disabled,
  error,
}: {
  disabled: boolean;
  error?: string;
  field: Field;
  value: string;
  onChange(value: string): void;
}) {
  const props = {
    id: 'cms-value-' + f.id,
    'aria-labelledby': 'cms-label-' + f.id,
    'aria-invalid': !!error,
    'aria-describedby': error ? 'cms-error-' + f.id : undefined,
  };
  if (f.type === 'image')
    return <AssetField value={value} onChange={onChange} />;
  if (f.type === 'rich')
    return (
      <RichValue
        id={props.id}
        label={props['aria-labelledby']}
        disabled={disabled}
        error={error ? 'cms-error-' + f.id : undefined}
        value={value}
        onChange={onChange}
      />
    );
  if (f.type === 'bool')
    return (
      <select
        {...props}
        class="ctl"
        value={value === '' ? '' : cmsBoolean(value) ? '1' : '0'}
        onChange={(e) => onChange(e.currentTarget.value)}
      >
        <option value="">Choose</option>
        <option value="1">Yes</option>
        <option value="0">No</option>
      </select>
    );
  if (f.type === 'option' || f.type === 'ref') {
    const options =
      f.type === 'option'
        ? cmsChoices(f.opts).map((v) => [v, v])
        : (C.findCollection(f.ref || '')?.items || []).map((i) => [
            i.id,
            C.itemTitle(C.findCollection(f.ref!)!, i) +
              (i.draft ? ' (draft)' : ''),
          ]);
    return (
      <select
        {...props}
        class="ctl"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
      >
        <option value="">Choose</option>
        {value && !options.some(([v]) => v === value) && (
          <option value={value}>Unavailable: {value}</option>
        )}
        {options.map(([v, label]) => (
          <option value={v}>{label}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      {...props}
      class="ctl"
      type={
        f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'
      }
      step={f.type === 'number' ? 'any' : undefined}
      value={value}
      onInput={(e) => onChange(e.currentTarget.value)}
    />
  );
}
function RichValue({
  id,
  label,
  value,
  onChange,
  disabled,
  error,
}: {
  disabled: boolean;
  error?: string;
  id: string;
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editor.current && editor.current.innerHTML !== value) {
      if (cmsSafeRich(value)) editor.current.innerHTML = value;
      else editor.current.textContent = value;
    }
  }, []);
  const command = (cmd: string, arg?: string) => {
    if (disabled) return;
    editor.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(editor.current?.innerHTML || '');
  };
  return (
    <div class="cms-rich">
      <div class="cms-actions" role="toolbar" aria-label="Text formatting">
        {[
          ['bold', 'Bold'],
          ['italic', 'Italic'],
          ['insertUnorderedList', 'Bullet list'],
          ['insertOrderedList', 'Numbered list'],
          ['removeFormat', 'Clear formatting'],
        ].map(([cmd, title]) => (
          <button
            class="btn"
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => command(cmd)}
          >
            {title}
          </button>
        ))}
      </div>
      <div
        ref={editor}
        id={id}
        role="textbox"
        aria-labelledby={label}
        aria-multiline="true"
        aria-disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error}
        contentEditable={disabled ? 'false' : 'true'}
        onInput={() => {
          if (!disabled) onChange(editor.current?.innerHTML || '');
        }}
        onPaste={(e) => {
          e.preventDefault();
          command('insertText', e.clipboardData?.getData('text/plain') || '');
        }}
      />
    </div>
  );
}
function bindingImpact(collectionId: string, fieldId: string): string {
  const affected = new Set<string>();
  for (const page of C.state.pages) {
    if (
      page.collection === collectionId &&
      [page.bindTitle, page.bindDesc].includes(fieldId)
    )
      affected.add(page.name + ' (SEO)');
    C.eachNode(page.tree, (n) => {
      if (
        Object.values(n.bind || {}).some(
          (b) =>
            b.src === 'field' &&
            (b.path === fieldId || b.path.startsWith(fieldId + '.')),
        )
      )
        affected.add(page.name + ' / ' + C.nameOf(n));
    });
  }
  return affected.size
    ? 'Review these bindings: ' + [...affected].join(', ') + '.'
    : 'No page field bindings were found. Check shared components and references before publishing.';
}
