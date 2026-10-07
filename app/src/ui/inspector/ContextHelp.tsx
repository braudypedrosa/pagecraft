/** Optional, point-of-use guidance. Native details/summary keeps keyboard behaviour and
 * preserves its open state while the inspector repaints the same selected element. */
export function ContextHelp({ kind, summary, children }: {
  kind: string;
  summary: string;
  children: any;
}) {
  return (
    <details class="pc-context-help" data-context-help={kind}>
      <summary>{summary}</summary>
      <div class="note pc-context-help__body">{children}</div>
    </details>
  );
}
