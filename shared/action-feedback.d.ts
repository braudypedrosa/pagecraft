export type FeedbackTone = 'info' | 'success' | 'error' | 'progress';
export interface Notice {
  dismiss(): void;
  update(message: string, tone?: FeedbackTone): Notice;
  success(message: string): Notice;
  error(message: string): Notice;
}
export interface ActionFeedback {
  destroy(): void;
  flash(message: string, path?: string): void;
  notify(message: string, options?: {tone?: FeedbackTone; id?: string; duration?: number}): Notice;
  begin(button: HTMLElement | null, message: string): {update: Notice['update'];success(message: string): void;error(message: string): void;cancel(): void} | null;
}
export const ACTION_FEEDBACK_CSS: string;
export const ACTION_FEEDBACK_BOOT_SCRIPT: string;
export function installActionFeedback(css?: string): ActionFeedback;
declare global { interface Window { __pcFeedback?: ActionFeedback; } }
