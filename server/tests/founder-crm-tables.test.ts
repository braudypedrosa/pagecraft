import a from 'node:assert/strict';
import { test } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import { mountCrmTables } from '../src/founder-crm-client/tables.ts';

const click = (element: Element, _window: Window) =>
  element.dispatchEvent(new element.ownerDocument!.defaultView!.MouseEvent('click', {
    bubbles: true, cancelable: true,
  }));

const change = (element: Element, _window: Window, type = 'change') =>
  element.dispatchEvent(new element.ownerDocument!.defaultView!.Event(type, { bubbles: true }));

const visibleNames = (document: Document, tableId: string) => Array.from(
  document.querySelectorAll<HTMLTableRowElement>(`table[data-crm-table="${tableId}"] tbody tr:not(.empty-row)`),
).map(row => row.cells[0]?.textContent?.trim());

test('sorts text, numbers, dates, and exact mixed-currency money with missing values last', () => {
  const dom = new JSDOM(`<!doctype html><body data-report-day="2026-10-09">
    <div class="table-wrap"><table data-crm-table="finance" aria-label="Finance">
      <thead><tr>
        <th data-column="name">Name</th>
        <th data-column="count" data-kind="number">Count</th>
        <th data-column="due" data-kind="date">Due</th>
        <th data-column="amount" data-kind="money">Amount</th>
      </tr></thead><tbody>
        <tr><td>Zulu</td><td data-value="10">10</td><td><time datetime="2026-10-10">Oct 10</time></td><td data-value="900719925474099312345" data-currency="USD">USD huge B</td></tr>
        <tr><td>alpha</td><td data-value="2">2</td><td><time datetime="2025-01-01">Jan 1</time></td><td data-value="-5" data-currency="USD">USD negative</td></tr>
        <tr><td>Beta</td><td data-value="-1">-1</td><td>Not supplied</td><td data-value="900719925474099312344" data-currency="USD">USD huge A</td></tr>
        <tr><td>Echo</td><td>Unavailable</td><td><time datetime="2024-01-01">Jan 1</time></td><td data-value="1" data-currency="EUR">EUR one</td></tr>
        <tr><td>Missing</td><td></td><td></td><td data-value="">Unavailable</td></tr>
      </tbody>
    </table></div>
  </body>`, { url: 'https://hq.test/revenue' });
  const document = dom.window.document as Document;
  const cleanup = mountCrmTables(document);
  try {
    const headers = document.querySelectorAll<HTMLTableCellElement>('th');
    click(headers[0].querySelector('button')!, dom.window);
    a.deepEqual(visibleNames(document, 'finance'), ['alpha', 'Beta', 'Echo', 'Missing', 'Zulu']);
    a.equal(headers[0].getAttribute('aria-sort'), 'ascending');
    click(headers[0].querySelector('button')!, dom.window);
    a.deepEqual(visibleNames(document, 'finance'), ['Zulu', 'Missing', 'Echo', 'Beta', 'alpha']);
    click(headers[0].querySelector('button')!, dom.window);
    a.deepEqual(visibleNames(document, 'finance'), ['Zulu', 'alpha', 'Beta', 'Echo', 'Missing']);
    a.equal(headers[0].getAttribute('aria-sort'), 'none');

    click(headers[1].querySelector('button')!, dom.window);
    a.deepEqual(visibleNames(document, 'finance'), ['Beta', 'alpha', 'Zulu', 'Echo', 'Missing']);
    click(headers[1].querySelector('button')!, dom.window);
    a.deepEqual(visibleNames(document, 'finance'), ['Zulu', 'alpha', 'Beta', 'Echo', 'Missing'],
      'missing numbers remain last when descending');

    click(headers[2].querySelector('button')!, dom.window);
    a.deepEqual(visibleNames(document, 'finance'), ['Echo', 'alpha', 'Zulu', 'Beta', 'Missing']);
    click(headers[2].querySelector('button')!, dom.window);
    a.deepEqual(visibleNames(document, 'finance'), ['Zulu', 'alpha', 'Echo', 'Beta', 'Missing'],
      'null dates remain last when descending');

    click(headers[3].querySelector('button')!, dom.window);
    a.deepEqual(visibleNames(document, 'finance'), ['Echo', 'alpha', 'Beta', 'Zulu', 'Missing']);
    click(headers[3].querySelector('button')!, dom.window);
    a.deepEqual(visibleNames(document, 'finance'), ['Zulu', 'Beta', 'alpha', 'Echo', 'Missing'],
      'huge same-currency minor units sort exactly before currency grouping is reversed');
  } finally {
    cleanup();
    dom.window.close();
  }
});

