import type { SiteTemplateSummary } from './site-templates.ts';

export interface TemplateDiscoveryOption {
  id: string;
  label: string;
}

interface TemplateDiscoveryConfig {
  name: string;
  description: string;
  industries: readonly TemplateDiscoveryOption[];
  siteTypes: readonly TemplateDiscoveryOption[];
  aliases: readonly string[];
}

const architectureDesign = { id: 'architecture-design', label: 'Architecture & Design' };
const creativeServices = { id: 'creative-services', label: 'Creative Services' };
const foodAndDrink = { id: 'food-and-drink', label: 'Food & Drink' };
const healthAndWellness = { id: 'health-and-wellness', label: 'Health & Wellness' };
const professionalServices = { id: 'professional-services', label: 'Professional Services' };
const travelHospitality = { id: 'travel-hospitality', label: 'Travel & Hospitality' };

const portfolio = { id: 'portfolio', label: 'Portfolio' };
const business = { id: 'business', label: 'Business' };
const accommodation = { id: 'accommodation', label: 'Accommodation' };
const restaurant = { id: 'restaurant', label: 'Restaurant' };

const discoveryById: Readonly<Record<string, TemplateDiscoveryConfig>> = {
  'architecture-studio': {
    name: 'Common Ground · Architecture Studio',
    description: 'A project-led portfolio and business site for architecture and design studios, with practice, services and contact pages.',
    industries: [architectureDesign],
    siteTypes: [portfolio, business],
    aliases: ['architect', 'architecture portfolio', 'design practice', 'design studio', 'project portfolio'],
  },
  'coastal-rentals': {
    name: 'Marea · Coastal Stays',
    description: 'An image-led accommodation site for independent hosts, with multiple stays, guest services, about and contact pages.',
    industries: [travelHospitality],
    siteTypes: [accommodation],
    aliases: ['coastal stays', 'holiday rental', 'short-term rental', 'vacation rental', 'guest house'],
  },
  'neighborhood-cafe': {
    name: 'Morning Field · Neighborhood Café',
    description: 'A warm four-page neighborhood cafe site with an editorial menu, story and visit details across Home, Menu, Story and Visit pages.',
    industries: [foodAndDrink],
    siteTypes: [restaurant, business],
    aliases: ['cafe', 'coffee shop', 'breakfast', 'local cafe'],
  },
  'advisory-studio': {
    name: 'North Measure · Advisory Studio',
    description: 'A five-page advisory studio site with Services, Case Studies, Approach and Inquiry pages for presenting service scopes and case notes.',
    industries: [professionalServices],
    siteTypes: [business],
    aliases: ['consultant', 'consultancy', 'professional firm', 'business advisory'],
  },
  'independent-studio': {
    name: 'Northline · Creative Studio',
    description: 'A high-contrast portfolio and business site for independent creative studios, with services, about and contact pages.',
    industries: [creativeServices],
    siteTypes: [portfolio, business],
    aliases: ['creative agency', 'creative practice', 'design portfolio', 'design studio', 'independent studio'],
  },
  'photographic-portfolio': {
    name: 'Noor Vale · Photography Portfolio',
    description: 'A five-page documentary photography portfolio with Series, Field Notes, Commissions and Contact pages for sequenced work and commission guidance.',
    industries: [creativeServices],
    siteTypes: [portfolio],
    aliases: ['photographer', 'documentary photography', 'photography portfolio'],
  },
  'salt-house': {
    name: 'Salt House · Holiday Homes',
    description: 'A coastal accommodation site for a small holiday-home collection, with property galleries and space for booking-provider links.',
    industries: [travelHospitality],
    siteTypes: [accommodation],
    aliases: ['coastal homes', 'holiday homes', 'holiday rental', 'vacation homes', 'vacation rental collection'],
  },
  'wellness-practice': {
    name: 'Still Day · Wellness Practice',
    description: 'A calm five-page wellness practice site with Services, What to Expect, Practitioners and Contact pages for explaining support and practitioner information.',
    industries: [healthAndWellness],
    siteTypes: [business],
    aliases: ['wellness', 'practitioner', 'studio', 'appointment'],
  },
  stillwood: {
    name: 'Stillwood · Cabin Retreat',
    description: 'A woodland accommodation site for a cabin retreat, with stay details, experiences, a field guide, story and contact pages.',
    industries: [travelHospitality],
    siteTypes: [accommodation],
    aliases: ['cabin stays', 'cabins', 'forest retreat', 'lodge', 'nature retreat', 'woodland stays'],
  },
};

const cloneOptions = (options: readonly TemplateDiscoveryOption[]) => options.map(option => ({ ...option }));

const searchText = (template: SiteTemplateSummary, config: TemplateDiscoveryConfig | undefined) => [
  config?.name,
  config?.description,
  template.id,
  template.name,
  template.sampleName,
  template.description,
  ...template.categories,
  ...template.pages.flatMap(page => [page.name, page.slug]),
  ...config?.industries.flatMap(option => [option.id, option.label]) || [],
  ...config?.siteTypes.flatMap(option => [option.id, option.label]) || [],
  ...config?.aliases || [],
].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');

export const getTemplateDiscovery = (template: SiteTemplateSummary): {
  name: string;
  description: string;
  industries: TemplateDiscoveryOption[];
  siteTypes: TemplateDiscoveryOption[];
  searchText: string;
} => {
  const config = discoveryById[template.id];
  return {
    name: config?.name || template.name,
    description: config?.description || template.description,
    industries: cloneOptions(config?.industries || []),
    siteTypes: cloneOptions(config?.siteTypes || []),
    searchText: searchText(template, config),
  };
};

export const discoveryOptions = (
  templates: SiteTemplateSummary[],
  dimension: 'industries' | 'siteTypes',
): TemplateDiscoveryOption[] => {
  const byId = new Map<string, TemplateDiscoveryOption>();
  for (const template of templates) {
    for (const option of getTemplateDiscovery(template)[dimension]) byId.set(option.id, option);
  }
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
};
