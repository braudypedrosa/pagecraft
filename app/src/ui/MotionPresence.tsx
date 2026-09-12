import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { installUiMotion, type UiMotionKind } from '../../../shared/ui-motion.js';

/** Keeps conditional UI mounted long enough to complete its restrained exit. */
export function MotionPresence({ show, as = 'div', class: className, kind = 'panel', children }:
  { show: boolean; as?: string; class?: string; kind?: UiMotionKind; children: any }) {
  const [present, setPresent] = useState(show);
  const ref = useRef<HTMLElement>(null);
  const sequence = useRef(0);

  useLayoutEffect(() => { if (show && !present) setPresent(true); }, [show, present]);
  useLayoutEffect(() => {
    if (!present || !ref.current) return;
    const token = ++sequence.current, motion = installUiMotion();
    if (show) { motion?.enter(ref.current, { kind }); return; }
    if (!motion || motion.reduced()) { setPresent(false); return; }
    motion.exit(ref.current, { kind, hide: false }).then(() => {
      if (sequence.current === token) setPresent(false);
    });
  }, [show, present, kind]);

  if (!present) return null;
  const Tag = as as any;
  return <Tag ref={ref} class={className} aria-hidden={show ? undefined : 'true'}>{children}</Tag>;
}
