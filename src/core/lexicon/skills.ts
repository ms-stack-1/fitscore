/*
 * Skill lexicon for the rule-based engine.
 *
 * Format: one string per skill, "Canonical name|alias|alias". Aliases match
 * case-insensitively on word boundaries that respect symbols (C++, C#, .NET).
 *   cs:Term   matches case-sensitively ("Slack" the tool, not "pick up slack")
 *   re:Regex  a case-sensitive pattern ("Excel" but not "excel in a team")
 * A skill the candidate lacks is as useful as one they have: it lets the rule
 * engine report a gap instead of silently ignoring the requirement.
 *
 * Deliberately excluded: bare words that are mostly plain English ("Go", "C",
 * "Make", "Lever"). "R" the language is a special case below.
 */

import { termRegex } from "../text";

export interface Skill {
  id: string;
  name: string;
  group: string;
  aliases: string[];
  matchers: RegExp[];
}

const GROUPS: Record<string, string[]> = {
  "Paid media": [
    "Google Ads|AdWords|Google AdWords|Google Search Ads",
    "Meta Ads|Facebook Ads|Instagram Ads|Meta Ads Manager|Facebook Ads Manager|Meta Business Suite",
    "LinkedIn Ads|LinkedIn Campaign Manager|LinkedIn advertising",
    "Microsoft Ads|Bing Ads|Microsoft Advertising",
    "TikTok Ads|TikTok advertising|TikTok Ads Manager",
    "Snapchat Ads",
    "Pinterest Ads",
    "Reddit Ads",
    "X Ads|Twitter Ads",
    "Amazon Ads|Amazon Advertising|Amazon PPC|Sponsored Products",
    "Apple Search Ads",
    "YouTube Ads|YouTube advertising",
    "Google Display Network|GDN|display advertising|display ads",
    "Google Shopping|Shopping campaigns|Performance Max|PMax",
    "Programmatic|programmatic advertising|programmatic buying",
    "DSP|demand-side platform|The Trade Desk|DV360|Display & Video 360",
    "Google Ad Manager|DFP|DoubleClick",
    "CTV|connected TV|OTT advertising",
    "Retail media|Walmart Connect|Roundel|Criteo",
    "Paid search|PPC|pay-per-click|SEM|search engine marketing",
    "Paid social|social advertising|social ads",
    "Retargeting|remarketing",
    "Bid management|bid optimization|bidding strategies|bid strategy",
    "Budget pacing|budget management|media budget",
    "Media buying|media planning|media plan",
    "Affiliate marketing|affiliate programs|Impact.com|partnerships marketing",
    "Influencer marketing|creator marketing|influencer campaigns",
    "ROAS|return on ad spend",
    "CAC|customer acquisition cost|CPA|cost per acquisition",
    "LTV|CLV|customer lifetime value",
  ],
  "SEO & content": [
    "SEO|search engine optimization|search engine optimisation",
    "Technical SEO",
    "Keyword research",
    "Link building|backlinks",
    "Local SEO|Google Business Profile",
    "Google Search Console|Search Console",
    "SEMrush|Semrush",
    "Ahrefs",
    "cs:Moz",
    "Screaming Frog",
    "Content strategy|content marketing",
    "Copywriting|copy writing|ad copy",
    "Editorial calendar|content calendar",
    "Blogging|blog writing|long-form content",
    "Technical writing|documentation writing",
    "Video production|video editing",
    "Social media management|social media marketing|community management|organic social",
    "Hootsuite",
    "Sprout Social",
    "Buffer app",
    "Canva",
  ],
  "Analytics & BI": [
    "Google Analytics|GA4|Google Analytics 4|Universal Analytics",
    "Google Tag Manager|re:GTM(?!\\s+(?:strategy|motion|plan|launch|team))",
    "Adobe Analytics|Omniture",
    "Mixpanel",
    "Amplitude",
    "Heap Analytics|cs:Heap",
    "Hotjar",
    "Looker|LookML",
    "Looker Studio|Google Data Studio|Data Studio",
    "Tableau",
    "Power BI|PowerBI",
    "Qlik|QlikView|Qlik Sense",
    "Metabase",
    "Microsoft Excel|MS Excel|Advanced Excel|re:Excel(?!\\s+(?:in|at|as|with|under|when))|spreadsheets|pivot tables|VLOOKUP|XLOOKUP",
    "Google Sheets",
    "A/B testing|AB testing|split testing|A/B tests|multivariate testing|experimentation|experiment design",
    "CRO|conversion rate optimization|conversion rate optimisation",
    "Attribution|attribution modeling|attribution modelling|multi-touch attribution|MTA",
    "Marketing mix modeling|MMM|media mix modeling",
    "Incrementality|incrementality testing|lift testing|geo-lift",
    "Conversion tracking|conversion API|CAPI|server-side tagging",
    "UTM|UTM parameters|UTM tracking",
    "Cohort analysis|cohorts",
    "Funnel analysis|funnel optimization|funnel metrics",
    "KPI reporting|KPI dashboards|dashboards|reporting dashboards",
    "Forecasting|demand forecasting|forecast models",
    "Statistics|statistical analysis|hypothesis testing|regression analysis",
    "Segmentation|audience segmentation|customer segmentation",
  ],
  "Data & ML": [
    "SQL|MySQL|PostgreSQL|Postgres|T-SQL|PL/SQL|SQL Server|SQLite",
    "BigQuery|Google BigQuery",
    "Snowflake",
    "Redshift|Amazon Redshift",
    "Databricks",
    "dbt|data build tool",
    "Airflow|Apache Airflow",
    "Spark|Apache Spark|PySpark",
    "Hadoop",
    "Kafka|Apache Kafka",
    "ETL|ELT|data pipelines",
    "Data modeling|data modelling|dimensional modeling|star schema",
    "Data warehousing|data warehouse",
    "pandas",
    "NumPy",
    "scikit-learn|sklearn",
    "TensorFlow",
    "PyTorch",
    "Machine learning|ML models|predictive modeling|predictive modelling",
    "Deep learning|neural networks",
    "NLP|natural language processing",
    "Computer vision",
    "MLOps",
    "Data visualization|data visualisation",
    "Data governance|data quality",
    "Segment CDP|Twilio Segment|Segment.io",
    "CDP|customer data platform|mParticle|RudderStack",
    "Fivetran|Stitch|Airbyte",
    "Jupyter|Jupyter notebooks",
    "SAS",
    "SPSS",
    "Stata",
    "MATLAB",
  ],
  "Programming": [
    "Python",
    "JavaScript|JS|ECMAScript",
    "TypeScript",
    "Java",
    "C#|.NET|dotnet|ASP.NET",
    "C++",
    "Golang|Go language",
    "Rust",
    "Ruby|Ruby on Rails|Rails",
    "PHP|Laravel",
    "Kotlin",
    "Swift|SwiftUI",
    "Scala",
    "Bash|shell scripting|shell scripts",
    "PowerShell",
    "VBA|Excel macros",
    "Google Apps Script|Apps Script",
    "R",
    "Git|GitHub|GitLab|Bitbucket|version control",
    "REST APIs|REST API|RESTful|API integration|API integrations|APIs",
    "GraphQL",
    "Webhooks",
    "Microservices",
    "Unit testing|test automation|TDD",
    "Agile|Scrum|Kanban|SDLC",
  ],
  "Web & frontend": [
    "HTML|HTML5",
    "CSS|CSS3|Sass|SCSS|Tailwind",
    "React|cs:React|React.js|ReactJS|React Native",
    "Next.js|NextJS",
    "Vue|Vue.js",
    "Angular",
    "Svelte",
    "Node.js|NodeJS|Express.js",
    "Django",
    "Flask",
    "FastAPI",
    "Spring Boot|Spring Framework",
    "WordPress",
    "Shopify|Shopify Plus",
    "Magento|Adobe Commerce",
    "WooCommerce",
    "BigCommerce",
    "Webflow",
    "Wix",
    "Squarespace",
    "Contentful|headless CMS",
    "Responsive design|mobile-first",
    "Web accessibility|WCAG|a11y",
    "Page speed|Core Web Vitals|site performance",
    "E-commerce|ecommerce|online store|D2C|DTC|direct-to-consumer",
  ],
  "Cloud & DevOps": [
    "AWS|Amazon Web Services|EC2|S3|Lambda",
    "Azure|Microsoft Azure",
    "GCP|Google Cloud|Google Cloud Platform",
    "Cloudflare|Cloudflare Workers",
    "Docker|containers",
    "Kubernetes|K8s",
    "Terraform|infrastructure as code",
    "CI/CD|continuous integration|GitHub Actions|Jenkins|CircleCI",
    "Linux|Unix",
    "Serverless",
    "Vercel|Netlify",
    "Firebase",
    "Supabase",
    "MongoDB",
    "Redis",
    "Elasticsearch",
    "DynamoDB",
  ],
  "CRM & martech": [
    "HubSpot|HubSpot Marketing Hub|HubSpot CRM",
    "Salesforce|SFDC|Salesforce CRM|Sales Cloud",
    "Salesforce Marketing Cloud|Marketing Cloud|ExactTarget",
    "Marketo|Adobe Marketo",
    "Pardot|Account Engagement",
    "Eloqua|Oracle Eloqua",
    "Klaviyo",
    "Mailchimp|MailChimp",
    "Braze",
    "Iterable",
    "Customer.io",
    "ActiveCampaign",
    "Intercom",
    "Zendesk",
    "Pipedrive",
    "Zoho|Zoho CRM",
    "Microsoft Dynamics|Dynamics 365",
    "Email marketing|email campaigns|email automation|newsletters",
    "Marketing automation|automated workflows|nurture flows",
    "Lifecycle marketing|lifecycle campaigns|retention marketing|CRM marketing",
    "Lead scoring",
    "Lead generation|lead gen|demand generation|demand gen",
    "Lead nurturing|nurture campaigns",
    "MQL|SQL handoff|MQL/SQL|marketing qualified leads",
    "ABM|account-based marketing",
    "SMS marketing|push notifications",
    "Zapier",
    "Make.com|Integromat|cs:Make (Integromat)",
    "n8n",
    "Airtable",
    "cs:Notion",
    "cs:Slack",
  ],
  "AI": [
    "Claude API|Anthropic API|Claude",
    "OpenAI API|ChatGPT|GPT-4|GPT API",
    "Gemini|Google Gemini",
    "LLMs|large language models|LLM",
    "Prompt engineering|prompt design",
    "Generative AI|GenAI|gen AI",
    "AI agents|agentic workflows|autonomous agents",
    "RAG|retrieval-augmented generation|vector databases|vector database|embeddings",
    "LangChain|LlamaIndex",
    "Hugging Face",
    "Fine-tuning|model fine-tuning",
    "Structured output|JSON schema|schema validation",
    "AI automation|AI workflows|AI-powered workflows",
    "Copilot|GitHub Copilot|Microsoft Copilot",
    "Claude Code|Cursor AI|cs:Cursor",
    "MCP|Model Context Protocol",
  ],
  "Design & creative": [
    "Figma",
    "Sketch app|cs:Sketch",
    "Adobe Photoshop|Photoshop",
    "Adobe Illustrator|Illustrator",
    "Adobe InDesign|InDesign",
    "Adobe Premiere Pro|Premiere Pro|Premiere",
    "Adobe After Effects|After Effects",
    "Adobe Creative Suite|Adobe Creative Cloud|Adobe CC",
    "Final Cut Pro",
    "DaVinci Resolve",
    "UX design|user experience design|UX research|user research",
    "UI design|user interface design",
    "Wireframing|prototyping",
    "Design systems|design system",
    "Brand identity|branding|brand guidelines|brand strategy",
    "Graphic design",
    "Motion graphics|animation",
    "Photography|product photography",
    "Creative direction|art direction",
  ],
  "Product & project": [
    "Product management|product manager|product roadmap",
    "Product marketing|go-to-market|GTM strategy|positioning and messaging",
    "Project management|PMP|program management",
    "Jira",
    "Confluence",
    "Asana",
    "Trello",
    "Monday.com",
    "ClickUp",
    "Smartsheet",
    "MS Project|Microsoft Project",
    "OKRs",
    "Roadmapping|roadmaps",
    "Requirements gathering|business requirements|user stories|acceptance criteria",
    "Process mapping|process improvement|workflow design|BPMN",
    "Lean Six Sigma|Six Sigma|Lean methodology",
    "Change management",
    "Stakeholder management|stakeholder communication|stakeholder reporting",
    "Vendor management|agency management",
    "Market research|competitive analysis|customer research",
    "Pricing strategy|pricing analysis|pricing decisions",
  ],
  "Sales & success": [
    "B2B sales|enterprise sales|SaaS sales",
    "Account management|key account management|client management",
    "Business development|new business",
    "Customer success|client success",
    "Cold outreach|prospecting|outbound",
    "Negotiation",
    "Sales enablement",
    "Salesloft|Outreach.io",
    "Gong",
    "LinkedIn Sales Navigator|Sales Navigator",
    "Apollo.io|ZoomInfo",
    "Quota attainment|quota",
    "Pipeline management|sales pipeline",
    "Customer onboarding|client onboarding",
  ],
  "Finance & ops": [
    "Financial modeling|financial modelling",
    "Budgeting|budget planning",
    "FP&A|financial planning and analysis",
    "P&L|P&L management|profit and loss",
    "Accounting|bookkeeping|GAAP|IFRS",
    "QuickBooks",
    "Xero",
    "NetSuite",
    "SAP",
    "Oracle ERP|Oracle Financials",
    "Workday",
    "Reconciliation|bank reconciliation|account reconciliation",
    "Inventory management|inventory planning|supply planning",
    "Supply chain|logistics management|procurement",
    "Operations management",
    "Payroll",
  ],
  "People": [
    "Recruiting|recruitment|talent acquisition|sourcing candidates",
    "ATS|applicant tracking system|Greenhouse|cs:Lever|cs:Workable",
    "HRIS|BambooHR",
    "Employee onboarding",
    "Performance management",
    "Team leadership|team management|people management|managed a team|led a team",
    "Mentoring|coaching",
    "Team hiring|hired|hiring and developing|hiring and managing|hire and develop|recruited and hired",
    "Training and development|training programs|end-user training",
    "Cross-functional collaboration|cross-functional teams",
    "Public speaking|presentations|presenting",
  ],
  "Languages": [
    "English",
    "Spanish",
    "French",
    "German",
    "Arabic",
    "Mandarin|Chinese",
    "Hindi",
    "Urdu",
    "Portuguese",
    "Japanese",
    "Bilingual",
  ],
};

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/\+/g, "p")
    .replace(/#/g, "sharp")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** "R" the language: only as a listed tool, never the letter. */
const R_PATTERNS = [
  /(?<![A-Za-z&'.])R(?=\s*[,/;)]|\s+(?:programming|language|Studio|and Python|or Python))/,
  /(?<=[,(/]\s?)R(?![A-Za-z&'.])/,
  /\bRStudio\b/,
];

export function aliasMatcher(alias: string): RegExp {
  if (alias.startsWith("re:")) return new RegExp(`(?<![A-Za-z0-9])(?:${alias.slice(3)})(?![A-Za-z0-9])`);
  if (alias.startsWith("cs:")) return termRegex(alias.slice(3), "");
  return termRegex(alias, "i");
}

/** Split on "|" except inside parentheses, so re: aliases can use alternation. */
function splitAliases(entry: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of entry) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "|" && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export const SKILLS: Skill[] = Object.entries(GROUPS).flatMap(([group, entries]) =>
  entries.map((entry) => {
    const [first, ...rest] = splitAliases(entry) as [string, ...string[]];
    const name = first.replace(/^(?:cs|re):/, "");
    // A canonical name that is also listed as cs: must not match case-insensitively.
    const aliases = rest.includes(`cs:${name}`) ? rest : [first, ...rest];
    const matchers = name === "R" ? R_PATTERNS : aliases.map(aliasMatcher);
    return { id: slug(name), name, group, aliases, matchers };
  }),
);

export const SKILL_BY_ID: ReadonlyMap<string, Skill> = new Map(SKILLS.map((s) => [s.id, s]));

export interface SkillHit {
  skill: Skill;
  /** The exact matched substring, usable as a verbatim evidence quote. */
  text: string;
  index: number;
}

/** Every lexicon skill mentioned in the text, first mention each, in reading order. */
export function findSkills(text: string, skills: readonly Skill[] = SKILLS): SkillHit[] {
  const all: SkillHit[] = [];
  for (const skill of skills) {
    for (const re of skill.matchers) {
      const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      for (const m of text.matchAll(g)) all.push({ skill, text: m[0], index: m.index });
    }
  }
  // A mention wholly inside a longer mention of another skill belongs to the longer one:
  // "Looker" inside "Looker Studio", "Claude" inside "Claude Code".
  const kept = all.filter(
    (h) =>
      !all.some(
        (o) => o.skill !== h.skill && o.text.length > h.text.length && o.index <= h.index && o.index + o.text.length >= h.index + h.text.length,
      ),
  );
  kept.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  return kept.filter((h) => (seen.has(h.skill.id) ? false : (seen.add(h.skill.id), true)));
}
