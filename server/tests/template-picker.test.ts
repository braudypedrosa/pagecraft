import a from "node:assert/strict";
import { resolve } from "node:path";
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from "jsdom";
import { afterEach, test } from "vitest";
import { dashboardPage } from "../src/account-pages.ts";
import { FileSiteTemplateStore, type SiteTemplateSummary } from "../src/site-templates.ts";
import { CUSTOM_SELECT_BOOT_SCRIPT } from "../../shared/custom-select.js";

const openWindows: JSDOM[] = [];

afterEach(() => {
  for (const dom of openWindows.splice(0)) dom.window.close();
});

const renderPicker = async (provided?: SiteTemplateSummary[]) => {
  const templates = provided ?? await new FileSiteTemplateStore(
    resolve(process.cwd(), "premade-sites"),
  ).list();
  const html = dashboardPage(
    { id: "user-1", email: "builder@example.test", name: "Builder" },
    [],
    0,
    { usedBytes: 0, limitBytes: 100 * 1024 * 1024 },
    templates,
  );
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: "http://admin.test/",
    beforeParse(window: any) {
      window.matchMedia = () => ({
        matches: false,
        media: "",
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return false; },
      });
      window.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() { return []; }
        root = null;
        rootMargin = "0px";
        thresholds = [];
      };
      window.HTMLDialogElement.prototype.showModal = function () {
        this.open = true;
      };
      window.HTMLDialogElement.prototype.close = function () {
        this.open = false;
        this.dispatchEvent(new window.Event("close"));
      };
      window.HTMLElement.prototype.scrollIntoView = () => {};
    },
  });
  openWindows.push(dom);
  const { document, Event } = dom.window;
  const dashboardScript = [...document.querySelectorAll("script")]
    .find(script => script.textContent?.includes("const cards=[...document.querySelectorAll('[data-site-card]')]"));
  a.ok(dashboardScript?.textContent);
  dom.window.eval(dashboardScript.textContent);
  dom.window.eval(CUSTOM_SELECT_BOOT_SCRIPT);
  document.querySelector<HTMLElement>("[data-create-open]")?.click();
  document.querySelector<HTMLElement>("[data-template-open]")?.click();
  return { dom, document, Event };
};

const setControl = (
  control: HTMLInputElement | HTMLSelectElement,
  value: string,
  Event: typeof globalThis.Event,
) => {
  control.value = value;
  control.dispatchEvent(new Event(
    control instanceof control.ownerDocument.defaultView!.HTMLInputElement
      ? "input"
      : "change",
    { bubbles: true },
  ));
};

const visibleCards = (document: Document) => [
  ...document.querySelectorAll<HTMLElement>("[data-template-card]"),
].filter(card => !card.hidden);

test("template picker renders the five named templates and represented facets", async () => {
  const { document } = await renderPicker();
  const names = [...document.querySelectorAll("[data-template-card] strong")]
    .map(node => node.textContent);
  a.deepEqual(names, [
    "Common Ground · Architecture Studio",
    "Marea · Coastal Stays",
    "Northline · Creative Studio",
    "Salt House · Holiday Homes",
    "Stillwood · Cabin Retreat",
  ]);
  a.deepEqual(
    [...document.querySelectorAll<HTMLOptionElement>("[data-template-industry] option")]
      .map(option => [option.value, option.textContent]),
    [
      ["", "All industries"],
      ["architecture-design", "Architecture & Design"],
      ["creative-services", "Creative Services"],
      ["travel-hospitality", "Travel & Hospitality"],
    ],
  );
  a.deepEqual(
    [...document.querySelectorAll<HTMLOptionElement>("[data-template-site-type] option")]
      .map(option => [option.value, option.textContent]),
    [
      ["", "All site types"],
      ["accommodation", "Accommodation"],
      ["business", "Business"],
      ["portfolio", "Portfolio"],
    ],
  );
});

