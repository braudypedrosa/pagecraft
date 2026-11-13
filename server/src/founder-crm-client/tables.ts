import {
  columnFilteringFeature,
  columnVisibilityFeature,
  constructTable,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  type ColumnDef,
} from '@tanstack/table-core';
import { storeReactivityBindings } from '@tanstack/table-core/store-reactivity-bindings';

type ColumnKind = 'text' | 'number' | 'date' | 'money';

interface CellRecord {
  element: HTMLTableCellElement;
  text: string;
  sortValue: string | number | bigint | undefined;
  currency: string;
}

interface ColumnRecord {
  id: string;
  label: string;
  kind: ColumnKind;
  header: HTMLTableCellElement;
  index: number;
  exportable: boolean;
  sortable: boolean;
}

interface DomRow {
  element: HTMLTableRowElement;
  cells: CellRecord[];
  search: string;
  plan: string;
  stage: string;
  due: boolean;
  unpublished: boolean;
}

const features = tableFeatures({
  coreReactivityFeature: storeReactivityBindings(),
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
});

const mountedTables = new WeakMap<HTMLTableElement, () => void>();
const integer = (value: string) => /^[+-]?(0|[1-9]\d*)$/.test(value);
const compact = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizedId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const safeKind = (value: string | undefined): ColumnKind =>
  value === 'number' || value === 'date' || value === 'money' ? value : 'text';

const cellText = (cell: HTMLTableCellElement) => compact(
  Array.from(cell.childNodes, node => node.textContent || '').join(' '),
);

const cellRecord = (cell: HTMLTableCellElement, column: ColumnRecord): CellRecord => {
  const text = cellText(cell);
  const timeValue = cell.querySelector('time[datetime]')?.getAttribute('datetime') || '';
  const explicitValue = cell.getAttribute('data-value');
  const raw = explicitValue ?? (timeValue || text);
  let sortValue: CellRecord['sortValue'];
  if (column.kind === 'money') {
    sortValue = explicitValue === null
      ? compact(text) || undefined
      : integer(raw) ? BigInt(raw) : undefined;
  } else if (column.kind === 'number') {
    const numeric = raw.replace(/,/g, '').trim();
    const parsed = Number(numeric);
    sortValue = numeric && Number.isFinite(parsed) ? parsed : undefined;
  } else if (column.kind === 'date') {
    const parsed = Date.parse(raw);
    sortValue = Number.isFinite(parsed) ? parsed : undefined;
  } else {
    sortValue = compact(raw) || undefined;
  }
  return {
    element: cell,
    text,
    sortValue,
    currency: cell.dataset.currency || '',
  };
};

const compareText = (left: string, right: string) => left.localeCompare(right, undefined, {
  numeric: true,
  sensitivity: 'base',
});

