import type { UnknownDocumentInput } from '../../../app/src/core/types.ts';
import type { CompileOptions, CompilerResult } from './compiler.ts';

export interface CompilerControl {
  /** Includes queue time. A timeout terminates the shared worker and rejects every queued request. */
  timeoutMs?: number;
}

type Pending = {
  resolve(value: CompilerResult): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
};
const DEFAULT_TIMEOUT_MS = 60_000;
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function compilerError(message: string, code: string) {
  const error = new Error(message);
  error.name = 'PagecraftCompilerError';
  Object.assign(error, { code });
  return error;
}

function rejectPending(message: string, code: string) {
  for (const request of pending.values()) {
    clearTimeout(request.timeout);
    request.reject(compilerError(message, code));
  }
  pending.clear();
}

function compilerWorker() {
  if (worker) return worker;
  const created = new Worker(new URL('./compiler-worker.js', import.meta.url));
  worker = created;
  created.addEventListener('message', event => {
    const response = event.data;
    const request = pending.get(response?.id);
    if (!request) return;
    pending.delete(response.id);
    clearTimeout(request.timeout);
    if (response.ok) request.resolve(response.result);
    else {
      const error = new Error(response.error?.message || 'Pagecraft could not compile this document.');
      error.name = response.error?.name || 'PagecraftCompilerError';
      Object.assign(error, { code: response.error?.code || 'compile_failed' });
      request.reject(error);
    }
  });
  const failed = () => {
    created.terminate();
    if (worker !== created) return;
    worker = null;
    rejectPending('The sealed Pagecraft compiler stopped unexpectedly. Reload and retry.', 'worker_failed');
  };
  created.addEventListener('error', failed);
  created.addEventListener('messageerror', failed);
  return created;
}

/** Compile in a dedicated realm so an open editor document can never be replaced. */
export function compile(
  document: UnknownDocumentInput,
  options: CompileOptions,
  control: CompilerControl = {}
): Promise<CompilerResult> {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const requested = Number(control.timeoutMs);
    const timeoutMs = Number.isFinite(requested) && requested > 0
      ? Math.min(requested, 300_000)
      : DEFAULT_TIMEOUT_MS;
    const timeout = setTimeout(() => {
      if (!pending.has(id)) return;
      const active = worker;
      worker = null;
      active?.terminate();
      rejectPending(
        'The sealed Pagecraft compiler timed out. Retry this item; no generated output was saved.',
        'compiler_timeout'
      );
    }, timeoutMs);
    pending.set(id, { resolve, reject, timeout });
    try {
      compilerWorker().postMessage({ id, document, options });
    } catch (error) {
      const request = pending.get(id);
      if (request) clearTimeout(request.timeout);
      pending.delete(id);
      reject(compilerError(
        error instanceof Error ? error.message : String(error),
        'worker_unavailable'
      ));
    }
  });
}

export function dispose() {
  worker?.terminate();
  worker = null;
  rejectPending('The Pagecraft compiler was closed before this document finished.', 'compiler_disposed');
}

export type {
  CompileOptions, CompilerAsset, CompilerMenu, CompilerMenuItem, CompilerResult
} from './compiler.ts';
