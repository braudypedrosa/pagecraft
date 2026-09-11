import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

type Span = { name: string; start: number; duration: number };
type Trace = { id: string; start: number; spans: Span[] };
export const requestTiming = new AsyncLocalStorage<Trace>();
export const newRequestTiming = (): Trace => ({ id: randomUUID(), start: performance.now(), spans: [] });

/** Only fixed operation names and durations enter diagnostics. No arguments, documents,
 * identity data, URLs, cookies or credentials are logged or sent to the browser. */
export async function timed<T>(name: string, work: () => Promise<T>): Promise<T> {
  const trace = requestTiming.getStore();
  const start = performance.now();
  try { return await work(); }
  finally { trace?.spans.push({ name: name.replace(/[^a-zA-Z0-9_.-]/g, ''), start: start - trace.start, duration: performance.now() - start }); }
}

export function timingHeader(trace: Trace): string {
  return [...trace.spans.slice(0, 24).map((span, i) =>
    `${span.name}_${i};dur=${span.duration.toFixed(1)};desc="start ${span.start.toFixed(1)}ms"`),
    `server;dur=${(performance.now() - trace.start).toFixed(1)}`].join(', ');
}
