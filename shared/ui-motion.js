/** Restrained motion shared by Pagecraft's editor chrome and Cloud UI.
 * Published pages do not load this module; their motion remains document-owned.
 */
export const UI_MOTION_CSS = `:root{
  interpolate-size:allow-keywords;
  --pc-motion-quick:120ms;
  --pc-motion-enter:180ms;
  --pc-motion-dialog:200ms;
  --pc-motion-exit:120ms;
  --pc-ease-enter:cubic-bezier(.2,.8,.2,1);
  --pc-ease-exit:cubic-bezier(.4,0,1,1);
}
[data-pc-motion-closing]{pointer-events:none!important}
:where(.dashboard-app,#app) :is(button,.btn,.pc-btn,a.pc-btn,.pc-menu-item,summary){transition:background-color var(--pc-motion-quick) var(--pc-ease-enter),border-color var(--pc-motion-quick) var(--pc-ease-enter),color var(--pc-motion-quick) var(--pc-ease-enter),opacity var(--pc-motion-quick) var(--pc-ease-enter),box-shadow var(--pc-motion-quick) var(--pc-ease-enter)}
:where(.dashboard-app,#app) :is(.pagerow,.cms-entry-row,.pc-sub-table>tbody>tr,.pc-site-card){transition:background-color var(--pc-motion-quick) var(--pc-ease-enter),border-color var(--pc-motion-quick) var(--pc-ease-enter),box-shadow var(--pc-motion-quick) var(--pc-ease-enter)}
dialog.pc-dialog[open]::backdrop{animation:pc-scrim-in var(--pc-motion-dialog) var(--pc-ease-enter) both}
dialog.pc-dialog[data-pc-motion-closing]::backdrop{animation:pc-scrim-out var(--pc-motion-exit) var(--pc-ease-exit) both}
@keyframes pc-scrim-in{from{opacity:0}to{opacity:1}}
@keyframes pc-scrim-out{from{opacity:1}to{opacity:0}}
@media(prefers-reduced-motion:reduce){
  :where(.dashboard-app,#app) :is(button,.btn,.pc-btn,a.pc-btn,.pc-menu-item,summary,.pagerow,.cms-entry-row,.pc-sub-table>tbody>tr,.pc-site-card){transition:none!important}
  dialog.pc-dialog[open]::backdrop,dialog.pc-dialog[data-pc-motion-closing]::backdrop{animation:none!important}
}`;

