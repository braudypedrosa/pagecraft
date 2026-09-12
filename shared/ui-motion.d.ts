export type UiMotionKind = 'fade' | 'quick' | 'popover' | 'notification' | 'panel' | 'dialog';
export interface UiMotionOptions { kind?: UiMotionKind; remove?: boolean; hide?: boolean; onFinish?: () => void }
export interface UiMotion {
  enter(element: HTMLElement, options?: UiMotionOptions): Promise<boolean>;
  exit(element: HTMLElement, options?: UiMotionOptions): Promise<boolean>;
  cancel(element: HTMLElement): void;
  showDialog(dialog: HTMLDialogElement, opener?: Element | null): void;
  closeDialog(dialog: HTMLDialogElement, returnValue?: string): void;
  reduced(): boolean;
  destroy(): void;
}
export const UI_MOTION_CSS: string;
export const UI_MOTION_BOOT_SCRIPT: string;
export function installUiMotion(css?: string): UiMotion | null;

declare global { interface Window { __pcMotion?: UiMotion } }
