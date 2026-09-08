---
name: website-traffic-checker
title: "Website Traffic Checker"
description: "Comprehensive website traffic analysis workflow. Use when the user asks to analyze a website's traffic, check competi..."
category: "Coding & Development"
image: "icon.svg"
icon: "icon.svg"
version: "2.5.0"
tags: ["automation", "checker", "coding", "myraa-skill", "traffic", "website"]
---

# Website Traffic Checker

# Website Traffic Checker

Use this skill to conduct a comprehensive analysis of a website's traffic, traffic sources, top-performing content, and keyword drivers. It integrates data from Similarweb, Ahrefs (via MCP), Semrush (via API), DataForSEO (via MCP), or the user's own uploaded data exports to provide a complete, narrative-driven picture of a site's performance.

## Critical First Step

**ALWAYS ask the user which data source to use (Similarweb, Ahrefs, Semrush, DataForSEO, or their own uploaded data) before gathering any data.** Do not assume or default to a source. See Phase 0 in Workflow Phases.

## Data Volume Constraints (MANDATORY)

These limits are MANDATORY and override any larger defaults:

1. **Traffic Overview Metrics AND the 12-Month Organic Traffic Trend MUST use global/worldwide traffic.** Both the headline overview metrics (Organic Traffic, Keywords Ranked) and the trend MUST represent global/worldwide organic traffic, never a single country (not US-only or any other region). For tools that only expose per-database (per-country) data such as Semrush, build the global figure by summing across all regional databases for the snapshot, and by summing the largest regional databases month-by-month for the trend (state the coverage, e.g., "top 12 markets representing ~X of total global desktop traffic"). For tools with a native worldwide scope (e.g., DataForSEO `location_name: "World"`, Ahrefs all-countries, Similarweb worldwide), use that scope directly. The trend line graph and MoM table must represent global organic traffic.
2. **Keyword analysis sample size is capped at 500 keywords.** When pulling ranked/organic keywords (branded vs non-branded, intent, top keywords, near-winners), request at most 500 keywords total. Do not exceed this limit.
3. **Page type / concentration / underperformer analysis is capped at 1,000 URLs.** When pulling top/landing pages for page-type efficiency, concentration, and underperforming-page analysis, request at most 1,000 URLs total.
4. **Geography Distribution analysis MUST use the top 2,000 URLs by traffic.** When inferring geographic/locale penetration from URL patterns (e.g., `/es/`, `/zh_CN/`), pull the top 2,000 URLs ranked by overall traffic (a separate, larger pull than the 1,000-URL page-type analysis) so the locale breakdown reflects the broadest possible footprint.

## Core Writing Principles

1. **Executive Narrative Format**: The Executive Narrative MUST be EXACTLY 2 paragraphs, each strictly capped at 150 words. Paragraph 1 covers growth trajectory, scale, dominant channel, engagement quality, and geographic footprint. Paragraph 2 covers the biggest structural risk/opportunity and the highest-ROI growth lever with specific data.
2. **Insight-First Sections**: Every section in the report MUST open with a **bolded insight sentence** that summarizes the finding in one line. Do not start sections with data points; start with the conclusion the data supports.
3. **Narrative-Driven Evidence**: Paragraphs must explain the "why" behind the finding, using data as evidence. Use comparative language (e.g., "3.4x more than", "25-450x less efficient").
4. **No Bullet-Point Dumps**: Do not write the report as a list of answers to questions. Use full sentences and paragraphs. The only permitted bulleted/numbered list is the final Summary of Findings.
5. **Compact Tables**: Tables must be compact (5-7 rows maximum). Do not dump raw data. Summarize, aggregate, or show the top 5 only.
6. **Inline Citations**: You MUST use inline citations (e.g., `[1]`, `[2]`) that reference specific data files in a "References" section at the end of the report.

## The Analytical Framework

Your analysis MUST cover these areas and perform these specific calculations:

### 1. Traffic Performance & Inflection Points
- **Traffic Overview Metrics**: Create a table showing Organic Traffic, Keywords Ranked, Total Visits, Unique Visitors, Bounce Rate, Channels, Device Split, and Referral Pathways. **Organic Traffic and Keywords Ranked MUST be global/worldwide figures (sum across all regional databases for per-country tools), never a single country.** Mark missing Similarweb data as "*Requires Similarweb*".
- **Traffic Overview Analysis Paragraph**: Below the metrics table, write a short 3-5 line paragraph that leads with the main finding and answers: (1) What is the dominant traffic channel and what does that mean for the business model? (2) Is the bounce rate high, low, or average relative to the industry (SaaS benchmark: 35-55%)? (3) What does the channel mix tell us about how the domain acquires users—organic, paid, social, direct, or referrals? Keep it simple, findings-first, no fluff.
- **12-Month MoM Trend**: Calculate the Month-over-Month percentage change. Identify growth phases, stagnation, or correction periods. This MUST be visualized as a line graph. **This trend MUST use global/worldwide organic traffic (never a single-country filter).** For per-country tools (e.g., Semrush), aggregate monthly history across the largest regional databases and disclose the coverage. Note that a single-country view can be misleading (e.g., a market may decline while the global aggregate grows).
- **Inflection Point Attribution**: You MUST attribute net traffic changes to specific pages. Create two tables: "Largest growth contributors" and "Largest loss contributors", showing the page, traffic change, and % share of the total gain/loss.
- **Net Assessment**: If the homepage dominates losses (branded normalization), calculate the net traffic change *excluding* the homepage to show the underlying health of the site.
- **Geography**: Show traffic by market using regional-database totals where available. If Similarweb is unavailable, also use URL locale patterns (e.g., `/es/`, `/zh_CN/`) to infer geographic penetration. **The locale/URL-pattern breakdown MUST be computed from the top 2,000 URLs by traffic** (a dedicated 2,000-URL pull), not the 1,000-URL page-type sample.

