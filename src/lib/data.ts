export type Project = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  year: string;
  highlights?: string[];
};

export type SkillGroup = {
  category: string;
  items: string[];
};

export type Certification = {
  title: string;
  issuer: string;
  date: string;
  url?: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  premise: string;
  tags: string[];
  status: "draft" | "published";
  date: string;
};

export const profile = {
  name: "Mrigank Shekhar",
  role: "IMBA Candidate, IE Business School",
  tagline:
    "Bridging telecom operations, founder-level AI product work, and supply chain strategy.",
  location: "Madrid, Spain",
  email: "mrigankshekhar9@gmail.com",
  summary:
    "IMBA student at IE Business School Madrid (Strategy concentration, graduating December 2026). Roughly four years at Ericsson in data and network operations before the MBA, followed by a climb from the field to Area Sales Manager at Rewa Polymers — where I also founded the company's sustainability and green procurement function. Most recently CTO of Vigniance, an industrial AI startup building predictive maintenance for manufacturing. Now specializing in Supply Chain Management, Procurement, and Operations, and targeting roles across Europe.",
  about: [
    "I've spent my career moving between operating a business and building the systems that run it: four years inside Ericsson's data and network operations, a sales and sustainability leadership track at a polymers manufacturer, and a stint as CTO of an industrial AI startup building predictive maintenance for factories.",
    "The IMBA at IE is where those threads come together — I'm specializing in Supply Chain Management and Procurement, treating an MBA cohort of 100+ classmates as a live systems and network-operations problem, and building automation on the side because I'd rather script the boring parts than repeat them.",
    "Currently looking at Supply Chain, Procurement, and Operations roles across Europe.",
  ],
};

export const projects: Project[] = [
  {
    slug: "jobradar",
    title: "JobRadar (Jobbie)",
    subtitle: "Job Search Automation and Networking OS",
    description:
      "A personal job-search automation system built to treat the MBA job hunt like an operations problem. Integrates Supabase, Google Sheets, and the IE Talent & Careers newsletter pipeline behind a relational schema for People, Companies, Jobs, and Interactions. Runs batched cohort LinkedIn lookups, automated ATS gap analysis against target roles, and auto-generated outreach emails.",
    tags: ["Supabase", "Automation", "Job Search", "LinkedIn"],
    year: "2026",
    highlights: [
      "Relational schema for People / Companies / Jobs / Interactions",
      "Batched cohort LinkedIn lookups",
      "Automated ATS gap analysis",
      "Auto-generated outreach emails",
    ],
  },
  {
    slug: "mastercard-agentic-commerce",
    title: "Mastercard Agentic Commerce Business Impact Lab",
    subtitle: "Agentic commerce strategy for Spanish food delivery",
    description:
      "A multi-week strategy project exploring what agentic commerce means for food delivery in Spain. Built an Excel financial model with a custom Reality-Check stress-test methodology, and narrowed a use-case funnel from 24 candidates to 12 to a final 4: Smart Reordering, Employee Meal Benefits, Conference Catering, and Airport Arrival Meal. Delivered as a multi-slide PowerPoint built with pptxgenjs, complete with presenter scripts, video pitch concepts, and infographic banners.",
    tags: ["Strategy", "Financial Modeling", "Agentic Commerce", "pptxgenjs"],
    year: "2026",
    highlights: [
      "Custom Reality-Check stress-test methodology",
      "Use-case funnel: 24 → 12 → 4",
      "Multi-slide deck generated programmatically with pptxgenjs",
    ],
  },
  {
    slug: "coursera-techwolf",
    title: "Innovation Scouting — Coursera / TechWolf",
    subtitle: "CVC investment recommendation",
    description:
      "An investment-scouting project recommending a $45M corporate venture capital investment by Coursera into TechWolf. Scored 9.3/10 by course evaluators.",
    tags: ["Investment Scouting", "CVC", "Due Diligence"],
    year: "2025",
  },
  {
    slug: "automation-stack",
    title: "Personal Automation Stack",
    subtitle: "53 skills across GitHub projects",
    description:
      "An ecosystem of 53 skills spanning JobRadar, RahuFeed, sc-community, and OrgPulse, wired together with the Claude API, Make.com, Apify, Google Apps Script, and Todoist. Includes a WhatsApp classmate-networking shortcut via Claude in Chrome, a Make.com + Telegram + Todoist daily task system, a Google Apps Script sync between Todoist and Google Calendar, a Telegram bot + Make.com pipeline for automated DCF analysis, and a Chrome extension syncing 12twenty career portal data to OneDrive.",
    tags: ["Claude API", "Make.com", "Apify", "Google Apps Script"],
    year: "2026",
    highlights: [
      "WhatsApp classmate-networking shortcut via Claude in Chrome",
      "Make.com + Telegram + Todoist daily task system",
      "Todoist ↔ Google Calendar sync via Apps Script",
      "Telegram bot pipeline for automated DCF analysis",
      "Chrome extension syncing 12twenty data to OneDrive",
    ],
  },
  {
    slug: "world-cup-social-app",
    title: "World Cup Social App",
    subtitle: "For the IE cohort",
    description: "A social app built for organizing World Cup viewing and team pairing across the IE cohort.",
    tags: ["Side Project"],
    year: "2026",
  },
  {
    slug: "franchise-growth-memo",
    title: "Franchise Growth Strategy Memo",
    subtitle: "For an Ed-admin CEO",
    description: "A franchise growth strategy memo prepared for the CEO of an education-administration company.",
    tags: ["Strategy Memo"],
    year: "2025",
  },
  {
    slug: "supply-chain-simulation",
    title: "Supply Chain Simulation Report",
    subtitle: "Coursework",
    description: "A supply chain simulation report examining what the numbers do and don't tell you about operational decisions.",
    tags: ["Supply Chain", "Coursework"],
    year: "2025",
  },
];

