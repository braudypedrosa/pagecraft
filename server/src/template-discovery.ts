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
const educationAndLearning = { id: 'education-and-learning', label: 'Education & Learning' };
const foodAndDrink = { id: 'food-and-drink', label: 'Food & Drink' };
const healthAndWellness = { id: 'health-and-wellness', label: 'Health & Wellness' };
const professionalServices = { id: 'professional-services', label: 'Professional Services' };
const travelHospitality = { id: 'travel-hospitality', label: 'Travel & Hospitality' };

const portfolio = { id: 'portfolio', label: 'Portfolio' };
const business = { id: 'business', label: 'Business' };
const accommodation = { id: 'accommodation', label: 'Accommodation' };
const education = { id: 'education', label: 'Education' };
const restaurant = { id: 'restaurant', label: 'Restaurant' };

const discoveryById: Readonly<Record<string, TemplateDiscoveryConfig>> = {
  'alder-and-silt': {
    name: 'ALDER & SILT · Landscape Architecture',
    description: 'Four-page ecological landscape architecture and coastal watershed practice featuring a floating header over a 100dvh coastal meadow stage, headland slope before-and-after compare slider, biome filter archive, soil infiltration progress gauges, and site walk intake.',
    industries: [architectureDesign],
    siteTypes: [portfolio, business],
    aliases: ['landscape architecture', 'ecological design', 'coastal restoration', 'civil grading', 'native plants'],
  },
  'architecture-studio': {
    name: 'Common Ground · Architecture Studio',
    description: 'A project-led portfolio and business site for architecture and design studios, with practice, services and contact pages.',
    industries: [architectureDesign],
    siteTypes: [portfolio, business],
    aliases: ['architect', 'architecture portfolio', 'design practice', 'design studio', 'project portfolio'],
  },
  'bramble-vet': {
    name: 'Bramble Vet · Veterinary Clinic',
    description: 'Single-page fear-free veterinary clinic landing site featuring a friendly split phone header, arch-masked patient portrait hero, click-to-play clinic video tour facade, ruled care pricing, care team slider, pet parent quotes, and appointment picker.',
    industries: [healthAndWellness],
    siteTypes: [business],
    aliases: ['veterinarian', 'vet clinic', 'animal hospital', 'pet care', 'fear-free vet'],
  },
  'coastal-rentals': {
    name: 'Marea · Coastal Stays',
    description: 'An image-led accommodation site for independent hosts, with multiple stays, guest services, about and contact pages.',
    industries: [travelHospitality],
    siteTypes: [accommodation],
    aliases: ['coastal stays', 'holiday rental', 'short-term rental', 'vacation rental', 'guest house'],
  },
  'culinary-school': {
    name: 'Sorrel & Stone · Culinary School',
    description: 'A five-page culinary, pastry, sourdough and botanical fermentation workshop school website with interactive curriculum tabs, workshop carousel, cohort calendar, studio gallery, instructor profiles and seat inquiry flow.',
    industries: [educationAndLearning, foodAndDrink],
    siteTypes: [education, business],
    aliases: ['cooking school', 'culinary workshop', 'baking classes', 'fermentation workshop', 'course provider'],
  },
  'dental-clinic-a2': {
    name: 'Linden Dental · Dental Clinic',
    description: 'A four-page dental practice website with treatment information, team profiles and enquiries.',
    industries: [healthAndWellness],
    siteTypes: [business],
    aliases: ['dentist', 'dental practice', 'family dentistry'],
  },
  'devon-park': {
    name: 'Devon Park · Systems Engineer',
    description: 'Swiss grid single-page portfolio and CV for an independent distributed systems engineer, featuring a desktop sticky identity sidebar, impact metrics, tag-filtered systems work, copyable benchmark code block, chronological career spine, and inquiry form.',
    industries: [professionalServices],
    siteTypes: [portfolio],
    aliases: ['software engineer', 'resume', 'cv', 'developer portfolio', 'personal site', 'systems engineer'],
  },
  'fieldwork-radio': {
    name: 'Fieldwork Radio · Podcast & Live Show',
    description: 'Broadsheet single-page site for an investigative audio documentary series featuring an inline playable episode player, tag-filtered audio archive, host byline strip, ruled live tour table, and tip-line intake.',
    industries: [educationAndLearning],
    siteTypes: [portfolio, business],
    aliases: ['podcast', 'audio documentary', 'radio show', 'investigative journalism', 'media show'],
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
  'kairn-climbing': {
    name: 'Kairn Climbing · Bouldering Gym',
    description: 'Single-page bouldering and strength gym landing site featuring an edge-to-edge split hero, kinetic grade marquee, steep wall zone breakdowns, ruled drop-in ledger, and horizontal waiver booking form.',
    industries: [healthAndWellness],
    siteTypes: [business],
    aliases: ['climbing gym', 'bouldering', 'fitness studio', 'athletic training', 'sports facility'],
  },
  'kestrel-cargo': {
    name: 'KESTREL · Electric Cargo Mobility',
    description: 'Four-page electric utility cargo bike and municipal fleet site featuring a floating header over a 70vh full-bleed studio K-02 hero with docked telemetry bar, standardized 44vh inner-page engineering headers, pixel-aligned exterior-to-X-Ray compare scrubber, dyno progress & CAN-Bus code bento cards, 3 hardware macro cards, interactive hotspot diagram, structured trim configurator tabs, horizontal certification timeline, 6-hub depot network cards, and fleet demo form.',
    industries: [architectureDesign],
    siteTypes: [business],
    aliases: ['electric cargo bike', 'ev fleet', 'urban mobility', 'last-mile logistics', 'industrial design'],
  },
  'maren-and-tomas': {
    name: 'Maren & Tomás · Destination Wedding',
    description: 'Single-page destination wedding invitation with centered monogram header, double-bordered linen poster hero, live countdown widget, vertical weekend itinerary spine, travel & venue map, and interactive RSVP form.',
    industries: [travelHospitality],
    siteTypes: [portfolio],
    aliases: ['wedding', 'destination wedding', 'wedding invitation', 'event invitation', 'rsvp'],
  },
  'masuda-optical': {
    name: 'MASUDA / 04 · Titanium Eyewear',
    description: 'Four-page Sabae titanium eyewear and clinical optometry site featuring a floating header over a 1240px four-tile editorial bento hero, interactive chassis anatomy hotspots, native expanding photo strips (strips), pixel-aligned M-09 exterior-to-CAD optical compare workbench, 4-step corneal fitting progress bars, deep slate metallurgy monograph with ruled specification rows, filterable 6-model orthographic catalog, millimeter sizing table, native clinical stage switcher (switcher), high-index lens slider, and Sabae milling film lightbox.',
    industries: [healthAndWellness, architectureDesign],
    siteTypes: [business, portfolio],
    aliases: ['eyewear', 'optometry', 'optical boutique', 'titanium frames', 'glasses'],
  },
  'mercer-quinn': {
    name: 'MERCER QUINN · Patent & AI Litigation',
    description: 'Four-page intellectual property, Federal Circuit, and AI systems trial law practice featuring a floating header over a 100dvh architectural dossier frame, practice discipline tabs, playable oral argument audio briefing, ruled precedent ledger, and conflict check intake.',
    industries: [professionalServices],
    siteTypes: [business],
    aliases: ['law firm', 'patent litigation', 'ai law', 'trial counsel', 'legal practice'],
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
  'soraia-thermal': {
    name: 'SORAIA · Thermal Bathhouse',
    description: 'Four-page volcanic basalt bathhouse and thermal reserve featuring a floating header over a 100dvh obsidian water sanctuary with inline video lightbox trigger, four-stage contrast circuit, hydro-acoustic audio player, live silence window countdown, and soak reservation flow.',
    industries: [healthAndWellness, travelHospitality],
    siteTypes: [business],
    aliases: ['bathhouse', 'thermal spa', 'sauna', 'hot springs', 'wellness sanctuary'],
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