export function installUiMotion(css = UI_MOTION_CSS) {
  if (typeof document === 'undefined') return null;
  if (window.__pcMotion) return window.__pcMotion;

  if (!document.getElementById('pc-ui-motion-styles')) {
    const style = document.createElement('style');
    style.id = 'pc-ui-motion-styles'; style.textContent = css; document.head.append(style);
  }

  const jobs = new WeakMap();
  const returnFocus = new WeakMap();
  let generation = 0;
  const nativeShow = window.HTMLDialogElement?.prototype.showModal;
  const nativeClose = window.HTMLDialogElement?.prototype.close;
  const reduced = () => !window.Element?.prototype.animate
    || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const timing = kind => kind === 'dialog' ? 200 : kind === 'quick' ? 120 : 180;
  const easing = entering => entering ? 'cubic-bezier(.2,.8,.2,1)' : 'cubic-bezier(.4,0,1,1)';
  const frame = (kind, entering) => {
    const movement = kind === 'notification' ? 8 : kind === 'dialog' ? 8 : kind === 'panel' ? 4 : kind === 'popover' ? 5 : 0;
    const start = kind === 'dialog'
      ? { opacity: 0, transform: `translateY(${movement}px) scale(.985)` }
      : movement ? { opacity: 0, transform: `translateY(${movement}px) scale(${kind === 'popover' ? '.985' : '1'})` }
        : { opacity: 0 };
    const end = { opacity: 1, transform: 'translateY(0) scale(1)' };
    return entering ? [start, end] : [end, start];
  };
  const cancelAnimation = element => {
    const job = jobs.get(element);
    if (job) { job.cancel(); jobs.delete(element); }
  };
  const stop = element => {
    cancelAnimation(element);
    element.removeAttribute('data-pc-motion-entering');
    element.removeAttribute('data-pc-motion-closing');
    element.removeAttribute('aria-hidden');
  };
  const play = (element, kind, entering) => {
    cancelAnimation(element);
    const token = ++generation;
    if (reduced()) return Promise.resolve(token);
    const animation = element.animate(frame(kind, entering), {
      duration: entering ? timing(kind) : 120,
      easing: easing(entering),
      fill: 'both'
    });
    jobs.set(element, animation);
    return animation.finished.catch(() => null).then(() => {
      if (jobs.get(element) === animation) { animation.cancel(); jobs.delete(element); }
      return token;
    });
  };
  const enter = (element, options = {}) => {
    if (!element) return Promise.resolve(false);
    stop(element);
    if ('hidden' in element) element.hidden = false;
    element.removeAttribute('aria-hidden');
    element.setAttribute('data-pc-motion-entering', '');
    return play(element, options.kind || 'fade', true).then(() => {
      element.removeAttribute('data-pc-motion-entering');
      return true;
    });
  };
  const exit = (element, options = {}) => {
    if (!element) return Promise.resolve(false);
    if (element.hasAttribute('data-pc-motion-closing')) return jobs.get(element)?.finished || Promise.resolve(false);
    cancelAnimation(element);
    element.setAttribute('data-pc-motion-closing', '');
    element.setAttribute('aria-hidden', 'true');
    return play(element, options.kind || 'fade', false).then(() => {
      if (!element.hasAttribute('data-pc-motion-closing')) return false;
      element.removeAttribute('data-pc-motion-closing');
      if (options.remove) element.remove();
      else if (options.hide !== false && 'hidden' in element) element.hidden = true;
      options.onFinish?.();
      return true;
    });
  };
  const showDialog = (dialog, opener = document.activeElement) => {
    if (!dialog?.matches?.('dialog.pc-dialog')) return nativeShow?.call(dialog);
    returnFocus.set(dialog, opener instanceof HTMLElement ? opener : null);
    stop(dialog);
    if (!dialog.open) nativeShow.call(dialog);
    enter(dialog, { kind: 'dialog' });
  };
  const closeDialog = (dialog, returnValue = '') => {
    if (!dialog?.matches?.('dialog.pc-dialog')) return nativeClose?.call(dialog, returnValue);
    if (!dialog.open || dialog.hasAttribute('data-pc-motion-closing')) return;
    if (reduced()) {
      nativeClose.call(dialog, returnValue);
      const target = returnFocus.get(dialog); returnFocus.delete(dialog);
      if (target?.isConnected) target.focus({ preventScroll: true });
      return;
    }
    exit(dialog, { kind: 'dialog', hide: false }).then(closed => {
      if (!closed || !dialog.open) return;
      nativeClose.call(dialog, returnValue);
      const target = returnFocus.get(dialog); returnFocus.delete(dialog);
      if (target?.isConnected) target.focus({ preventScroll: true });
    });
  };
  const onDialogCancel = event => {
    const dialog = event.target;
    if (!dialog?.matches?.('dialog.pc-dialog')) return;
    event.preventDefault(); closeDialog(dialog);
  };
  const closeAccountMenu = (details, focus = false) => {
    if (!details?.open || details.hasAttribute('data-pc-menu-closing')) return;
    const panel = details.querySelector(':scope > .pc-account-menu');
    const summary = details.querySelector(':scope > summary');
    details.setAttribute('data-pc-menu-closing', '');
    const done = () => {
      details.open = false; details.removeAttribute('data-pc-menu-closing');
      if (focus && summary?.isConnected) summary.focus({ preventScroll: true });
    };
    if (panel && !reduced()) exit(panel, { kind: 'popover', hide: false }).then(done); else done();
  };
  const onAccountClick = event => {
    const summary = event.target?.closest?.('.pc-account > summary');
    if (!summary) return;
    const details = summary.parentElement;
    if (details.hasAttribute('data-pc-menu-closing')) {
      event.preventDefault(); details.removeAttribute('data-pc-menu-closing');
      const panel = details.querySelector(':scope > .pc-account-menu');
      if (panel) enter(panel, { kind: 'popover' });
      return;
    }
    if (details.open) { event.preventDefault(); closeAccountMenu(details, true); return; }
    requestAnimationFrame(() => {
      const panel = details.querySelector(':scope > .pc-account-menu');
      if (details.open && panel) enter(panel, { kind: 'popover' });
    });
  };
  const onAccountAway = event => {
    document.querySelectorAll('.pc-account[open]').forEach(details => {
      if (!details.contains(event.target)) closeAccountMenu(details);
    });
  };
  const onAccountKey = event => {
    if (event.key !== 'Escape') return;
    const details = event.target?.closest?.('.pc-account[open]');
    if (details) { event.preventDefault(); event.stopPropagation(); closeAccountMenu(details, true); }
  };
  const destroy = () => {
    document.removeEventListener('cancel', onDialogCancel, true);
    document.removeEventListener('click', onAccountClick, true);
    document.removeEventListener('pointerdown', onAccountAway, true);
    document.removeEventListener('keydown', onAccountKey, true);
    if (nativeShow && nativeClose) {
      window.HTMLDialogElement.prototype.showModal = nativeShow;
      window.HTMLDialogElement.prototype.close = nativeClose;
    }
    document.getElementById('pc-ui-motion-styles')?.remove();
    delete window.__pcMotion;
  };
  const api = { enter, exit, cancel: stop, showDialog, closeDialog, reduced, destroy };
  window.__pcMotion = api;

  if (nativeShow && nativeClose) {
    window.HTMLDialogElement.prototype.showModal = function () {
      return this.matches('dialog.pc-dialog') ? showDialog(this) : nativeShow.call(this);
    };
    window.HTMLDialogElement.prototype.close = function (value = '') {
      return this.matches('dialog.pc-dialog') ? closeDialog(this, value) : nativeClose.call(this, value);
    };
    document.addEventListener('cancel', onDialogCancel, true);
    document.addEventListener('click', onAccountClick, true);
    document.addEventListener('pointerdown', onAccountAway, true);
    document.addEventListener('keydown', onAccountKey, true);
  }
  return api;
}

export const UI_MOTION_BOOT_SCRIPT = `(${installUiMotion.toString()})(${JSON.stringify(UI_MOTION_CSS)});`;
