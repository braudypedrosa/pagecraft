/* A font picker, grouped the way the core groups fonts.

   Used by the project dialog for the body and heading defaults, and by the text-style
   editor for a per-style override. One component for all three, where builder.html had
   one markup function and three separate places wiring up its output by id. */
import { C } from './ctx';

export function FontSelect({ value, onChange, ariaLabel = 'Font' }: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  const cur = String(value || '');
  const groups = C.fontGroups();
  /* a stack that came from somewhere else — an import, or hand-typed — still has to be
     selectable, so it is offered as its own option rather than silently reset */
  const known = groups.some(([, list]) => list.some(([v]) => v === cur));

  return (
    <select class="ctl" value={cur} aria-label={ariaLabel}
      onChange={e => onChange((e.target as HTMLSelectElement).value)}>
      {groups.map(([g, list]) => (
        <optgroup key={g} label={g}>
          {list.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </optgroup>
      ))}
      {known ? null : <option value={cur}>Custom — {C.familyOf(cur)}</option>}
    </select>
  );
}
