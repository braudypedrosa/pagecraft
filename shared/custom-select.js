/* Pagecraft's native-select enhancement.

   The real <select> remains in the form and continues to own its value. This layer supplies
   Pagecraft's visual menu, then sends ordinary input/change events back through the native
   control so legacy handlers, Preact handlers, form submission, and tests keep one contract. */
export const CUSTOM_SELECT_CSS = `
.pc-custom-select-native{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;white-space:nowrap!important;border:0!important;pointer-events:none!important}
.pc-custom-select-trigger{width:100%;min-height:37px;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;min-width:0;padding:8px 10px;border:1px solid var(--line-2,var(--pc-line,#d4cfc0));border-radius:var(--r-sm,7px);background:var(--panel,var(--pc-field,var(--field,#fff)));background-image:none!important;color:var(--text,var(--pc-text,inherit));font:inherit;font-weight:inherit;text-align:left;cursor:pointer;box-shadow:none;filter:none}
.pc-sort.pc-custom-select-trigger{height:44px;padding:0 14px}
.pc-custom-select-trigger:hover{border-color:var(--text-3,var(--pc-text-2,#6f7771));filter:none}
.pc-custom-select-trigger:focus-visible,.pc-custom-select-trigger[aria-expanded="true"]{border-color:var(--pc-text,var(--text,#111311));outline:2px solid var(--pc-green,var(--green,#b7f34a));outline-offset:1px}
.pc-custom-select-trigger>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-custom-select-trigger>svg{width:14px;height:14px;flex:0 0 14px;color:currentColor;opacity:.64;transition:transform .14s ease}
.pc-custom-select-trigger[aria-expanded="true"]>svg{transform:rotate(180deg)}
.pc-custom-select-trigger:disabled{cursor:not-allowed;opacity:.5}
.pc-custom-select-popover{--pc-cs-bg:#fff;--pc-cs-fg:#111311;--pc-cs-muted:#6f7771;--pc-cs-line:#d4cfc0;--pc-cs-hover:#f1eee3;position:fixed;z-index:10000;display:grid;gap:2px;max-height:min(360px,calc(100vh - 20px));padding:6px;overflow:auto;overscroll-behavior:contain;background:var(--pc-cs-bg);color:var(--pc-cs-fg);border:1px solid var(--pc-cs-line);border-radius:8px;box-shadow:0 18px 42px -18px rgba(17,19,17,.42)}
.pc-custom-select-popover[hidden]{display:none}
.pc-custom-select-group{padding:8px 9px 4px;color:var(--pc-cs-muted);font-family:"DM Sans",system-ui,sans-serif;font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase}
.pc-custom-select-option{width:100%!important;min-height:34px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;margin:0!important;padding:7px 9px!important;border:0!important;border-radius:4px!important;background:transparent!important;color:var(--pc-cs-fg)!important;box-shadow:none!important;font:inherit!important;font-weight:500!important;line-height:1.35!important;text-align:left!important;cursor:pointer!important;filter:none!important}
.pc-custom-select-option:hover,.pc-custom-select-option[data-active="true"]{background:var(--pc-cs-hover)!important}
.pc-custom-select-option[aria-selected="true"]{font-weight:650!important}
.pc-custom-select-option:disabled{cursor:not-allowed!important;opacity:.42!important}
.pc-custom-select-check{width:14px;height:14px;display:grid;place-items:center;flex:0 0 14px;color:var(--pc-cs-fg)}
.pc-custom-select-check svg{width:13px;height:13px}
@media(max-width:559px){.pc-custom-select-popover[data-mobile="true"]{left:12px!important;right:12px!important;top:auto!important;bottom:12px!important;width:auto!important;max-height:min(52vh,420px);padding:8px;border-radius:10px;box-shadow:0 24px 60px -18px rgba(17,19,17,.52)}.pc-custom-select-option{min-height:42px!important;padding:9px 10px!important}}
@media(prefers-reduced-motion:reduce){.pc-custom-select-trigger>svg{transition:none}}
`;