const compareCells = (left: CellRecord, right: CellRecord, kind: ColumnKind) => {
  if (kind === 'money') {
    const currencyOrder = compareText(left.currency, right.currency);
    if (currencyOrder) return currencyOrder;
    const a = left.sortValue;
    const b = right.sortValue;
    if (typeof a === 'bigint' && typeof b === 'bigint') return a < b ? -1 : a > b ? 1 : 0;
    return compareText(String(a), String(b));
  }
  if (kind === 'number' || kind === 'date') {
    const a = left.sortValue as number;
    const b = right.sortValue as number;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return compareText(String(left.sortValue), String(right.sortValue));
};

const explicitNonNegativeInteger = (value: string | undefined) => {
  if (value === undefined || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};

const metadataRows = (document: Document) => {
  const data = document.body?.dataset || {};
  return [
    ['Dataset', data.reportDataset || data.reportEnvironment || ''],
    ['Period', data.reportRange || ''],
    ['Tests', data.reportTests || ''],
    ['Currency', data.reportCurrency || ''],
  ] as const;
};

const csvCell = (input: string) => {
  let value = input.replace(/\r\n?/g, '\n');
  if (/^\s*[=+\-@]/.test(value)) value = `'${value}`;
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
};

const makeButton = (document: Document, label: string, className: string) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
};

const mountTable = (tableElement: HTMLTableElement) => {
  if (mountedTables.has(tableElement)) return null;
  const document = tableElement.ownerDocument;
  const tableId = tableElement.dataset.crmTable || 'table';
  const tableLabel = tableElement.getAttribute('aria-label') || tableId;
  const headRow = tableElement.tHead?.rows[0];
  const body = tableElement.tBodies[0];
  if (!headRow || !body) return null;

  const headerCells = Array.from(headRow.cells);
  const usedIds = new Set<string>();
  const columns: ColumnRecord[] = headerCells.map((header, index) => {
    const base = header.dataset.column || `column-${index + 1}`;
    let id = base;
    for (let suffix = 2; usedIds.has(id); suffix += 1) id = `${base}-${suffix}`;
    usedIds.add(id);
    return {
      id,
      label: compact(header.textContent || '') || base,
      kind: safeKind(header.dataset.kind),
      header,
      index,
      exportable: header.dataset.export !== 'false',
      sortable: header.dataset.sortable !== 'false',
    };
  });
  if (!columns.length) return null;

  const originalRows = Array.from(body.rows);
  const dataElements = originalRows.filter(row => !row.classList.contains('empty-row'));
  const reportDay = document.body?.dataset.reportDay || '';
  const validReportDay = /^\d{4}-\d{2}-\d{2}$/.test(reportDay);
  const followUpIndex = columns.findIndex(column => normalizedId(column.id).includes('followup'));
  const data: DomRow[] = dataElements.map(element => {
    const cells = columns.map(column => cellRecord(element.cells[column.index], column));
    const followUp = followUpIndex >= 0 ? cells[followUpIndex]?.sortValue : undefined;
    const due = validReportDay && typeof followUp === 'number'
      && followUp <= Date.parse(`${reportDay}T23:59:59.999Z`)
      && (element.dataset.stage || '').toLowerCase() !== 'archived';
    const owned = explicitNonNegativeInteger(element.dataset.ownedSites);
    const published = explicitNonNegativeInteger(element.dataset.publishedSites);
    return {
      element,
      cells,
      search: (element.dataset.search || cells.map(cell => cell.text).join(' ')).toLocaleLowerCase(),
      plan: element.dataset.plan || '',
      stage: element.dataset.stage || '',
      due,
      unpublished: owned !== null && published === 0,
    };
  });

  const syntheticIds = {
    search: '__hq_search',
    plan: '__hq_plan',
    stage: '__hq_stage',
    due: '__hq_due',
    unpublished: '__hq_unpublished',
  };
  const columnDefs: Array<ColumnDef<typeof features, DomRow>> = columns.map(column => ({
    id: column.id,
    accessorFn: row => row.cells[column.index]?.sortValue,
    header: column.label,
    enableColumnFilter: false,
    enableHiding: column.index !== 0,
    enableSorting: column.sortable,
    sortDescFirst: false,
    sortUndefined: 'last',
    sortFn: (rowA, rowB) => compareCells(
      rowA.original.cells[column.index], rowB.original.cells[column.index], column.kind,
    ),
  }));
  columnDefs.push(
    {
      id: syntheticIds.search,
      accessorFn: row => row.search,
      enableHiding: false,
      enableSorting: false,
      filterFn: (row, id, value) => row.getValue<string>(id).includes(String(value).toLocaleLowerCase()),
    },
    {
      id: syntheticIds.plan,
      accessorFn: row => row.plan,
      enableHiding: false,
      enableSorting: false,
      filterFn: (row, id, value) => row.getValue<string>(id) === value,
    },
    {
      id: syntheticIds.stage,
      accessorFn: row => row.stage,
      enableHiding: false,
      enableSorting: false,
      filterFn: (row, id, value) => row.getValue<string>(id) === value,
    },
    {
      id: syntheticIds.due,
      accessorFn: row => row.due,
      enableHiding: false,
      enableSorting: false,
      filterFn: row => row.original.due,
    },
    {
      id: syntheticIds.unpublished,
      accessorFn: row => row.unpublished,
      enableHiding: false,
      enableSorting: false,
      filterFn: row => row.original.unpublished,
    },
  );

  const initialVisibility: Record<string, boolean> = {};
  for (const column of columns) {
    if (column.index > 0 && column.header.hasAttribute('data-default-hidden')) {
      initialVisibility[column.id] = false;
    }
  }
  Object.values(syntheticIds).forEach(id => { initialVisibility[id] = false; });
  const table = constructTable({
    features,
    data,
    columns: columnDefs,
    enableMultiSort: false,
    enableSortingRemoval: true,
    initialState: {
      columnFilters: [],
      columnVisibility: initialVisibility,
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [],
    },
  });

  const listPane = tableElement.closest<HTMLElement>('.list-pane');
  const wrap = tableElement.closest<HTMLElement>('.table-wrap');
  const existingTools = listPane?.querySelector<HTMLElement>('.table-tools') || null;
  const filterCount = listPane?.querySelector<HTMLElement>('[data-filter-count]') || null;
  const filterEmpty = listPane?.querySelector<HTMLElement>('[data-filter-empty]') || null;
  const search = existingTools?.querySelector<HTMLInputElement>('input[data-table-search]') || document.createElement('input');
  const plan = existingTools?.querySelector<HTMLSelectElement>('select[data-table-plan]') || null;
  const stage = existingTools?.querySelector<HTMLSelectElement>('select[data-table-stage]') || null;
  const createdNodes: HTMLElement[] = [];
  const listeners: Array<() => void> = [];
  const listen = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ) => {
    const handler = listener as EventListener;
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  };

  let toolbar = existingTools;
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.className = 'hq-table-toolbar';
    toolbar.dataset.tableControls = tableId;
    const searchLabel = document.createElement('label');
    searchLabel.className = 'hq-table-search';
    const searchText = document.createElement('span');
    searchText.textContent = 'Search';
    search.type = 'search';
    search.dataset.tableSearch = '';
    search.setAttribute('aria-label', `Search ${tableLabel}`);
    searchLabel.append(searchText, search);
    toolbar.append(searchLabel);
    wrap?.before(toolbar);
    createdNodes.push(toolbar);
  }

  const actions = document.createElement('div');
  actions.className = 'hq-table-filters';
  toolbar.append(actions);
  if (toolbar === existingTools) createdNodes.push(actions);

  const isCustomerList = Boolean(listPane && (
    tableId === 'customers' || tableId === 'pipeline'
    || dataElements.some(row => row.hasAttribute('data-customer-row'))
  ));
  let dueToggle: HTMLInputElement | null = null;
  if (isCustomerList && followUpIndex >= 0 && validReportDay) {
    const dueLabel = document.createElement('label');
    dueLabel.className = 'hq-table-check';
    dueToggle = document.createElement('input');
    dueToggle.type = 'checkbox';
    dueToggle.dataset.tableDue = '';
    dueLabel.append(dueToggle, document.createTextNode('Due follow-ups'));
    actions.append(dueLabel);
  }

  let unpublishedToggle: HTMLInputElement | null = null;
  if (isCustomerList) {
    const unpublishedLabel = document.createElement('label');
    unpublishedLabel.className = 'hq-table-check';
    unpublishedToggle = document.createElement('input');
    unpublishedToggle.type = 'checkbox';
    unpublishedToggle.dataset.tableUnpublished = '';
    unpublishedLabel.append(unpublishedToggle, document.createTextNode('No published site'));
    actions.append(unpublishedLabel);
  }

  if (isCustomerList) {
    const view = new URL(document.defaultView?.location.href || 'http://localhost/').searchParams.get('view');
    if (view === 'due' && dueToggle) dueToggle.checked = true;
    if (view === 'unpublished' && unpublishedToggle) unpublishedToggle.checked = true;
  }

  const clear = makeButton(document, 'Clear filters', 'hq-table-clear');
  clear.dataset.tableClear = '';
  actions.append(clear);

  const picker = document.createElement('details');
  picker.className = 'hq-table-columns';
  const pickerSummary = document.createElement('summary');
  pickerSummary.textContent = 'Columns';
  picker.append(pickerSummary);
  const columnList = document.createElement('div');
  columnList.className = 'hq-table-column-list';
  picker.append(columnList);
  const columnChecks = new Map<string, HTMLInputElement>();
  columns.forEach((column, index) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.columnToggle = column.id;
    checkbox.checked = initialVisibility[column.id] !== false;
    checkbox.disabled = index === 0;
    label.append(checkbox, document.createTextNode(column.label));
    columnList.append(label);
    columnChecks.set(column.id, checkbox);
    if (!checkbox.disabled) listen(checkbox, 'change', () => {
      table.getColumn(column.id)!.toggleVisibility(checkbox.checked);
    });
  });
  actions.append(picker);
  const dismissColumns = (event: Event) => {
    if (!picker.open) return;
    if (event.type === 'keydown' && (event as KeyboardEvent).key === 'Escape') {
      picker.open = false;
      pickerSummary.focus();
      event.preventDefault();
    } else if (event.type === 'pointerdown' && event.target && !picker.contains(event.target as Node)) {
      picker.open = false;
    }
  };
  document.addEventListener('keydown', dismissColumns);
  document.addEventListener('pointerdown', dismissColumns);
  listeners.push(() => {
    document.removeEventListener('keydown', dismissColumns);
    document.removeEventListener('pointerdown', dismissColumns);
  });

  const download = makeButton(document, 'Download CSV', 'hq-table-download');
  download.dataset.tableDownload = '';
  actions.append(download);

  const pagination = document.createElement('div');
  pagination.className = 'hq-table-pagination';
  pagination.dataset.tablePagination = tableId;
  const pageSizeLabel = document.createElement('label');
  const pageSizeText = document.createElement('span');
  pageSizeText.textContent = 'Rows per page';
  const pageSize = document.createElement('select');
  pageSize.dataset.tablePageSize = '';
  for (const size of [10, 25, 50, 100]) {
    const option = document.createElement('option');
    option.value = String(size);
    option.textContent = String(size);
    pageSize.append(option);
  }
  pageSizeLabel.append(pageSizeText, pageSize);
  const previous = makeButton(document, 'Previous', 'hq-table-previous');
  previous.dataset.tablePrevious = '';
  const pageCount = document.createElement('span');
  pageCount.className = 'hq-table-page-count';
  pageCount.dataset.tablePageCount = '';
  pageCount.setAttribute('aria-live', 'polite');
  const next = makeButton(document, 'Next', 'hq-table-next');
  next.dataset.tableNext = '';
  const pages = document.createElement('div');
  pages.className = 'hq-table-pages';
  pages.append(previous, pageCount, next);
  pagination.append(pageSizeLabel, pages);
  wrap?.after(pagination);
  createdNodes.push(pagination);

  const originalHeaderState = columns.map(column => ({
    nodes: Array.from(column.header.childNodes),
    ariaSort: column.header.getAttribute('aria-sort'),
    hidden: column.header.hidden,
  }));
  const originalCellVisibility = data.map(row => row.cells.map(cell => cell.element.hidden));
  const sortIndicators = new Map<string, SVGPathElement>();
  columns.forEach(column => {
    if (!column.sortable) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hq-table-sort';
    button.append(...originalHeaderState[column.index].nodes);
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 16 16');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.5');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    icon.append(indicator);
    button.append(icon);
    column.header.replaceChildren(button);
    sortIndicators.set(column.id, indicator);
    listen(button, 'click', () => {
      table.setPageIndex(0);
      table.getColumn(column.id)!.toggleSorting();
    });
  });

  const setFilter = (id: string, value: unknown) => {
    table.setPageIndex(0);
    table.getColumn(id)!.setFilterValue(value || undefined);
  };
  listen(search, 'input', () => setFilter(syntheticIds.search, search.value.trim().toLocaleLowerCase()));
  if (plan) listen(plan, 'change', () => setFilter(syntheticIds.plan, plan.value));
  if (stage) listen(stage, 'change', () => setFilter(syntheticIds.stage, stage.value));
  if (dueToggle) listen(dueToggle, 'change', () => setFilter(syntheticIds.due, dueToggle?.checked));
  if (unpublishedToggle) listen(unpublishedToggle, 'change', () =>
    setFilter(syntheticIds.unpublished, unpublishedToggle?.checked));
  listPane?.querySelectorAll<HTMLElement>('[data-stage-jump]').forEach(chip => {
    listen(chip, 'click', event => {
      event.preventDefault();
      if (!stage) return;
      stage.value = chip.dataset.stageJump || '';
      setFilter(syntheticIds.stage, stage.value);
    });
  });
  listen(clear, 'click', () => {
    search.value = '';
    if (plan) plan.value = '';
    if (stage) stage.value = '';
    if (dueToggle) dueToggle.checked = false;
    if (unpublishedToggle) unpublishedToggle.checked = false;
    table.setPageIndex(0);
    table.resetColumnFilters(true);
  });
  listen(pageSize, 'change', () => {
    table.setPageIndex(0);
    table.setPageSize(Number(pageSize.value));
  });
  listen(previous, 'click', () => table.previousPage());
  listen(next, 'click', () => table.nextPage());

  const makeCsv = () => {
    const exportColumns = columns.filter(column =>
      column.exportable && column.label.toLocaleLowerCase() !== 'actions'
      && table.getColumn(column.id)!.getIsVisible());
    const metadata = metadataRows(document).map(row => row.map(csvCell).join(','));
    const headings = exportColumns.map(column => csvCell(column.label)).join(',');
    const rows = table.getSortedRowModel().rows.map(row => exportColumns
      .map(column => csvCell(row.original.cells[column.index]?.text || '')).join(','));
    return `\uFEFF${[...metadata, '', headings, ...rows].join('\r\n')}`;
  };
  listen(download, 'click', () => {
    const csv = makeCsv();
    const anchor = document.createElement('a');
    const BlobConstructor = document.defaultView?.Blob;
    const urlApi = document.defaultView?.URL;
    let objectUrl = '';
    if (BlobConstructor && urlApi?.createObjectURL) {
      objectUrl = urlApi.createObjectURL(new BlobConstructor([csv], { type: 'text/csv;charset=utf-8' }));
      anchor.href = objectUrl;
    } else {
      anchor.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    }
    const day = validReportDay ? reportDay : 'export';
    anchor.download = `${tableId.replace(/[^a-z0-9_-]+/gi, '-')}-${day}.csv`;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    if (objectUrl) urlApi?.revokeObjectURL(objectUrl);
  });

  const generatedEmpty = document.createElement('tr');
  generatedEmpty.className = 'empty-row hq-table-empty';
  const generatedEmptyCell = document.createElement('td');
  generatedEmptyCell.className = 'hq-table-empty';
  generatedEmptyCell.textContent = 'No records match these filters.';
  generatedEmpty.append(generatedEmptyCell);

  const render = () => {
    const state = table.store.state;
    const filteredRows = table.getSortedRowModel().rows;
    const pageTotal = table.getPageCount();
    if (filteredRows.length && state.pagination.pageIndex >= pageTotal) {
      table.setPageIndex(Math.max(0, pageTotal - 1));
      return;
    }
    const visibleColumns = columns.filter(column => table.getColumn(column.id)!.getIsVisible());
    const visibleCount = Math.max(1, visibleColumns.length);
    columns.forEach(column => {
      const tableColumn = table.getColumn(column.id)!;
      const visible = tableColumn.getIsVisible();
      column.header.hidden = !visible;
      columnChecks.get(column.id)!.checked = visible;
      for (const row of data) row.cells[column.index].element.hidden = !visible;
      if (column.sortable) {
        const sorted = tableColumn.getIsSorted();
        column.header.setAttribute('aria-sort', sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none');
        const indicator = sortIndicators.get(column.id)!;
        indicator.setAttribute('d', sorted === 'asc'
          ? 'M4 7l4-4 4 4M8 3v10'
          : sorted === 'desc' ? 'M4 9l4 4 4-4M8 3v10' : 'M5 6l3-3 3 3M5 10l3 3 3-3');
        const button = column.header.querySelector<HTMLButtonElement>('button.hq-table-sort')!;
        button.setAttribute('aria-label', `${column.label}: ${sorted === 'asc' ? 'sorted ascending' : sorted === 'desc' ? 'sorted descending' : 'not sorted'}`);
      }
    });
    originalRows.filter(row => row.classList.contains('empty-row')).forEach(row => {
      const cell = row.cells[0];
      if (cell) cell.colSpan = visibleCount;
    });
    generatedEmptyCell.colSpan = visibleCount;

    body.replaceChildren();
    if (!data.length) {
      body.append(...originalRows);
    } else if (!filteredRows.length) {
      if (!filterEmpty) body.append(generatedEmpty);
    } else {
      body.append(...table.getRowModel().rows.map(row => row.original.element));
    }
    if (filterEmpty) filterEmpty.hidden = filteredRows.length !== 0 || data.length === 0;
    if (filterCount) filterCount.textContent = `${filteredRows.length} record${filteredRows.length === 1 ? '' : 's'}`;
    clear.disabled = state.columnFilters.length === 0;
    pageSize.value = String(state.pagination.pageSize);
    const start = filteredRows.length ? state.pagination.pageIndex * state.pagination.pageSize + 1 : 0;
    const end = Math.min(filteredRows.length, start + state.pagination.pageSize - 1);
    pageCount.textContent = filteredRows.length ? `${start}–${end} of ${filteredRows.length}` : '0 of 0';
    previous.disabled = !table.getCanPreviousPage();
    next.disabled = !table.getCanNextPage();
  };

  const subscription = table.store.subscribe(render);
  setFilter(syntheticIds.search, search.value.trim().toLocaleLowerCase());
  if (plan?.value) setFilter(syntheticIds.plan, plan.value);
  if (stage?.value) setFilter(syntheticIds.stage, stage.value);
  if (dueToggle?.checked) setFilter(syntheticIds.due, true);
  if (unpublishedToggle?.checked) setFilter(syntheticIds.unpublished, true);
  render();

  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    subscription.unsubscribe();
    listeners.splice(0).forEach(remove => remove());
    createdNodes.forEach(node => node.remove());
    columns.forEach((column, index) => {
      const original = originalHeaderState[index];
      column.header.replaceChildren(...original.nodes);
      column.header.hidden = original.hidden;
      if (original.ariaSort === null) column.header.removeAttribute('aria-sort');
      else column.header.setAttribute('aria-sort', original.ariaSort);
    });
    data.forEach((row, rowIndex) => row.cells.forEach((cell, cellIndex) => {
      cell.element.hidden = originalCellVisibility[rowIndex][cellIndex];
    }));
    body.replaceChildren(...originalRows);
    filterEmpty && (filterEmpty.hidden = true);
    mountedTables.delete(tableElement);
  };
  mountedTables.set(tableElement, cleanup);
  return cleanup;
};

export const mountCrmTables = (root: Document | HTMLElement = document) => {
  const tables: HTMLTableElement[] = [];
  if (root.nodeType === 1 && (root as HTMLElement).matches('table[data-crm-table]')) {
    tables.push(root as HTMLTableElement);
  }
  tables.push(...Array.from(root.querySelectorAll<HTMLTableElement>('table[data-crm-table]')));
  const cleanups = tables.map(mountTable).filter((cleanup): cleanup is () => void => Boolean(cleanup));
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    cleanups.reverse().forEach(cleanup => cleanup());
  };
};
