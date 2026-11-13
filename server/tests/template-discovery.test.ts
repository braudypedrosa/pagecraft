import { test } from 'vitest';
import a from 'node:assert/strict';
import type { SiteTemplateSummary } from '../src/site-templates.ts';
import { discoveryOptions, getTemplateDiscovery } from '../src/template-discovery.ts';

const template = (overrides: Partial<SiteTemplateSummary> = {}): SiteTemplateSummary => ({
  format: 'pagecraft.site-template.v1',
  id: 'independent-studio',
  version: '2.0.9',
  name: 'Independent Studio',
  sampleName: 'Northline Studio',
  description: 'A high-contrast four-page studio system for independent creative practices.',
  categories: ['Studio', 'Services', 'Creative'],
  pages: [
    { id: 'page-home', name: 'Home', slug: 'index' },
    { id: 'page-services', name: 'Services', slug: 'services' },
  ],
  packageFile: 'site.pagecraft-site.zip',
  packageSha256: 'a'.repeat(64),
  previewPage: 'index.html',
  assetCount: 5,
  assetBytes: 100,
  ...overrides,
});

test('known templates receive clear names and separate controlled facets', () => {
  const cases: Array<{
    id: string;
    name: string;
    industries: string[];
    siteTypes: string[];
  }> = [
    {
      id: 'architecture-studio',
      name: 'Common Ground · Architecture Studio',
      industries: ['Architecture & Design'],
      siteTypes: ['Portfolio', 'Business'],
    },
    {
      id: 'coastal-rentals',
      name: 'Marea · Coastal Stays',
      industries: ['Travel & Hospitality'],
      siteTypes: ['Accommodation'],
    },
    {
      id: 'neighborhood-cafe',
      name: 'Morning Field · Neighborhood Café',
      industries: ['Food & Drink'],
      siteTypes: ['Restaurant', 'Business'],
    },
    {
      id: 'advisory-studio',
      name: 'North Measure · Advisory Studio',
      industries: ['Professional Services'],
      siteTypes: ['Business'],
    },
    {
      id: 'independent-studio',
      name: 'Northline · Creative Studio',
      industries: ['Creative Services'],
      siteTypes: ['Portfolio', 'Business'],
    },
    {
      id: 'photographic-portfolio',
      name: 'Noor Vale · Photography Portfolio',
      industries: ['Creative Services'],
      siteTypes: ['Portfolio'],
    },
    {
      id: 'salt-house',
      name: 'Salt House · Holiday Homes',
      industries: ['Travel & Hospitality'],
      siteTypes: ['Accommodation'],
    },
    {
      id: 'stillwood',
      name: 'Stillwood · Cabin Retreat',
      industries: ['Travel & Hospitality'],
      siteTypes: ['Accommodation'],
    },
    {
      id: 'wellness-practice',
      name: 'Still Day · Wellness Practice',
      industries: ['Health & Wellness'],
      siteTypes: ['Business'],
    },
  ];

  for (const expected of cases) {
    const discovery = getTemplateDiscovery(template({ id: expected.id }));
    a.equal(discovery.name, expected.name);
    a.deepEqual(discovery.industries.map(option => option.label), expected.industries);
    a.deepEqual(discovery.siteTypes.map(option => option.label), expected.siteTypes);
  }

  const industryLabels = new Set(cases.flatMap(item => item.industries));
  const siteTypeLabels = new Set(cases.flatMap(item => item.siteTypes));
  a.deepEqual([...industryLabels].filter(label => siteTypeLabels.has(label)), []);
});

test('search text keeps old catalog terms and adds useful aliases', () => {
  const discovery = getTemplateDiscovery(template({
    id: 'salt-house',
    name: 'Vacation Rental Collection',
    sampleName: 'Salt House',
    categories: ['Vacation rentals', 'Hospitality'],
    pages: [{ id: 'salt-page-homes', name: 'The Homes', slug: 'homes' }],
  }));

  for (const term of [
    'salt house · holiday homes',
    'salt-house',
    'vacation rental collection',
    'salt house',
    'hospitality',
    'the homes',
    'travel & hospitality',
    'coastal homes',
  ]) a.ok(discovery.searchText.includes(term), `expected search text to contain ${term}`);
});