export function installCustomSelects(css = CUSTOM_SELECT_CSS) {
  if (typeof document === 'undefined' || window.__pagecraftCustomSelects) return;
  window.__pagecraftCustomSelects = true;

  if (!document.getElementById('pc-custom-select-styles')) {
    const style = document.createElement('style');
    style.id = 'pc-custom-select-styles';
    style.textContent = css;
    document.head.append(style);
  }

  const records = new Map();
  let openRecord = null;
  let typeahead = '';
  let typeaheadTimer = 0;
  let scheduled = false;
  let nextId = 0;

  const selectedOption = select => select.options[select.selectedIndex] || null;
  const labelOf = select => {
    const owner = select.labels?.[0];
    const concise = owner?.querySelector('.sr-only')?.textContent;
    let ownerText = '';
    if (owner && !concise) {
      const copy = owner.cloneNode(true);
      copy.querySelectorAll('select,.pc-custom-select-trigger').forEach(node => node.remove());
      ownerText = copy.textContent || '';
    }
    const group = select.closest('[aria-labelledby]');
    const groupText = group?.getAttribute('aria-labelledby')?.split(/\s+/)
      .map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
    const label = select.getAttribute('aria-label') || concise || ownerText || groupText || select.title;
    return String(label || 'Choose an option').trim();
  };
  const optionRows = select => {
    const rows = [];
    let group = null;
    for (const option of select.options) {
      const parent = option.parentElement;
      const nextGroup = parent?.tagName === 'OPTGROUP' ? parent.label : null;
      if (nextGroup && nextGroup !== group) rows.push({ group: nextGroup });
      group = nextGroup;
      rows.push({ option });
    }
    return rows;
  };
  const optionSignature = select => [...select.options].map(option => [
    option.value, option.label, option.selected, option.disabled,
    option.parentElement?.tagName === 'OPTGROUP' ? option.parentElement.label : ''
  ].join('\u0001')).join('\u0002');
  const enabledOptions = select => [...select.options].filter(option => !option.disabled && !option.parentElement?.disabled);

  const position = record => {
    if (record.menu.hidden) return;
    const rect = record.trigger.getBoundingClientRect();
    const mobile = window.innerWidth < 560;
    record.menu.dataset.mobile = String(mobile);
    record.menu.style.width = mobile ? '' : `${Math.max(180, rect.width)}px`;
    if (mobile) return;
    const width = Math.max(180, rect.width);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const roomBelow = window.innerHeight - rect.bottom - 8;
    const height = Math.min(record.menu.scrollHeight, 360);
    const top = roomBelow >= Math.min(height, 180)
      ? rect.bottom + 6
      : Math.max(8, rect.top - height - 6);
    record.menu.style.left = `${left}px`;
    record.menu.style.top = `${top}px`;
  };

  const close = (record, focus = false) => {
    if (!record || record.menu.hidden) return;
    record.menu.hidden = true;
    record.trigger.setAttribute('aria-expanded', 'false');
    if (openRecord === record) openRecord = null;
    if (focus) record.trigger.focus();
  };

  const choose = (record, option) => {
    if (!option || option.disabled || option.parentElement?.disabled) return;
    record.select.value = option.value;
    record.select.dispatchEvent(new Event('input', { bubbles: true }));
    record.select.dispatchEvent(new Event('change', { bubbles: true }));
    sync(record);
    close(record, true);
  };

  const setActive = (record, option) => {
    const buttons = [...record.menu.querySelectorAll('.pc-custom-select-option:not(:disabled)')];
    buttons.forEach(button => { button.dataset.active = String(button.dataset.value === option?.value); });
    const active = buttons.find(button => button.dataset.active === 'true');
    if (active) {
      active.focus({ preventScroll: true });
      active.scrollIntoView({ block: 'nearest' });
    }
  };

  const renderMenu = record => {
    record.signature = optionSignature(record.select);
    record.menu.replaceChildren();
    for (const row of optionRows(record.select)) {
      if (row.group) {
        const group = document.createElement('div');
        group.className = 'pc-custom-select-group';
        group.textContent = row.group;
        record.menu.append(group);
        continue;
      }
      const option = row.option;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pc-custom-select-option';
      button.dataset.value = option.value;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(option.selected));
      button.disabled = option.disabled || Boolean(option.parentElement?.disabled);
      const text = document.createElement('span');
      text.textContent = option.label;
      const check = document.createElement('span');
      check.className = 'pc-custom-select-check';
      check.innerHTML = option.selected
        ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.5 8.2 2.8 2.8 6.2-6.2"/></svg>'
        : '';
      button.append(text, check);
      button.addEventListener('click', () => choose(record, option));
      record.menu.append(button);
    }
  };

  const open = record => {
    if (record.select.disabled) return;
    if (openRecord && openRecord !== record) close(openRecord);
    renderMenu(record);
    const styles = getComputedStyle(record.trigger);
    record.menu.style.setProperty('--pc-cs-bg', styles.backgroundColor || '#fff');
    record.menu.style.setProperty('--pc-cs-fg', styles.color || '#111311');
    record.menu.style.setProperty('--pc-cs-line', styles.borderColor || '#d4cfc0');
    record.menu.style.setProperty('--pc-cs-muted', styles.color || '#6f7771');
    record.menu.style.setProperty('--pc-cs-hover', styles.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#f1eee3' : 'color-mix(in srgb, currentColor 7%, transparent)');
    record.menu.hidden = false;
    record.trigger.setAttribute('aria-expanded', 'true');
    openRecord = record;
    position(record);
    const option = selectedOption(record.select) || enabledOptions(record.select)[0];
    requestAnimationFrame(() => setActive(record, option));
  };

  function sync(record) {
    if (!record.select.isConnected) return;
    const option = selectedOption(record.select);
    record.label.textContent = option?.label || 'Choose an option';
    record.trigger.disabled = record.select.disabled;
    record.trigger.setAttribute('aria-label', labelOf(record.select));
    record.trigger.title = record.select.title;
    if (!record.menu.hidden && record.signature !== optionSignature(record.select)) renderMenu(record);
  }

  const enhance = select => {
    if (!(select instanceof HTMLSelectElement) || select.multiple || select.size > 1) return;
    const current = records.get(select);
    if (current?.trigger.isConnected) { sync(current); return; }
    if (current) records.delete(select);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = `${select.className} pc-custom-select-trigger`.trim();
    trigger.style.cssText = select.style.cssText;
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const label = document.createElement('span');
    const caret = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    caret.setAttribute('viewBox', '0 0 16 16');
    caret.setAttribute('fill', 'none');
    caret.setAttribute('stroke', 'currentColor');
    caret.setAttribute('stroke-width', '1.5');
    caret.setAttribute('stroke-linecap', 'round');
    caret.setAttribute('stroke-linejoin', 'round');
    caret.setAttribute('aria-hidden', 'true');
    caret.innerHTML = '<path d="m4.5 6.5 3.5 3.5 3.5-3.5"/>';
    trigger.append(label, caret);

    const menu = document.createElement('div');
    menu.id = `pc-custom-select-${++nextId}`;
    menu.className = 'pc-custom-select-popover';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    trigger.setAttribute('aria-controls', menu.id);
    document.body.append(menu);
    select.after(trigger);
    select.classList.add('pc-custom-select-native');
    select.hidden = true;
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;

    const record = { select, trigger, label, menu, signature: '' };
    records.set(select, record);
    sync(record);
    select.addEventListener('change', () => sync(record));
    select.addEventListener('input', () => sync(record));
    select.addEventListener('focus', () => trigger.focus());
    select.addEventListener('invalid', event => { event.preventDefault(); trigger.focus(); open(record); });
    trigger.addEventListener('click', () => menu.hidden ? open(record) : close(record, true));
    trigger.addEventListener('keydown', event => {
      const options = enabledOptions(select);
      const currentIndex = Math.max(0, options.indexOf(selectedOption(select)));
      if (event.key === 'Escape') { close(record, true); return; }
      if (event.key === 'Tab') { close(record); return; }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        menu.hidden ? open(record) : choose(record, selectedOption(select));
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
          : Math.max(0, Math.min(options.length - 1, currentIndex + (event.key === 'ArrowDown' ? 1 : -1)));
        const activate = () => setActive(record, options[index]);
        if (menu.hidden) { open(record); requestAnimationFrame(activate); } else activate();
        return;
      }
      if (event.key.length === 1 && /\S/.test(event.key)) {
        typeahead += event.key.toLowerCase();
        clearTimeout(typeaheadTimer);
        typeaheadTimer = window.setTimeout(() => { typeahead = ''; }, 650);
        const match = options.find(option => option.label.toLowerCase().startsWith(typeahead));
        if (match) {
          const activate = () => setActive(record, match);
          if (menu.hidden) { open(record); requestAnimationFrame(activate); } else activate();
        }
      }
    });
    menu.addEventListener('keydown', event => {
      const buttons = [...menu.querySelectorAll('.pc-custom-select-option:not(:disabled)')];
      const index = Math.max(0, buttons.indexOf(document.activeElement));
      if (event.key === 'Escape' || event.key === 'Tab') { close(record, event.key === 'Escape'); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    });
  };

  const scan = () => {
    scheduled = false;
    if (typeof document === 'undefined') return;
    document.querySelectorAll('select:not([multiple])').forEach(enhance);
    for (const [select, record] of records) {
      if (!select.isConnected) { close(record); record.trigger.remove(); record.menu.remove(); records.delete(select); }
      else if (!record.trigger.isConnected) { record.menu.remove(); records.delete(select); enhance(select); }
      else sync(record);
    }
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(scan);
  };

  document.addEventListener('pointerdown', event => {
    if (openRecord && !openRecord.trigger.contains(event.target) && !openRecord.menu.contains(event.target)) close(openRecord);
  }, true);
  document.addEventListener('submit', event => {
    const invalid = event.target.querySelector?.('select.pc-custom-select-native:invalid');
    if (invalid) records.get(invalid)?.trigger.focus();
  });
  window.addEventListener('resize', () => openRecord && position(openRecord));
  window.addEventListener('scroll', () => openRecord && position(openRecord), true);
  new MutationObserver(mutations => {
    const affectsSelect = mutations.some(mutation => {
      if (mutation.type === 'attributes') {
        return mutation.target.nodeType === 1
          && mutation.target.matches('select,option,optgroup');
      }
      return [...mutation.addedNodes, ...mutation.removedNodes].some(node =>
        node.nodeType === 1
          && (node.matches('select,option,optgroup') || node.querySelector('select,option,optgroup'))
      );
    });
    if (affectsSelect) schedule();
  }).observe(document.documentElement, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['disabled', 'title', 'aria-label']
  });
  scan();
}

export const CUSTOM_SELECT_BOOT_SCRIPT = `(${installCustomSelects.toString()})(${JSON.stringify(CUSTOM_SELECT_CSS)});`;
