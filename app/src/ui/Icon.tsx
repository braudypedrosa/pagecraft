/* One glyph, from the core's icon set.
   The markup in `IC` is our own constant data rather than anything a user typed, so
   injecting it is safe and keeps a single definition of every icon. */
import { C } from './ctx';

export function Icon({ name, size = 14, cls }: { name: string; size?: number; cls?: string }) {
  return (
    <svg class={cls || ''} width={size} height={size} viewBox={C.IC_VIEW}
      fill="none" stroke="currentColor" stroke-width={C.icStroke(size)} stroke-linecap="round" stroke-linejoin="round"
      dangerouslySetInnerHTML={{ __html: C.IC[name] || '' }} />
  );
}
