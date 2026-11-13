import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { Icon } from './Icon';

let nextId = 0;

/** Shared panel accordion. Uncontrolled categories and controlled inspector groups
 * use the same header, focus semantics and mounted body. */
export function Disclosure({ title, count, open, onToggle, class: className = '', children }: {
  title: string;
  count?: number;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  class?: string;
  children: ComponentChildren;
}) {
  const id = useRef('');
  if (!id.current) id.current = `pc-disclosure-${++nextId}`;
  const [localOpen, setLocalOpen] = useState(false);
  const expanded = open ?? localOpen;
  return (
    <div class={`group pc-disclosure${expanded ? '' : ' closed'}${className ? ' ' + className : ''}`}>
      <button type="button" class="gh" aria-expanded={expanded ? 'true' : 'false'} aria-controls={id.current}
        onClick={() => { setLocalOpen(!expanded); onToggle?.(!expanded); }}>
        <Icon name="caret" size={10} />
        <span class="pc-disclosure-title">{title}</span>
        {count !== undefined ? <span class="pc-disclosure-count">{count}</span> : null}
      </button>
      <div class="gb" id={id.current} aria-hidden={expanded ? undefined : 'true'} inert={!expanded}>
        {children}
      </div>
    </div>
  );
}