test("search and facets combine, include aliases, and clear a zero-result state", async () => {
  const { document, Event } = await renderPicker();
  const search = document.querySelector<HTMLInputElement>("[data-template-search]")!;
  const industry = document.querySelector<HTMLSelectElement>("[data-template-industry]")!;
  const siteType = document.querySelector<HTMLSelectElement>("[data-template-site-type]")!;
  const next = document.querySelector<HTMLButtonElement>("[data-create-next]")!;

  setControl(search, "architect", Event);
  a.deepEqual(
    visibleCards(document).map(card => card.querySelector("strong")?.textContent),
    ["Common Ground · Architecture Studio"],
  );
  setControl(search, "", Event);
  setControl(industry, "travel-hospitality", Event);
  setControl(siteType, "accommodation", Event);
  a.equal(visibleCards(document).length, 3);
  setControl(search, "vacation homes", Event);
  a.deepEqual(
    visibleCards(document).map(card => card.querySelector("strong")?.textContent),
    ["Salt House · Holiday Homes"],
  );
  setControl(search, "accounting", Event);
  a.equal(visibleCards(document).length, 0);
  a.equal(document.querySelector("[data-template-results]")?.textContent, "0 templates");
  a.equal(document.querySelector<HTMLElement>("[data-template-empty]")?.hidden, false);
  a.equal(next.disabled, true);
  const radios = [...document.querySelectorAll<HTMLInputElement>(
    'input[name="premadeTemplate"]',
  )];
  a.ok(radios.every(radio => radio.disabled && !radio.checked));

  document.querySelector<HTMLElement>("[data-template-clear]")?.click();
  a.equal(search.value, "");
  a.equal(industry.value, "");
  a.equal(siteType.value, "");
  a.equal(industry.parentElement?.querySelector(".pc-custom-select-trigger span")?.textContent, "All industries");
  a.equal(siteType.parentElement?.querySelector(".pc-custom-select-trigger span")?.textContent, "All site types");
  a.equal(visibleCards(document).length, 5);
  a.equal(radios.filter(radio => radio.checked).length, 1);
  a.equal(next.disabled, false);
  a.equal(document.activeElement, search);
});

test("filter selection and site details survive Back without a hidden submission", async () => {
  const { document, Event } = await renderPicker();
  const industry = document.querySelector<HTMLSelectElement>("[data-template-industry]")!;
  const next = document.querySelector<HTMLButtonElement>("[data-create-next]")!;
  setControl(industry, "creative-services", Event);
  const visible = visibleCards(document);
  a.equal(visible.length, 1);
  const northline = visible[0].querySelector<HTMLInputElement>("input")!;
  a.equal(northline.value, "independent-studio@2.0.9");
  a.equal(northline.checked, true);
  a.ok([...document.querySelectorAll<HTMLInputElement>('input[name="premadeTemplate"]')]
    .filter(radio => radio !== northline)
    .every(radio => radio.disabled && !radio.checked));

  next.click();
  a.equal(document.querySelector("[data-create-modal]")?.getAttribute("data-step"), "details");
  a.equal(
    document.querySelector("[data-create-source]")?.textContent,
    "Northline · Creative Studio",
  );
  a.equal(
    document.querySelector<HTMLInputElement>("[data-site-template]")?.value,
    "independent-studio@2.0.9",
  );
  const name = document.querySelector<HTMLInputElement>('[name="name"]')!;
  const slug = document.querySelector<HTMLInputElement>('[name="slug"]')!;
  name.value = "Northline client";
  slug.value = "northline-client";

  document.querySelector<HTMLElement>("[data-create-back]")?.click();
  a.equal(document.querySelector("[data-create-modal]")?.getAttribute("data-step"), "templates");
  a.equal(industry.value, "creative-services");
  a.equal(northline.checked, true);
  next.click();
  a.equal(name.value, "Northline client");
  a.equal(slug.value, "northline-client");
});


test("an unrecognized template retains clean catalog metadata", async () => {
  const templates = await new FileSiteTemplateStore(resolve(process.cwd(), "premade-sites")).list();
  const source = templates[0]!;
  const { document } = await renderPicker([{ ...source, id: "future-template", name: "Future Template", description: "Factual catalog copy." }]);
  a.equal(document.querySelector("[data-template-card] strong")?.textContent, "Future Template");
  a.equal(document.querySelector("[data-template-card] small")?.textContent, `${source.pages.length} pages`);
});