test('native draft metadata is factual and searchable by supplied aliases', () => {
  const cases: Array<{ id: string; terms: string[] }> = [
    {
      id: 'neighborhood-cafe',
      terms: ['morning field · neighborhood café', 'neighborhood cafe', 'home', 'menu', 'story', 'visit', 'coffee shop', 'breakfast'],
    },
    {
      id: 'advisory-studio',
      terms: ['north measure · advisory studio', 'advisory studio', 'services', 'case studies', 'approach', 'inquiry', 'consultancy', 'business advisory'],
    },
    {
      id: 'photographic-portfolio',
      terms: ['noor vale · photography portfolio', 'documentary photography', 'series', 'field notes', 'commissions', 'contact', 'photographer'],
    },
    {
      id: 'wellness-practice',
      terms: ['still day · wellness practice', 'wellness practice', 'services', 'what to expect', 'practitioners', 'contact', 'appointment'],
    },
  ];

  for (const expected of cases) {
    const discovery = getTemplateDiscovery(template({ id: expected.id }));
    for (const term of expected.terms) a.ok(discovery.searchText.includes(term), `expected ${expected.id} search text to contain ${term}`);
  }
});

test('unrecognized templates retain catalog copy and remain searchable without invented facets', () => {
  const future = template({
    id: 'future-template',
    name: 'Future Template',
    sampleName: 'Future Sample',
    description: 'A factual catalog description.',
    categories: ['Unmapped Category'],
    pages: [{ id: 'page-journal', name: 'Field Journal', slug: 'field-journal' }],
  });
  const discovery = getTemplateDiscovery(future);

  a.equal(discovery.name, future.name);
  a.equal(discovery.description, future.description);
  a.deepEqual(discovery.industries, []);
  a.deepEqual(discovery.siteTypes, []);
  for (const term of ['future-template', 'future sample', 'unmapped category', 'field journal']) {
    a.ok(discovery.searchText.includes(term));
  }
});

test('facet options are deduplicated and sorted independently', () => {
  const templates = [
    template({ id: 'stillwood' }),
    template({ id: 'architecture-studio' }),
    template({ id: 'coastal-rentals' }),
    template({ id: 'independent-studio' }),
    template({ id: 'salt-house' }),
  ];

  a.deepEqual(discoveryOptions(templates, 'industries'), [
    { id: 'architecture-design', label: 'Architecture & Design' },
    { id: 'creative-services', label: 'Creative Services' },
    { id: 'travel-hospitality', label: 'Travel & Hospitality' },
  ]);
  a.deepEqual(discoveryOptions(templates, 'siteTypes'), [
    { id: 'accommodation', label: 'Accommodation' },
    { id: 'business', label: 'Business' },
    { id: 'portfolio', label: 'Portfolio' },
  ]);
});

test('draft facets appear only when their mapped templates are supplied', () => {
  const templates = [
    template({ id: 'neighborhood-cafe' }),
    template({ id: 'advisory-studio' }),
    template({ id: 'photographic-portfolio' }),
    template({ id: 'wellness-practice' }),
  ];

  a.deepEqual(discoveryOptions(templates, 'industries'), [
    { id: 'creative-services', label: 'Creative Services' },
    { id: 'food-and-drink', label: 'Food & Drink' },
    { id: 'health-and-wellness', label: 'Health & Wellness' },
    { id: 'professional-services', label: 'Professional Services' },
  ]);
  a.deepEqual(discoveryOptions(templates, 'siteTypes'), [
    { id: 'business', label: 'Business' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'restaurant', label: 'Restaurant' },
  ]);

  a.deepEqual(discoveryOptions([template({ id: 'future-template' })], 'industries'), []);
  a.deepEqual(discoveryOptions([template({ id: 'future-template' })], 'siteTypes'), []);
});

test('discovery does not mutate catalog identity or expose mutable taxonomy state', () => {
  const source = template({ id: 'architecture-studio', version: '1.0.0', packageSha256: 'b'.repeat(64) });
  const before = structuredClone(source);
  const first = getTemplateDiscovery(source);
  first.industries[0]!.label = 'Changed';
  first.siteTypes.splice(0);

  a.deepEqual(source, before);
  a.equal(source.version, '1.0.0');
  a.equal(source.packageSha256, 'b'.repeat(64));
  a.equal(getTemplateDiscovery(source).industries[0]?.label, 'Architecture & Design');
  a.deepEqual(getTemplateDiscovery(source).siteTypes.map(option => option.label), ['Portfolio', 'Business']);
});
