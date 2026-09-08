---
name: backlink-analysis
title: "Backlink Analysis"
description: "Produce a practitioner-grade backlink profile audit report for any target domain using Ahrefs, Semrush, DataForSEO, S..."
category: "AI & Intelligence"
image: "icon.svg"
icon: "icon.svg"
version: "2.5.0"
tags: ["ai", "analysis", "automation", "backlink", "myraa-skill"]
---

# Backlink Analysis

# Backlink Profile Audit Report

You produce a backlink profile audit for a target domain using Ahrefs data. The output is a report a senior SEO practitioner would sign off on: conclusion-first, evidence-backed, built around decisions rather than data description.

Before writing any report prose, read `references/writing_rules.md`. It governs voice, formatting, and the pre-delivery checklist. Do not deliver without passing that checklist.

## Step 0: Confirm the data source (ask the user first)

Do NOT pull data or generate the report until the data source is confirmed. The accuracy of the audit depends entirely on the source data, so always ask the user which data source they want to use before proceeding. Present these three options, in this order of preference:

1. **Connect a tool via MCP.** If the user uses Ahrefs, Semrush, DataForSEO, or Similarweb, they can connect their account to Manus through MCP. This is the preferred option because it lets the skill pull data directly and reliably.
2. **Connect via API.** If their backlink tool does not have an MCP integration, ask them to check whether it can be connected via API instead, and to provide the API access if so.
3. **Upload files.** If neither MCP nor API is available, ask the user to upload whatever exports they have from their tools (e.g., referring domains, backlinks, anchors, competitor exports as CSV/XLSX). Encourage them to upload as much as possible so the report produces the most accurate output.

Use the `message` tool with an `ask` to present these options and wait for the user's choice. After the source is confirmed, map it to the datasets in Step 1: when a tool other than Ahrefs is used, obtain the equivalent of each required dataset and field; when files are uploaded, parse them into the same dataset structure. If a required dataset or field is unavailable from the chosen source, mark the affected section as based on partial data in the report (per Step 1) rather than filling gaps with estimates.

## Step 0.1: Ask whether to include the competitor sections (ask the user second)

After the data source is confirmed, and before pulling any data, ask the user a second question with the `message` tool (`ask`). Ask whether they would like to add a competitor analysis covering two sections: **Competitor Benchmarking** and **Competitor Backlink Comparison: Link Gaps & Opportunities**. Include this caveat verbatim in intent: generating these sections is possible, but it requires pulling additional competitor referring-domain data and will cost more API credits. Wait for the user's answer.

- **If the user agrees:** set `INCLUDE_COMPETITOR = true`. Pull the competitor datasets (Step 1), run analysis steps 2.5 and 2.7, include report Sections 6 and 7, produce the competitor benchmark chart and link-gap CSV deliverables.
- **If the user declines:** set `INCLUDE_COMPETITOR = false`. Do NOT pull competitor referring-domain data. Skip analysis steps 2.5 (concentration vs competitors) and 2.7 (competitor link gap). OMIT report Sections 6 and 7 entirely and renumber the remaining sections (Most Linked Pages, Acquisition Source Breakdown, References move up). Do NOT produce the competitor benchmark chart or the link-gap CSVs. The Executive Summary must not reference competitor positioning. State once in the Methodology appendix that competitor analysis was excluded at the user's request to conserve API credits.

Carry `INCLUDE_COMPETITOR` through every later step. When it is false, treat all competitor instructions below as not applicable.

## Step 1: Pull the data (Ahrefs API v3 Site Explorer)

The table below is the canonical dataset/field spec, expressed in Ahrefs terms. When the confirmed source (Step 0) is Semrush, DataForSEO, Similarweb, or uploaded files, pull or extract the closest equivalent dataset and fields from that source.

| Dataset | Endpoint / report | Scope | Required fields |
|---|---|---|---|
| Backlink statistics | backlinks-stats | Headline metrics for the last 3 months: current values plus the value 90 days before the report generation date (optionally the 30-day point for finer grain inside the window) | live backlinks, live referring domains, DR, Ahrefs Rank |
| Historical trend (backlinks and referring domains) | historical backlinks/refdomains time series | LAST 3 MONTHS ONLY: pull at most the 3-4 most recent monthly data points ending on the report generation date. Do NOT pull or present 12, 18, or 24 months. If the source returns a longer series, slice it to the last 3 months before charting or reporting | date, backlinks, referring domains |
| New referring domains and backlinks (last 3 months) | refdomains / backlinks filtered by first_seen within the last 90 days from the report generation date | all rows in window | domain, domain_rating, links_to_target, dofollow_links, is_spam, first_seen |
| Lost referring domains and backlinks (last 3 months) | lost-refdomains / lost-backlinks within the last 90 days from the report generation date | all rows in window | domain, domain_rating, lost_date |
| Referring domains | refdomains | Top 1,000 by domain_rating | domain, domain_rating, links_to_target, dofollow_links, traffic_domain, positions_source_domain, is_spam, first_seen |
| Anchors | anchors | 500 rows | anchor, links, refdomains |
| Live backlinks | backlinks | 1,000 rows | source URL, target URL, anchor, nofollow flag |
| Best by links | best-by-external-links | Top 50 pages | page URL, referring domains, dofollow links, page traffic |
| Organic competitors (only if INCLUDE_COMPETITOR = true) | organic-competitors | 20 domains | domain, keyword overlap |
| Competitor referring domains (only if INCLUDE_COMPETITOR = true) | refdomains for each of the 2 competitors | Top 1,000 by domain_rating | domain, domain_rating, links_to_target |

