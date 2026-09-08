# API & Tool References

This document provides instructions on how to gather the necessary data for the Website Traffic Checker skill.

## 1. Similarweb Data Gathering

Use the built-in `search` tool with `type=api` to query Similarweb.

**Key Data Points to Extract:**
- Total Visits (last month)
- Bounce Rate
- Pages per Visit
- Average Visit Duration
- Top Countries (Traffic share by geography)
- Marketing Channels (Direct, Organic Search, Paid Search, Social, Referrals, Mail, Display)

*Note: Similarweb is best for overall traffic volume and channel distribution.*

## 2. Ahrefs Data Gathering (via MCP)

If the Ahrefs MCP server is configured, use the `manus-mcp-cli` to fetch SEO data.

**Key Endpoints/Tools to Call:**
- **Site Explorer Overview**: For Domain Rating (DR), total organic keywords, and total organic traffic.
- **Top Pages**: To identify the pages driving the most organic traffic. Note the URL, top keyword, and estimated traffic.
- **Organic Keywords**: To see which keywords rank in the top 10 and their respective search volumes and traffic share.

*Command Example:*
```bash
manus-mcp-cli tool call <ahrefs_tool_name> --server ahrefs --input '{"target": "example.com"}'
```
*(Check available tools with `manus-mcp-cli tool list --server ahrefs`)*

## 3. Semrush Data Gathering (via API)

If Semrush is used, query the Semrush API endpoints.

**Key Endpoints / MCP reports:**
- **Global snapshot**: `domain_ranks` (no `database` param) returns one row per regional database. **Sum `Organic Traffic` and `Organic Keywords` across all desktop databases (exclude `mobile-*` and `-ext` to avoid double counting) to get the global Traffic Overview figures.**
- **12-month trend (global)**: `domain_rank_history` is per-database. **Pull it for the largest regional databases and sum month-by-month** to build the global trend; disclose coverage (e.g., "top 12 markets ≈ X of total global desktop traffic"). Do NOT report a single-country trend as the headline trend.
- **Keywords**: `domain_organic` with `display_limit=500`, `display_sort=tr_desc`.
- **Page types / concentration / underperformers**: `domain_organic_unique` with `display_limit=1000`, `display_sort=tr_desc`.
- **Geography (locale breakdown)**: make a SEPARATE `domain_organic_unique` pull with `display_limit=2000`, `display_sort=tr_desc`, then infer locale from URL path (`/en/`, `/es/`, `/zh_CN/`, etc.).
- **Competitors**: `domain_organic_organic`.

*Note: Ensure you have the user's API key, the Semrush MCP connector, or environment variables. The Semrush Traffic Analytics (Trends) module requires a plan that includes MCP/Trends access; if unavailable, mark total visits, bounce rate, channels, device split, and referral pathways as "Requires Similarweb".*

## 4. DataForSEO Data Gathering (via MCP)

If the DataForSEO MCP server is enabled, use `manus-mcp-cli` to fetch SEO and traffic data. If the connector is disabled, enable it first via `manus-config config save` (this surfaces a confirmation card to the user).

**Setup check & tool discovery:**
```bash
manus-config config load --search DataForSEO   # confirm connector exists / enabled state
manus-mcp-cli tool list --server dataforseo    # list available tools after enabling
```

**Most useful modules/tools for traffic analysis:**
- **DATAFORSEO_LABS** — primary module for this skill:
  - *Domain Rank Overview* (`dataforseo_labs/google/domain_rank_overview`): organic & paid `etv` (estimated traffic volume), total ranked keyword `count`, and position buckets (`pos_1`, `pos_2_3`, `pos_4_10`, `pos_11_20`, `pos_21_30`, ...). Use `pos_11_20` to source near-winner keywords and `is_new`/`is_up`/`is_down`/`is_lost` for inflection signals.
  - *Ranked Keywords* (`dataforseo_labs/google/ranked_keywords`): the full keyword list a domain ranks for, with position, monthly search volume, and SERP elements. Use for branded vs non-branded split, intent, and top non-branded keywords.
  - *Competitors Domain* and *Domain Intersection*: for competitor and keyword-gap context.
  - *Top Pages / Relevant Pages*: pages driving the most organic traffic, for page-type efficiency and concentration analysis.
- **DOMAIN_ANALYTICS**: technologies and Whois details (supporting context only).
- **BACKLINKS**: referring domains and anchor text, if backlink context is needed.

*Command example (global/worldwide scope for the 12-month trend):*
```bash
manus-mcp-cli tool call <dataforseo_tool_name> --server dataforseo --input '{"target": "example.com", "location_name": "World", "language_name": "English"}'
```

*Data volume constraints (MANDATORY):*
- **12-Month Organic Traffic Trend MUST be global/worldwide.** Use a worldwide scope (e.g., `location_name: "World"`), never a single country, when pulling the trend.
- **Cap keyword pulls at 500 keywords** (set `limit`/`display_limit` ≤ 500) for ranked/organic keyword requests.
- **Cap page/URL pulls at 1,000 URLs** (set `limit` ≤ 1000) for top/relevant pages requests.

*Notes:*
- DataForSEO is credit-billed per request; query only the modules needed and save raw JSON output to files for reuse rather than re-querying.
- DataForSEO Labs estimates traffic from search volume × CTR (the `etv` metric), so treat it as estimated organic traffic, comparable to Ahrefs/Semrush estimates rather than Similarweb total visits.

## 5. User-Uploaded Data

When the user attaches their own data files instead of (or alongside) an API/MCP source:
- Accept common formats: **CSV** and **XLSX** exports from Google Search Console, GA4, Ahrefs, Semrush, or any analytics/SEO platform.
- Load with pandas (`pd.read_csv` / `pd.read_excel`), inspect the columns, and **normalize** them to the metrics the report needs (URL/page, keyword, position, search volume, clicks/traffic, impressions, date/month, channel, country, device).
- Map source-specific column names to the standard fields rather than assuming a fixed schema. Only ask the user for clarification if a critical field is missing or ambiguous (e.g., no date column for the MoM trend).
- Cite uploaded files by filename in the report's References section, with the collection/export date if known.
- First-party uploads (GSC/GA4) are authoritative for the owning domain; prefer them over third-party estimates when both are available, and note the source distinction in the report.
