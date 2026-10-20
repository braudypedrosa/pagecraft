import * as datePicker from '@zag-js/date-picker';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';

const FORM_SELECTOR = '.pagecraft-form[data-pagecraft-controls]';
// Iconify lucide:calendar-days/chevron-left/chevron-right, api.iconify.design, retrieved 2026-10-20.
const CALENDAR_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 2v3m8-3v3"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/></g></svg>';
const PREV_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 18-6-6 6-6"/></svg>';
const NEXT_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 18 6-6-6-6"/></svg>';

function isoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  try {
    const parsed = datePicker.parse(value);
    return parsed.toString() === value ? parsed : undefined;
  } catch { return undefined; }
}

function enhanceDate(input: HTMLInputElement, ordinal: number) {
  if (input.dataset.pagecraftEnhanced) return;
  input.dataset.pagecraftEnhanced = 'true';
  const original = input.value;
  const resetValue = input.defaultValue;
  const initial = isoDate(original);
  const min = isoDate(input.getAttribute('min') || '');
  const max = isoDate(input.getAttribute('max') || '');
  const unavailable = new Set((input.dataset.pagecraftUnavailableDates || input.dataset.unavailableDates || '')
    .split(',').map(value => value.trim()).filter(value => isoDate(value)));
  const id = `pagecraft-date-${input.id || ordinal}`;
  const originalId = input.id || `${id}-input`;
  const name = input.name;
  const placeholder = input.getAttribute('placeholder') || 'YYYY-MM-DD';
  input.type = 'text';
  input.id = originalId;
  input.pattern = '\\d{4}-\\d{2}-\\d{2}';
  input.inputMode = 'text';
  input.classList.add('pc-date-input');

  const root = document.createElement('div');
  root.className = 'pc-date';
  const control = document.createElement('div');
  control.className = 'pc-date-control';
  const trigger = document.createElement('button');
  trigger.className = 'pc-date-trigger';
  trigger.innerHTML = CALENDAR_ICON;
  const positioner = document.createElement('div');
  positioner.className = 'pc-date-positioner';
  positioner.dataset.pagecraftDatePopover = '';
  const content = document.createElement('div');
  content.className = 'pc-date-content';
  input.before(root);
  root.append(control);
  document.body.append(positioner);
  control.append(input, trigger);
  positioner.append(content);

  let api: ReturnType<typeof datePicker.connect>;
  let propCleanups: Array<() => void> = [];
  let lastMachineValue = original;
  let invalidDraft = '';
  let validationShown = false;
  const validate = () => {
    const value = input.value.trim();
    let message = '';
    const parsed = value ? isoDate(value) : undefined;
    if (value && !parsed) message = 'Enter a date in YYYY-MM-DD format.';
    else if (parsed && min && parsed.compare(min) < 0) message = `Choose ${min.toString()} or later.`;
    else if (parsed && max && parsed.compare(max) > 0) message = `Choose ${max.toString()} or earlier.`;
    else if (parsed && unavailable.has(parsed.toString())) message = 'That date is unavailable.';
    input.setCustomValidity(message);
    if (validationShown) input.setAttribute('aria-invalid', String(!input.validity.valid));
    else input.removeAttribute('aria-invalid');
    return !message;
  };
  const machine = new VanillaMachine(datePicker.machine, {
    id,
    ids: {
      root: `${id}-root`, control: `${id}-control`, input: () => originalId,
      trigger: `${id}-trigger`, positioner: `${id}-positioner`, content: `${id}-content`,
    },
    name,
    locale: document.documentElement.lang || 'en-US',
    required: input.required,
    disabled: input.disabled,
    min,
    max,
    defaultValue: initial ? [initial] : [],
    defaultFocusedValue: initial,
    openOnClick: true,
    placeholder,
    format: date => date.toString(),
    parse: value => isoDate(value),
    isDateUnavailable: date => unavailable.has(date.toString()),
    positioning: { placement: 'bottom-start', gutter: 6, fitViewport: true },
    onValueChange(details) {
      const next = details.valueAsString[0] || '';
      const changed = next !== lastMachineValue;
      lastMachineValue = next;
      if (changed) invalidDraft = '';
      input.value = next;
      validate();
      if (changed) queueMicrotask(() => {
        // Notify the form without feeding the synthetic event back through Zag's text parser.
        // The next render immediately restores the machine's DOM listeners.
        propCleanups.forEach(cleanup => cleanup());
        propCleanups = [];
        input.value = next;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        render();
      });
    },
  });

  const bind = (node: Element, props: Record<string, unknown>) => propCleanups.push(spreadProps(node, props, id));
  const syncTheme = () => {
    const styles = getComputedStyle(input);
    for (const property of ['--f-text', '--f-bg', '--f-border', '--f-radius', '--f-pad', '--f-btn-bg', '--f-btn-fg', '--f-label']) {
      const value = styles.getPropertyValue(property);
      if (value) positioner.style.setProperty(property, value);
    }
    positioner.style.font = styles.font;
  };
  const element = (tag: string, className?: string, text?: string) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const render = () => {
    const textValue = input.value;
    const activePart = content.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).dataset.part
      : undefined;
    propCleanups.forEach(cleanup => cleanup());
    propCleanups = [];
    api = datePicker.connect(machine.service, normalizeProps);
    bind(root, api.getRootProps());
    bind(control, api.getControlProps());
    const inputProps = api.getInputProps({ fixOnBlur: false }) as Record<string, unknown>;
    // Zag filters input using the locale separator ("/" in en-US), while the
    // public form contract is ISO YYYY-MM-DD. Keep Zag's focus/click/ARIA
    // behavior, but let this adapter own text parsing and validation.
    delete inputProps.onbeforeinput;
    delete inputProps.oninput;
    delete inputProps.onkeydown;
    delete inputProps.value;
    bind(input, inputProps);
    input.value = textValue;
    input.classList.add('pc-date-input');
    input.defaultValue = resetValue;
    bind(trigger, api.getTriggerProps());
    trigger.classList.add('pc-date-trigger');
    bind(positioner, api.getPositionerProps());
    positioner.classList.add('pc-date-positioner');
    positioner.dataset.pagecraftDatePopover = '';
    syncTheme();
    bind(content, api.getContentProps());
    content.classList.add('pc-date-content');

    const head = element('div', 'pc-date-head');
    const prev = element('button', 'pc-date-nav');
    prev.innerHTML = PREV_ICON;
    const title = element('div', 'pc-date-month', api.visibleRangeText.start);
    const next = element('button', 'pc-date-nav');
    next.innerHTML = NEXT_ICON;
    bind(head, api.getViewControlProps({ view: 'day' }));
    bind(prev, api.getPrevTriggerProps({ view: 'day' }));
    bind(next, api.getNextTriggerProps({ view: 'day' }));
    head.append(prev, title, next);

    const table = element('table', 'pc-date-table') as HTMLTableElement;
    const thead = element('thead') as HTMLTableSectionElement;
    const headerRow = element('tr') as HTMLTableRowElement;
    bind(table, api.getTableProps({ view: 'day' }));
    bind(thead, api.getTableHeadProps({ view: 'day' }));
    bind(headerRow, api.getTableRowProps({ view: 'day' }));
    api.weekDays.forEach(day => {
      const cell = element('th', undefined, day.narrow);
      cell.setAttribute('scope', 'col');
      cell.setAttribute('aria-label', day.long);
      headerRow.append(cell);
    });
    thead.append(headerRow);
    const tbody = element('tbody') as HTMLTableSectionElement;
    bind(tbody, api.getTableBodyProps({ view: 'day' }));
    api.weeks.forEach((week, rowIndex) => {
      const row = element('tr') as HTMLTableRowElement;
      bind(row, api.getTableRowProps({ view: 'day' }));
      week.forEach(value => {
        const cell = element('td');
        const day = element('button', 'pc-date-day', String(value.day)) as HTMLButtonElement;
        bind(cell, api.getDayTableCellProps({ value, visibleRange: api.visibleRange }));
        bind(day, api.getDayTableCellTriggerProps({ value, visibleRange: api.visibleRange }));
        day.classList.add('pc-date-day');
        day.type = 'button';
        cell.append(day);
        row.append(cell);
      });
      row.dataset.row = String(rowIndex);
      tbody.append(row);
    });
    table.append(thead, tbody);
    content.replaceChildren(head, table);
    if (activePart === 'prev-trigger' || activePart === 'next-trigger') {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const active = document.activeElement;
        const replacement = content.querySelector<HTMLElement>(`[data-part="${activePart}"]`);
        if (replacement && (!active || !active.isConnected || active === document.body)) replacement.focus();
      }));
    }
  };

  machine.subscribe(render);
  machine.start();
  render();
  input.addEventListener('input', () => {
    invalidDraft = validate() ? '' : input.value;
  });
  input.addEventListener('blur', () => {
    validationShown = true;
    const valid = validate();
    if (!valid) invalidDraft = input.value;
    else {
      invalidDraft = '';
      const parsed = isoDate(input.value.trim());
      if (parsed && parsed.toString() !== lastMachineValue) api.setValue([parsed]);
      else if (!input.value.trim() && lastMachineValue) api.clearValue();
    }
    window.setTimeout(() => {
      if (!invalidDraft) return;
      input.value = invalidDraft;
      validate();
    });
  });
  input.addEventListener('invalid', () => {
    validationShown = true;
    if (invalidDraft) input.value = invalidDraft;
    validate();
  });
  input.form?.addEventListener('reset', () => window.setTimeout(() => {
    input.value = resetValue;
    const parsed = isoDate(resetValue);
    lastMachineValue = resetValue;
    invalidDraft = '';
    validationShown = false;
    api.setValue(parsed ? [parsed] : []);
    validate();
  }));
  validate();
}

document.querySelectorAll<HTMLElement>(FORM_SELECTOR).forEach(form => {
  form.querySelectorAll<HTMLInputElement>('input[type="date"][data-pagecraft-date]').forEach(enhanceDate);
});