If any pull fails, say so in the report and mark the affected section as based on partial data. Never silently fill gaps with estimates.

## Step 2: Run the analysis (in this order)

**2.1 Last-3-months growth and loss.** The reporting window is the last 3 months, defined as the 90 days ending on the report generation date. The historical trend chart and any trend table MUST cover the last 3 months only (the 3-4 most recent monthly points); never plot or report 12, 18, or 24 months, and slice any longer source series down to this window first. Compute, for this window: referring domains gained vs lost, backlinks gained vs lost, and the resulting net change and growth %. Surface this as the report's link growth/loss view. Also compute backlink growth % vs referring-domain growth % within the window: if backlink growth materially exceeds referring-domain growth (rule of thumb: more than 5x), the headline finding is that volume is inflated by repeated, sitewide, or template placements, and this finding leads section 1.1. If the threshold is not crossed, do not manufacture the finding; report growth as balanced. If the chosen source cannot provide lost-link data, mark the loss portion as based on partial data rather than estimating.

**2.2 Authority distribution.** Bucket the top 1,000 referring domains into DR 90+, DR 70-89, DR 50-69, below 50. Report the share of DR 70+ and name 8-12 recognizable high-authority domains. This establishes whether the core is real.

**2.3 Risk scoring.** Flag a referring domain as HIGH risk when it matches 2 or more of: Ahrefs is_spam = true; DR below 10; zero organic traffic and zero organic keywords; near-all dofollow with high links_to_target; link-network TLD (.shop, .site, .space, .top, .cloud); link-selling anchor text. Flag as MEDIUM when it has extreme link volume (links_to_target above 10,000) but no spam markers; these are usually owned, partner, or sitewide placements that need ownership confirmation, not removal. Everything else is LOW. Report the band counts and a table of 5-8 named high-risk examples with their indicators.

**2.4 Anchor classification.** Categorize anchors into: brand, URL, generic/navigational, topical/partial-match, empty/image, other. The diagnostic question is whether topical/partial-match share indicates over-optimization. Also scan anchor text for link-selling strings (Telegram handles, "SEO LINKS", "buy backlinks") and route any hits to the risk section.

**2.5 Concentration (only if INCLUDE_COMPETITOR = true).** Compute live backlinks per referring domain for the target and every benchmarked competitor. Position the target in that range. Skip entirely when INCLUDE_COMPETITOR = false.

**2.6 Most linked pages.** From best-by-external-links: homepage vs deep-page split of referring domains, which product/tool pages earn links independently, and whether high-risk domains target specific URLs (evidence for negative-SEO classification).

**2.7 Competitor link gap (only if INCLUDE_COMPETITOR = true).** Skip entirely when INCLUDE_COMPETITOR = false. Select exactly 2 competitors (default: the closest peer by referring-domain scale and the category leader; let the user override). For each, pull the top referring domains and compute the link intersect: quality domains (Authority Score / DR >= 20) that link to the competitor but not to the target. Drop the competitors' own domains and CDN/junk hosts. Count high-authority missing domains (AS/DR >= 50) per competitor and name the top examples. Group the gap into prioritized opportunity themes (e.g., integration directories, tech media, educational institutions). This feeds Section 7.

**2.8 Source classification.** Tag sampled referring domains by acquisition type: editorial/media (news, blogs, publications), platform/developer (GitHub, YouTube, app stores, docs), brand-owned or partner sitewide (confirm via shared branding or extreme volume with no spam markers), directories/listings, spam networks (the HIGH-risk set), empty-anchor embeds (no-anchor links at scale = widgets/cards). State explicitly that this is rules-based classification, not ground truth.

## Step 3: Write the report (exactly these sections)

1. **Executive Summary** (no subsections; see logic flow below)
2. **Total Referring Domains, Backlinks, and Domain Authority**
3. **Health Status: High-Quality vs Toxic Links**
4. **Backlink Quality & Toxicity Audit**
5. **Anchor Text Distribution**
6. **Competitor Benchmarking** (only if INCLUDE_COMPETITOR = true; otherwise omit)
7. **Competitor Backlink Comparison: Link Gaps & Opportunities** (only if INCLUDE_COMPETITOR = true; otherwise omit)
8. **Most Linked Pages**
9. **Acquisition Source Breakdown**
10. **References**
Appendices: Methodology and Data Limits; Deliverables list.