test('owns list filters, quick views, stage chips, truthful counts, and pagination', () => {
  const rows = Array.from({ length: 13 }, (_, index) => {
    const number = index + 1;
    const stage = number === 3 ? 'archived' : number % 2 ? 'lead' : 'customer';
    const followUp = number <= 4 ? '2026-10-09' : '2026-10-20';
    const published = number === 5 ? '' : number % 4 === 0 ? '0' : '1';
    return `<tr data-customer-row data-search="person ${number} acme" data-plan="${number % 2 ? 'free' : 'pro'}" data-stage="${stage}" data-owned-sites="1"${published ? ` data-published-sites="${published}"` : ''}>
      <td>Person ${number}</td><td>${number % 2 ? 'Free' : 'Pro'}</td><td>${stage}</td><td><time datetime="${followUp}">${followUp}</time></td>
    </tr>`;
  }).join('');
  const dom = new JSDOM(`<!doctype html><body data-report-day="2026-10-09">
    <section class="list-pane">
      <a href="#list" data-stage-jump="customer">Customers</a>
      <div class="table-tools">
        <label>Search<input data-table-search></label>
        <select data-table-plan><option value="">All</option><option value="free">Free</option><option value="pro">Pro</option></select>
        <select data-table-stage><option value="">All</option><option value="lead">Lead</option><option value="customer">Customer</option><option value="archived">Archived</option></select>
        <span data-filter-count></span>
      </div>
      <div class="table-wrap" id="list"><table data-crm-table="customers" aria-label="Customers">
        <thead><tr><th data-column="name">Customer</th><th data-column="plan">Plan</th><th data-column="stage">Stage</th><th data-column="followup" data-kind="date">Follow-up</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p data-filter-empty hidden>No matches</p>
    </section>
  </body>`, { url: 'https://hq.test/customers?view=due' });
  const document = dom.window.document as Document;
  let exportHref = '';
  dom.window.HTMLAnchorElement.prototype.click = function captureDownload() {
    exportHref = this.href;
  };
  const cleanup = mountCrmTables(document);
  try {
    const due = document.querySelector<HTMLInputElement>('[data-table-due]')!;
    const unpublished = document.querySelector<HTMLInputElement>('[data-table-unpublished]')!;
    const count = document.querySelector('[data-filter-count]')!;
    a.equal(due.checked, true);
    a.equal(count.textContent, '3 records', 'due view excludes archived rows');
    a.deepEqual(visibleNames(document, 'customers'), ['Person 1', 'Person 2', 'Person 4']);

    click(document.querySelector('[data-table-clear]')!, dom.window);
    a.equal(count.textContent, '13 records');
    a.equal(document.querySelector('[data-table-page-count]')!.textContent, '1–10 of 13');
    click(document.querySelector('[data-table-download]')!, dom.window);
    a.match(decodeURIComponent(exportHref.split(',')[1]), /Person 13/,
      'CSV includes filtered rows beyond the current page');
    click(document.querySelector('[data-table-next]')!, dom.window);
    a.equal(document.querySelector('[data-table-page-count]')!.textContent, '11–13 of 13');

    const search = document.querySelector<HTMLInputElement>('[data-table-search]')!;
    search.value = 'person 12';
    change(search, dom.window, 'input');
    a.equal(document.querySelector('[data-table-page-count]')!.textContent, '1–1 of 1',
      'filter resets page index');

    click(document.querySelector('[data-table-clear]')!, dom.window);
    unpublished.checked = true;
    change(unpublished, dom.window);
    a.deepEqual(visibleNames(document, 'customers'), ['Person 4', 'Person 8', 'Person 12']);
    a.equal(count.textContent, '3 records');
    a.ok(!visibleNames(document, 'customers').includes('Person 5'),
      'missing published count is unavailable, not zero');

    click(document.querySelector('[data-table-clear]')!, dom.window);
    click(document.querySelector('[data-stage-jump]')!, dom.window);
    a.equal(document.querySelector<HTMLSelectElement>('[data-table-stage]')!.value, 'customer');
    a.equal(count.textContent, '6 records');

    const plan = document.querySelector<HTMLSelectElement>('[data-table-plan]')!;
    plan.value = 'pro';
    change(plan, dom.window);
    a.equal(count.textContent, '6 records');
    plan.value = 'free';
    change(plan, dom.window);
    a.equal(count.textContent, '0 records');
    a.equal(document.querySelector<HTMLElement>('[data-filter-empty]')!.hidden, false);
  } finally {
    cleanup();
    dom.window.close();
  }
});