### 2. Keyword & Search Performance
*(Cap the keyword pull at a maximum of 500 keywords — see Data Volume & Cost Constraints.)*
- **Branded vs. Non-Branded Imbalance**: Show both the keyword count % AND the traffic % for branded vs. non-branded. Explain the efficiency gap (e.g., "Branded is 16% of keywords but 64% of traffic").
- **Intent Profile**: Categorize traffic by intent (Navigational, Informational, Commercial, Transactional). Explain what the dominant intent means for the user journey.
- **Near-Winner Keywords**: Identify high-volume keywords currently ranking in positions 11-20. Calculate the addressable search volume and explain why moving these to the top 10 is the highest ROI opportunity.

### 3. Landing Pages & Content Performance
*(Cap the page/URL pull at a maximum of 1,000 URLs — see Data Volume & Cost Constraints.)*
- **Page Type Efficiency**: Categorize pages (Homepage, Tools, Playbook, Blog, etc.). Calculate the "Avg. Traffic/Page" for each category to show which content type is most efficient.
- **Concentration Risk**: Calculate the cumulative traffic share for the Top 1, Top 2, Top 5, Top 20, and Remaining pages. Assess vulnerability to algorithm updates.
- **Underperforming Pages**: Identify pages that rank for hundreds/thousands of keywords but get minimal traffic. Calculate their "Efficiency" (Traffic / Keywords Ranked) and compare it to the top-performing page.

## Workflow Phases

0. **Phase 0: Confirm Data Source (MANDATORY FIRST STEP)**
   - Before gathering any data, MUST ask the user which data source to use: **Similarweb**, **Ahrefs** (via MCP), **Semrush** (via API), **DataForSEO** (via MCP), or the user's **own uploaded data**. Offer the option to combine multiple sources for a more complete report.
   - Briefly state what each source is best for so the user can choose: Similarweb for overall traffic volume, channel mix, geography, device split, and bounce rate; Ahrefs/Semrush/DataForSEO for organic traffic trends, top pages, keywords, intent, and competitors. DataForSEO Labs additionally provides position-bucket breakdowns (pos_1, pos_2_3, pos_4_10, pos_11_20, etc.) useful for near-winner analysis.
   - Always present the **upload your own data** option: the user can attach exports (CSV/XLSX) from Google Search Console, GA4, Ahrefs, Semrush, or any platform, and the skill will analyze those directly. This is the best path when the user has first-party data.
   - Before offering a connector-based source, check whether its connector is enabled with `manus-config config load --search <name>`. If a requested source's connector is disabled (e.g., DataForSEO, Ahrefs MCP), inform the user and offer to enable it via `manus-config config save` (which surfaces a confirmation card), or propose an available alternative.
   - DO NOT begin Phase 1 data gathering until the user confirms the source(s).

1. **Phase 1: Data Gathering & Aggregation**
   - Query Similarweb (via API) for total visits, unique visitors, bounce rate, geography, traffic channels, device split, and referral pathways.
   - Query Ahrefs/Semrush/DataForSEO for organic traffic trends, top pages, top keywords, and keyword intents. **Enforce the Data Volume Constraints: the Traffic Overview metrics and the 12-month organic traffic trend MUST be global/worldwide (no single-country figure — sum across regional databases for per-country tools); cap the keyword pull at 500 keywords; cap the page-type/concentration page pull at 1,000 URLs; and make a separate top-2,000-URL pull for the Geography locale analysis.**
   - If the user uploaded their own data, parse the provided files (CSV/XLSX) and map their columns to the required metrics; ask for clarification only if a critical field is missing or ambiguous.

2. **Phase 2: Data Analysis & Calculation**
   - Calculate MoM trends, inflection point attribution (% share of gains/losses), branded vs. non-branded imbalance, page type efficiency, cumulative concentration share, and underperforming page efficiency.

3. **Phase 3: Chart Generation**
   - Generate a line graph for the 12-month MoM organic traffic trend.
   - Generate bar/pie charts for content type distribution, branded split, and intent as needed.

4. **Phase 4: Synthesis & Reporting**
   - Write the final report strictly following `templates/report_template.md`.
   - Apply the Core Writing Principles (bolded insight sentences, inline citations, compact tables).

## Required Tools & Connectors

- **Similarweb**: Use the built-in `search` tool with `type=api` to query Similarweb for overall traffic stats.
- **Ahrefs**: Use the `manus-mcp-cli` if the Ahrefs MCP connector is enabled.
- **Semrush**: Use API requests if the user provides an API key or if configured in the environment.
- **DataForSEO**: Use the `manus-mcp-cli` with the DataForSEO MCP server if its connector is enabled. Best modules for traffic analysis: `DATAFORSEO_LABS` (domain rank overview, ranked keywords, competitors, top pages) and `DOMAIN_ANALYTICS` (technologies, Whois). Enable the connector first if disabled (see Phase 0).
- **User-uploaded data**: When the user attaches exports (CSV/XLSX from GSC, GA4, Ahrefs, Semrush, etc.), load them with pandas, normalize the columns, and use them in place of (or alongside) API/MCP sources.

## References and Templates

- **[REFERENCES.md](references/api_reference.md)**: Details on how to query the respective APIs/tools.
- **[REPORT_TEMPLATE.md](templates/report_template.md)**: The mandatory structure for the final analysis report.

## Final Deliverable

Always deliver a comprehensive Markdown report following the `REPORT_TEMPLATE.md` structure. The report MUST include the required metrics table, the 12-month MoM line graph, and the page-level attribution for traffic changes.
