# Customizing Sorrel & Stone (`culinary-school@1.0.0`)

## Overview
**Sorrel & Stone** is a 5-page native Pagecraft site template designed for culinary schools, artisan bakeries, fermentation studios, and hands-on workshop providers. Every layout, token, component, tab panel, carousel, gallery, table, accordion, and form is authored with `customCssPolicy: "native-only"`—meaning zero custom CSS or raw HTML overrides are required to edit the site in Pagecraft Cloud or WordPress.

## Global Brand Tokens
Open **Design → Colors** and **Design → Typography** in the Pagecraft editor to customize the brand identity sitewide:
- **Typography**:
  - Headings (`display`, `title`, `subtitle`): **Fraunces** (`600`)
  - Body & UI (`lead`, `body`, `small`, `eyebrow`, `btn`): **Karla** (`400` / `700`)
- **Color Palette** (*Emerald & Porcelain*):
  - `bg` (Porcelain paper): `#FFFFFF`
  - `surface` (Porcelain mint): `#F2FAF6`
  - `sand` (Warm flour): `#F6F3EC`
  - `ink` (Deep sorrel pine): `#14332B`
  - `text` (Herb slate): `#26453C`
  - `brand` (Emerald kitchen): `#0A6C57`
  - `accent` (Celadon leaf): `#A7DAC5`
  - `muted` (Secondary caption): `#415E55`
  - `muted-i` (Light text on dark): `#E6F4EE`
  - `line` (Bench rule): `#C5DDD3`

## Reusable Component (`sorrel-workshop-card`)
The workshop cards in the **Home** carousel (`featured-workshops`) and the **Calendar** 2×2 grid (`calendar-cards`) are instances of the shared **`Workshop bench card`** (`sorrel-workshop-card`) component:
- Edit the component definition once to update card padding, border radius, or typography across all instances.
- Select any individual card instance to override its exposed properties:
  - `Workshop title` (`title`)
  - `Schedule & capacity` (`meta`)
  - `Description` (`summary`)
  - `Tuition & take-home kit` (`tuition`)
  - `Workshop photo` (`image`) & `Image description` (`alt`)
  - `Syllabus link` (`destination`)

## Interactive Widgets
- **Curriculum Explorer (`tabs`)**: On the Home page, select the `Tabs` widget and click any tab (`Sourdough & Grain`, `Laminated Pastry`, `Botanical Fermentation`, `Seasonal Kitchen`) to edit its native `Box` panel children, icons, copy, and photograph directly on the canvas.
- **Featured Workshops (`slider`)**: Navigate slides directly inside the editor to inspect or edit later workshop cards.
- **Teaching Rooms (`gallery`)**: 3-column lightbox gallery with editable image tiles, alt text, and captions.
- **Comparison & Cohort Tables (`table`)**: Pipe-delimited native tables on `workshops.html` and `calendar.html`, paired with individually editable destination links directly below each table.
- **Seat Request Form (`form`)**: Located at `contact.html#inquiry`. When published on **Pagecraft Cloud**, leaving the form action blank routes submissions to the site's managed Submissions inbox. For **WordPress** or standalone static exports, paste your verified `https://` form receiver URL into the Form inspector before accepting live student inquiries.
