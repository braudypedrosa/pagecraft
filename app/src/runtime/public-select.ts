const FORM_SELECTOR = '.pagecraft-form[data-pagecraft-controls]';
// Iconify lucide:chevron-down, api.iconify.design, retrieved 2026-10-20.
const SELECT_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9 6 6 6-6"/></svg>';

function enhanceSelect(select: HTMLSelectElement) {
  if (select.dataset.pagecraftEnhanced) return;
  select.dataset.pagecraftEnhanced = 'true';
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  const root = document.createElement('div');
  root.className = 'pc-select';
  const button = document.createElement('button');
  button.className = 'pc-select-button';
  button.type = 'button';
  button.setAttribute('role', 'combobox');
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  button.id = `${select.id || 'pagecraft-select'}-button`;
  const value = document.createElement('span');
  value.className = 'pc-select-value';
  const icon = document.createElement('span');
  icon.className = 'pc-select-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = SELECT_ICON;
  button.append(value, icon);
  const list = document.createElement('ul');
  list.className = 'pc-select-list';
  list.id = `${select.id || 'pagecraft-select'}-listbox`;
  list.setAttribute('role', 'listbox');
  list.dataset.pagecraftSelectPopover = '';
  list.hidden = true;
  button.setAttribute('aria-controls', list.id);
  const label = Array.from(select.closest('.pagecraft-field')?.querySelectorAll<HTMLLabelElement>('label[for]') || [])
    .find(candidate => candidate.htmlFor === select.id);
  if (label) {
    label.id ||= `${select.id}-label`;
    button.setAttribute('aria-labelledby', `${label.id} ${button.id}`);
    list.setAttribute('aria-labelledby', label.id);
  }
  select.before(root);
  root.append(select, button);
  document.body.append(list);

  let active = -1;
  let search = '';
  let searchTimer = 0;
  let validationShown = false;

  const enabled = () => Array.from(select.options).map((option, index) => ({ option, index }))
    .filter(item => !item.option.disabled);
  const setActive = (index: number) => {
    const items = Array.from(list.children) as HTMLElement[];
    if (!items[index] || items[index].getAttribute('aria-disabled') === 'true') return;
    active = index;
    for (const [itemIndex, item] of items.entries()) item.toggleAttribute('data-active', itemIndex === active);
    button.setAttribute('aria-activedescendant', items[active].id);
    items[active].scrollIntoView({ block: 'nearest' });
  };
  const sync = () => {
    const selected = select.options[select.selectedIndex] || select.options[0];
    value.textContent = selected?.textContent || '';
    button.disabled = select.disabled;
    if (validationShown) button.setAttribute('aria-invalid', select.validity.valid ? 'false' : 'true');
    else button.removeAttribute('aria-invalid');
    Array.from(list.children).forEach((item, index) => {
      item.setAttribute('aria-selected', String(index === select.selectedIndex));
    });
  };
  const close = (restoreFocus = false) => {
    if (list.hidden) return;
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.removeAttribute('aria-activedescendant');
    if (restoreFocus) button.focus();
  };
  const position = () => {
    if (list.hidden) return;
    const styles = getComputedStyle(button);
    for (const property of ['--f-text', '--f-bg', '--f-border', '--f-radius', '--f-pad', '--f-btn-bg', '--f-btn-fg', '--f-label']) {
      const value = styles.getPropertyValue(property);
      if (value) list.style.setProperty(property, value);
    }
    list.style.font = styles.font;
    const rect = button.getBoundingClientRect();
    const edge = 12;
    const gap = 6;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.max(0, Math.min(rect.width, viewportWidth - edge * 2));
    const left = Math.max(edge, Math.min(rect.left, viewportWidth - edge - width));
    const below = Math.max(0, viewportHeight - edge - rect.bottom - gap);
    const above = Math.max(0, rect.top - edge - gap);
    const heightLimit = Math.min(256, viewportHeight / 2);
    const naturalHeight = Math.min(list.scrollHeight || heightLimit, heightLimit);
    const aboveButton = below < naturalHeight && above > below;
    const availableHeight = aboveButton ? above : below;
    const height = Math.min(naturalHeight, availableHeight);
    const top = aboveButton
      ? Math.max(edge, rect.top - gap - height)
      : Math.min(rect.bottom + gap, viewportHeight - edge - height);
    list.style.position = 'fixed';
    list.style.width = `${width}px`;
    list.style.left = `${left}px`;
    list.style.top = `${Math.max(edge, top)}px`;
    list.style.maxHeight = `${Math.min(heightLimit, availableHeight)}px`;
  };
  const open = (direction = 0) => {
    if (button.disabled) return;
    list.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    const choices = enabled();
    const selected = choices.find(item => item.index === select.selectedIndex);
    const next = direction > 0 ? choices[0] : direction < 0 ? choices[choices.length - 1] : selected || choices[0];
    if (next) setActive(next.index);
    position();
  };
  const choose = (index: number) => {
    const option = select.options[index];
    if (!option || option.disabled) return;
    const changed = select.selectedIndex !== index;
    select.selectedIndex = index;
    validationShown = true;
    sync();
    close(true);
    if (changed) {
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  const move = (amount: number) => {
    const choices = enabled();
    if (!choices.length) return;
    const at = Math.max(0, choices.findIndex(item => item.index === active));
    setActive(choices[(at + amount + choices.length) % choices.length].index);
  };

  Array.from(select.options).forEach((option, index) => {
    const item = document.createElement('li');
    item.className = 'pc-select-option';
    item.id = `${list.id}-option-${index}`;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-disabled', String(option.disabled));
    item.textContent = option.textContent;
    item.addEventListener('pointerdown', event => event.preventDefault());
    item.addEventListener('click', () => choose(index));
    list.append(item);
  });

  button.addEventListener('click', () => list.hidden ? open() : close());
  button.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!list.hidden) { event.preventDefault(); close(true); }
      return;
    }
    if (event.key === 'Tab') { close(); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (list.hidden) open(); else choose(active);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.hidden) open(event.key === 'ArrowDown' ? 1 : -1); else move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      if (list.hidden) open();
      const choices = enabled();
      const item = event.key === 'Home' ? choices[0] : choices[choices.length - 1];
      if (item) setActive(item.index);
      return;
    }
    if (event.key.length === 1 && /\S/.test(event.key)) {
      search += event.key.toLocaleLowerCase();
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => { search = ''; }, 600);
      const item = enabled().find(entry => (entry.option.textContent || '').trim().toLocaleLowerCase().startsWith(search));
      if (item) { event.preventDefault(); if (list.hidden) open(); setActive(item.index); }
    }
  });
  button.addEventListener('blur', () => { validationShown = true; sync(); });
  select.addEventListener('change', sync);
  select.addEventListener('focus', () => button.focus());
  select.addEventListener('invalid', event => {
    event.preventDefault();
    validationShown = true;
    button.setAttribute('aria-invalid', 'true');
    button.focus();
  });
  document.addEventListener('pointerdown', event => {
    const target = event.target as Node;
    if (!root.contains(target) && !list.contains(target)) close();
  });
  window.addEventListener('resize', position);
  document.addEventListener('scroll', position, true);
  select.form?.addEventListener('reset', () => window.setTimeout(() => {
    validationShown = false;
    sync();
  }));
  sync();
}

document.querySelectorAll<HTMLElement>(FORM_SELECTOR).forEach(form => {
  form.querySelectorAll<HTMLSelectElement>('select[data-pagecraft-select]').forEach(enhanceSelect);
});