export const skillGroups: SkillGroup[] = [
  {
    category: "Strategy & Analysis",
    items: [
      "Go-to-market strategy",
      "Competitive & market analysis",
      "Case-method problem solving",
      "Financial modeling (DCF, reverse-DCF)",
      "Investment scouting",
      "Financial reporting analysis",
      "Supply chain & procurement analysis",
      "Green / sustainable procurement",
    ],
  },
  {
    category: "Technical & Automation",
    items: [
      "Make.com",
      "Google Apps Script",
      "Apify",
      "Claude API integration",
      "Prompt & agent design",
      "Supabase",
      "Todoist",
      "Google Sheets / Calendar",
      "pptxgenjs",
    ],
  },
  {
    category: "Leadership & Operations",
    items: [
      "Sales management & team leadership",
      "Startup CTO leadership",
      "Cross-functional coordination in telecom ops",
    ],
  },
];

export const currentlyLearning: string[] = [
  "Value investing and financial modeling",
  "AI tooling ecosystems and agentic commerce",
  "Procurement / SCM market intelligence",
  "Personal knowledge management systems",
  "European travel and cross-cultural business context",
];

// No certifications provided yet — add entries here as they're earned.
export const certifications: Certification[] = [];

export const blogPosts: BlogPost[] = [
  {
    slug: "building-jobradar",
    title: "Building JobRadar",
    premise: "Designing a relational data model for systematic job hunting.",
    tags: ["JobRadar", "Automation"],
    status: "draft",
    date: "2026",
  },
  {
    slug: "agentic-commerce-food-delivery",
    title: "What Agentic Commerce Means for Food Delivery in Spain",
    premise: "Notes from the Mastercard Business Impact Lab on where agents actually change the unit economics.",
    tags: ["Agentic Commerce", "Strategy"],
    status: "draft",
    date: "2026",
  },
  {
    slug: "telecom-ops-to-procurement",
    title: "From Telecom Ops to Procurement Strategy",
    premise: "What four years of network operations at Ericsson actually transfers to supply chain strategy.",
    tags: ["Career", "Supply Chain"],
    status: "draft",
    date: "2026",
  },
  {
    slug: "founding-sustainability-function",
    title: "Founding a Sustainability Function Inside a Traditional Manufacturer",
    premise: "How a green procurement function got built from scratch at Rewa Polymers, and what stuck.",
    tags: ["Sustainability", "Procurement"],
    status: "draft",
    date: "2026",
  },
  {
    slug: "startup-cto-during-mba",
    title: "Being a Startup CTO While Doing an MBA",
    premise: "Running Vigniance's technical side alongside a full-time IMBA course load.",
    tags: ["Startups", "MBA"],
    status: "draft",
    date: "2026",
  },
  {
    slug: "automating-the-mba",
    title: "Automating the Boring Parts of an MBA",
    premise: "The Make.com, Todoist, and Apps Script scaffolding that runs quietly in the background of a cohort of 100+.",
    tags: ["Automation", "MBA"],
    status: "draft",
    date: "2026",
  },
  {
    slug: "evaluating-a-45m-cvc-bet",
    title: "Evaluating a $45M CVC Bet",
    premise: "Breaking down the Coursera–TechWolf investment scouting case and how the recommendation was built.",
    tags: ["Investment Scouting", "CVC"],
    status: "draft",
    date: "2026",
  },
  {
    slug: "what-supply-chain-simulations-dont-tell-you",
    title: "Supply Chain Simulations — What the Numbers Don't Tell You",
    premise: "Where simulation coursework lines up with reality, and where it quietly doesn't.",
    tags: ["Supply Chain", "Coursework"],
    status: "draft",
    date: "2026",
  },
];
