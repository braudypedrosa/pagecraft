export type FeedbackTone = 'info' | 'success' | 'error' | 'progress';
export interface Notice {
  dismiss(): void;
  update(message: string, tone?: FeedbackTone): Notice;
  success(message: string): Notice;
  error(message: string): Notice;
}
export interface ActionFeedback {
  run<T>(options: ProcessingOptions<T>, work: (action: {update: Notice['update']}) => T | false | Promise<T | false>): Promise<ProcessingResult<T>>;
  destroy(): void;
  flash(message: string, path?: string): void;
  notify(message: string, options?: {tone?: FeedbackTone; id?: string; duration?: number}): Notice;
  begin(button: HTMLElement | null, message: string): {update: Notice['update'];success(message: string): void;error(message: string): void;cancel(): void} | null;
}
export interface ProcessingOptions<T> {
  key?: string;
  button?: HTMLElement | null;
  pending: string;
  success: string | ((value: T) => string);
  error?: string | ((error: unknown) => string);
  /** Let progress paint before synchronous build work. Omit for clipboard/user activation. */
  paint?: boolean;
}
export type ProcessingResult<T> = {status:'success';value:T} | {status:'error';error:unknown;message:string} | {status:'cancelled'|'busy'};
export const ACTION_FEEDBACK_CSS: string;
export const ACTION_FEEDBACK_BOOT_SCRIPT: string;
export function installActionFeedback(css?: string): ActionFeedback;
declare global { interface Window { __pcFeedback?: ActionFeedback; } }
