import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

let nextHelpId = 0;

/** Optional guidance stays beside its control, outside the panel's normal layout. */
export function HelpTip({ label, text, id }: { label: string; text: string; id?: string }) {
  const ownId = useRef('');
  if (!ownId.current) ownId.current = `pc-help-${++nextHelpId}`;
  const helpId = id || ownId.current;
  const button = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const cancelClose = () => clearTimeout(timer.current);
  const close = () => { cancelClose(); setAt(null); };
  const show = () => {
    cancelClose();
    const rect = button.current!.getBoundingClientRect();
    setAt({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 268)), top: rect.bottom + 6 });
  };
  const leave = () => {
    cancelClose();
    timer.current = setTimeout(() => {
      if (document.activeElement !== button.current) setAt(null);
    }, 150);
  };
  useLayoutEffect(() => {
    const surface = tip.current!;
    if (!at) return;
    surface.style.left = `${at.left}px`;
    surface.style.top = `${at.top}px`;
    const rect = surface.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 8) {
      surface.style.top = `${Math.max(8, button.current!.getBoundingClientRect().top - rect.height - 6)}px`;
    }
  }, [at, text, helpId]);
  useEffect(() => {
    if (!at) return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); close();
    };
    const outside = (event: PointerEvent) => {
      if (!button.current?.contains(event.target as Node) && !tip.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [!!at]);
  useEffect(() => () => cancelClose(), []);
  return <>
    <button ref={button} type="button" class="pc-help-trigger" aria-label={`${label} help`} aria-describedby={helpId}
      onMouseEnter={show} onMouseLeave={leave} onFocus={show} onBlur={close}
      onClick={event => { event.preventDefault(); event.stopPropagation(); show(); }}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M6.3 6a1.8 1.8 0 0 1 3.5.5c0 1.3-1.8 1.3-1.8 2.7M8 11v.5" /></svg>
    </button>
    <span ref={tip} id={helpId} role="tooltip" class="pc-help-tip" hidden={!at}
      onMouseEnter={cancelClose} onMouseLeave={leave}>{text}</span>
  </>;
}