When INCLUDE_COMPETITOR = false, omit Sections 6 and 7 and renumber the remaining sections sequentially (Most Linked Pages becomes Section 6, Acquisition Source Breakdown Section 7, References Section 8). Update the section-headline range and KPI-closing references accordingly.

### Executive Summary: Logic Flow

The Executive Summary is a self-contained findings brief written as exactly two paragraphs, under 150 words total. No subsections, no bullet points, no tables, no methodology, no action items. Use plain, direct language. Every sentence must be a finding or a reason. No filler phrases ("it is worth noting", "this highlights", "it is important to note").

**Paragraph 1 (profile health):** Open with a single sentence stating the overall health of the backlink profile (e.g., "large in scale but contaminated and structurally thin"). Follow with the key findings that explain why, using specific data points only: total RDs and backlinks, Authority Score, HIGH-risk contribution %, spam-anchor share %, the last-3-months growth/loss divergence, and the authority-core split (% at DR/AS 70+ vs % below 50). Lead with the most severe condition (see decision rules below).

**Paragraph 2 (strategy):** State whether the domain is running an active backlink SEO strategy. Name the strategy (e.g., product-led link earning, programmatic/localized pages, digital PR, guest posting, directory listings) and explain it in plain terms, then state the result with a data point (e.g., homepage vs deep-page split). If the links are organically earned with no deliberate outreach strategy, say that clearly. If a spam/PBN network is inflating the profile, state in one sentence that it is third-party manipulation, separate from the domain's own strategy.

**Decision rules (which condition leads Paragraph 1):**

| Condition | Lead with |
|---|---|
| HIGH-risk > 10% of RDs | contamination / spam |
| Concentration ratio (mean/median) > 50x | inflated volume |
| DR/AS 70+ count < 20 (or < 1% of RDs) | thin authority core |
| Topical anchor share > 15% | over-optimization risk |
| None triggered strongly | overall scale and authority verdict |

**Anti-patterns:** More than two paragraphs. Over 150 words. Bullet points or subsection headers. Tables. Methodology. Domain lists longer than 5 names. Hedging. Action items or recommendations.

### Section headline rule

Every section (2 through 9) opens with a single bold sentence stating the key finding for that section. This sentence is the verdict, not a topic introduction. Evidence, tables, and interpretation follow after. Example: "**The authority core is thin: only 163 domains (0.6%) carry a DR of 70 or above.**" Never open a section with context, methodology, or a table.

### Section contracts (each claim lives in exactly one place)

- Section 2 (Total RDs, Backlinks, DA) carries headline numbers, the last-3-months link growth and loss (RDs and backlinks gained vs lost, net change, growth %), authority core names, and long-tail composition. Growth divergence caveat lives here.
- Section 3 (Health Status) carries risk band summary (LOW/MEDIUM/HIGH counts and backlink contribution), product-led signal, anchor health one-liner, and pointer to Section 4.
- Section 4 carries all risk evidence: DR distribution, risk bands, named high-risk domains, and the triage workflow. The disavow position is stated here ONCE for the entire report: the high-risk list is a manual-review queue, not a disavow file; verify, classify, request removal where controllable, reserve disavow for confirmed unnatural links at scale, citing Google's disavow documentation.
- Section 6 (only if INCLUDE_COMPETITOR = true) is the authority position (where the target ranks) against benchmarked competitors.
- Section 7 (only if INCLUDE_COMPETITOR = true) (Competitor Backlink Comparison: Link Gaps & Opportunities) carries the link intersect against exactly 2 competitors: count of high-authority missing domains (AS/DR >= 50) per competitor, named top prospects, and prioritized opportunity themes. Frame the gap as the path to fixing a thin authority core when applicable.
- Section 9 (Acquisition Source Breakdown) ends with the KPI argument: referring domains are the primary KPI; raw backlink count is treated as a vanity metric when concentration is high.
- Methodology goes in the appendix, never before the findings.
- No standalone conclusion section. The executive summary is the conclusion.

## Step 4: Produce the deliverables

Alongside the report, produce: full analysis workbook (xlsx) with one sheet per dataset, toxic-link triage CSV, disavow review candidates TXT (marked review-only), and chart PNGs for link growth/loss (last 3 months only; the 3-4 most recent monthly points, never a 12/18/24-month series), authority distribution, anchor mix, and risk bands. Only if INCLUDE_COMPETITOR = true, also produce the competitor link-gap CSV(s) (the high-authority missing domains per competitor) and the competitor benchmark chart PNG. List all files in the Deliverables appendix.

## Step 5: Verify before delivering

Run the quality checklist at the end of `references/writing_rules.md` against the draft. Fix every failure before delivery.
