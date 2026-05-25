export interface BuildTemplate {
  id: string;
  name: string;
  description: string;
  emoji: string;
  prompt: string;
  thumbnail_url?: string | null;
  preview_url?: string | null;
}

export const BUILD_TEMPLATES: BuildTemplate[] = [
  {
    id: "landing",
    name: "Product landing page",
    description: "Hero + Features + pricing + CTA",
    emoji: "🚀",
    prompt: "Build a professional landing page (Landing Page) for a product SaaS modern. Contains: Hero with a big headline and button CTA, Features section with 3 cards, How-it-works section with 3 steps, Pricing section with 3 plans, Section FAQ, Footer simple. Sleek dark design with purple gradients/blue and modern graphics.",
  },
  {
    id: "portfolio",
    name: "Personal portfolio",
    description: "Single page for a designer/developer",
    emoji: "🎨",
    prompt: "Build Personal portfolio Single page for a graphic designer. Contains: Hero with my name and photo, Section About with skills, Work gallery (Grid of 6 Images), Section Testimonials, Contact form, links social. Minimal white design with elegant typography.",
  },
  {
    id: "blog",
    name: "Personal blog",
    description: "Article list page with clean design",
    emoji: "📝",
    prompt: "Build Personal blog clean. Contains: Header with navigation, Section Featured Article large, grid of 6 articles with images, date, and reading time, Sidebar with categories and tags, Footer simple. Fonts Serif elegant on a white background.",
  },
  {
    id: "ecommerce",
    name: "E-commerce store",
    description: "Page View products with cart",
    emoji: "🛍",
    prompt: "Build a page E-commerce store for handmade products. Contains: Header with logo and cart icon, Hero with featured product, grid of 8 products with images, prices, and a button Add to Cart, side filters (price/category), Footer with payment methods. Warm colors (beige/orange).",
  },
  {
    id: "restaurant",
    name: "Restaurant site",
    description: "Menu + Table booking",
    emoji: "🍽",
    prompt: "Build an Italian restaurant site. Contains: Hero with an image of a tasty dish, Section About, Menu split (appetizers/main dishes/desserts) with images and prices, Section Table booking with form, site map and business hours, gallery for the restaurant. Warm colors (red/cream/gold).",
  },
  {
    id: "agency",
    name: "Agency site",
    description: "Professional services company page",
    emoji: "🏢",
    prompt: "Build a digital marketing agency site. Contains: Hero with elegant motion, Services section with 6 cards, client logos (logos marquee), Section case studies (3 Projects), Team section, Contact form, Footer comprehensive. Professional dark design with neon touches.",
  },
  {
    id: "saas-dashboard",
    name: "Dashboard SaaS",
    description: "Dashboard analytics with modern design",
    emoji: "📊",
    prompt: "Build a dashboard analytics for app SaaS. containing: Sidebar Navigation, Header search and notifications, 4 stat cards top, large line chart (Use SVG), table of latest transactions, Section top customers. Clean design with Tailwind, supports Dark mode.",
  },
  {
    id: "event",
    name: "Event/conference page",
    description: "Landing For an event with schedule and booking",
    emoji: "🎤",
    prompt: "Build a page for a conference tech. Contains: Hero with date the conference and registration button, Countdown timer, Speakers section (6 cards with images), Session schedule, Sponsors, Ticket prices, Venue map. Bold design with vivid gradients.",
  },
];