test('column picker preserves identity, fixes empty colspan, and CSV is filtered, sorted, contextual, and safe', () => {
  const dom = new JSDOM(`<!doctype html><body data-report-day="2026-10-09" data-report-range="Past 30 Days" data-report-tests="Exclude" data-report-currency="NZD" data-report-environment="Staging">
    <div class="table-wrap"><table data-crm-table="costs" aria-label="Costs">
      <thead><tr>
        <th data-column="cost">Cost</th>
        <th data-column="category" data-default-hidden>Category</th>
        <th data-column="monthly" data-kind="money">Monthly budget</th>
        <th data-column="actions" data-export="false" data-sortable="false">Actions</th>
      </tr></thead><tbody>
        <tr><td>=Setup, fee</td><td>One-time</td><td data-value="200" data-currency="NZD">NZD 2.00</td><td><form id="keep"><button>Keep</button></form></td></tr>
        <tr><td>@Monthly</td><td>Recurring</td><td data-value="100" data-currency="NZD">NZD 1.00</td><td><form><button>Other</button></form></td></tr>
      </tbody>
    </table></div>
  </body>`, { url: 'https://hq.test/costs' });
  const document = dom.window.document as Document;
  const form = document.querySelector<HTMLFormElement>('#keep')!;
  let submitted = 0;
  form.addEventListener('submit', event => { event.preventDefault(); submitted += 1; });
  let href = '';
  let filename = '';
  dom.window.HTMLAnchorElement.prototype.click = function captureDownload() {
    href = this.href;
    filename = this.download;
  };
  const cleanup = mountCrmTables(document);
  try {
    a.equal(document.querySelector('#keep'), form, 'enhancement retains original form node');
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    a.equal(submitted, 1, 'existing form listener remains bound');
    a.equal(document.querySelector<HTMLTableCellElement>('th[data-column="category"]')!.hidden, true);
    a.equal(document.querySelector<HTMLTableCellElement>('tbody td:nth-child(2)')!.hidden, true);
    const identity = document.querySelector<HTMLInputElement>('[data-column-toggle="cost"]')!;
    a.equal(identity.disabled, true);
    const category = document.querySelector<HTMLInputElement>('[data-column-toggle="category"]')!;
    category.checked = true;
    change(category, dom.window);
    a.equal(document.querySelector<HTMLTableCellElement>('th[data-column="category"]')!.hidden, false);
    a.equal(document.querySelector('th[data-column="actions"] button.hq-table-sort'), null,
      'explicit action column is not sortable');
    const picker = document.querySelector<HTMLDetailsElement>('.hq-table-columns')!;
    picker.open = true;
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    a.equal(picker.open, false);
    a.equal(document.activeElement, picker.querySelector('summary'));
    picker.open = true;
    document.body.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
    a.equal(picker.open, false);

    const monthly = document.querySelector('th[data-column="monthly"] button')!;
    click(monthly, dom.window);
    a.deepEqual(visibleNames(document, 'costs'), ['@Monthly', '=Setup, fee']);
    click(document.querySelector('[data-table-download]')!, dom.window);
    a.equal(filename, 'costs-2026-10-09.csv');
    const csv = decodeURIComponent(href.split(',')[1]);
    a.equal(csv.charCodeAt(0), 0xfeff, 'CSV starts with a UTF-8 BOM for spreadsheet import');
    a.match(csv, /^\uFEFFDataset,Staging\r\nPeriod,Past 30 Days\r\nTests,Exclude\r\nCurrency,NZD/);
    a.match(csv, /Cost,Category,Monthly budget/);
    a.doesNotMatch(csv, /Actions/);
    a.ok(csv.indexOf("'@Monthly") < csv.indexOf("'=Setup"), 'CSV uses current sort across all matching rows');
    a.match(csv, /"'=Setup, fee"/, 'CSV prefixes formula cells and quotes commas');

    const search = document.querySelector<HTMLInputElement>('[data-table-search]')!;
    search.value = 'does not exist';
    change(search, dom.window, 'input');
    a.equal(document.querySelector<HTMLTableCellElement>('tr.hq-table-empty td')!.colSpan, 4);
  } finally {
    cleanup();
    a.equal(document.querySelector('#keep'), form);
    a.equal(document.querySelector('.hq-table-toolbar'), null);
    a.equal(document.querySelector('th[data-column="cost"]')!.textContent, 'Cost');
    dom.window.close();
  }
});

test('mounts table instances independently and ignores duplicate mounting', () => {
  const table = (id: string, names: string[]) => `<div class="table-wrap"><table data-crm-table="${id}" aria-label="${id}"><thead><tr><th data-column="name">Name</th></tr></thead><tbody>${names.map(name => `<tr><td>${name}</td></tr>`).join('')}</tbody></table></div>`;
  const dom = new JSDOM(`<!doctype html><body>${table('first', ['B', 'A'])}${table('second', ['D', 'C'])}</body>`);
  const document = dom.window.document as Document;
  const firstCleanup = mountCrmTables(document);
  const duplicateCleanup = mountCrmTables(document);
  try {
    a.equal(document.querySelectorAll('.hq-table-toolbar').length, 2);
    click(document.querySelector('table[data-crm-table="first"] th button')!, dom.window);
    a.deepEqual(visibleNames(document, 'first'), ['A', 'B']);
    a.deepEqual(visibleNames(document, 'second'), ['D', 'C']);
    duplicateCleanup();
    a.equal(document.querySelectorAll('.hq-table-toolbar').length, 2,
      'second mount does not own or remove first mount listeners');
  } finally {
    firstCleanup();
    dom.window.close();
  }
});
