---
name: content-gap-analysis
title: "Content Gap Analysis"
description: "Identify and prioritize content gaps for a website by comparing it against competitors and search demand. Use when as..."
category: "AI & Intelligence"
image: "icon.svg"
icon: "icon.svg"
version: "2.5.0"
tags: ["ai", "analysis", "automation", "content", "gap", "myraa-skill"]
---

# Content Gap Analysis

# Content Gap Analysis

Use this skill to find the **content a target site should create or improve** to win more organic search traffic, then turn those findings into a **prioritized, action-ready list of opportunities**. The goal is not a raw keyword dump; it is a short list of well-reasoned opportunities, each tied to evidence, a target page, an intent, and a recommended action.

## What a Content Gap Is

Analyze four gap types, not just keywords:

| Gap Type | Definition | Typical Fix |
|---|---|---|
| Topic / keyword gap (domain-level) | Topics or keywords competitors rank for that the target has no page for. | Create a new page or cluster. |
| Page-level depth gap | Target and competitor both cover a topic, but the competitor ranks for far more keywords (more depth, sections, entities). | Expand, restructure, or add sections to the existing page. |
| Buyer-journey gap | Missing coverage across awareness, consideration, and decision intent. | Add TOFU/MOFU/BOFU pages so no funnel stage is empty. |
| Quality / freshness gap | Target page exists but is outdated, thin, hard to read, or lower "information gain" than the SERP. | Refresh, add data/visuals, improve E-E-A-T and usability. |

Before prioritizing, always frame the gaps with three lenses: **traffic concentration** (where each domain's traffic actually comes from by page type), **cluster momentum** (which topics are accelerating vs maturing), and **content velocity** (how large and efficient the competitor's content engine is). These lenses decide *whether* and *how fast* to act on each gap, not just *what* the gap is.

## Required Inputs

The only mandatory input is a **target domain or URL set**. Ask only for missing inputs that block the analysis; otherwise proceed and label assumptions. Preferred inputs:

| Input | Why it helps |
|---|---|
| Target domain / key pages | Anchors the gap comparison. |
| 2–4 competitors | Defines the comparison set. If unknown, discover them (see below). |
| Country + language | Prevents mixing global and local SERPs. |
| Product / topic focus | Filters out irrelevant high-volume keyword gaps. |
| Tool exports (Ahrefs, Semrush, GSC, GA4 CSV) | First-party and estimated data improve precision. |
| Business / conversion data | Prioritizes commercially valuable gaps over vanity traffic. |

**Data source rule:** When the user mentions a tool (Ahrefs, Semrush, etc.) or provides exports, use that data. If an API key is needed and not already available, ask for it; never store keys in files or scripts. If no tools or exports exist, run the **fallback workflow** (public SERP sampling, `site:` checks, sitemap review) and clearly label all estimates.

## Workflow

Run these phases in order. Skip a phase only with a clear reason.

1. **Scope.** Confirm target, competitors, market, language, business model, and priority topics. Define what "success" means (traffic, conversions).
2. **Pick competitors.** Use the provided list, or discover 3–5 true *organic* competitors (domains that recur in the SERPs for target topics, even if they sell something different). See "Competitor Discovery" below.
3. **Collect data.** Pull keyword overlap / missing-keyword data, competitor top pages, and target's existing pages. Capture search volume, keyword difficulty (KD), current positions, intent, and estimated traffic. With exports, normalize into one table. Without tools, sample 20–60 representative queries.
4. **Profile traffic concentration.** Before hunting gaps, compute **total estimated organic traffic** and **traffic by page type** for each domain (see "Traffic Concentration Profile" below). This frames the whole report: a target can lead on total traffic yet still be missing an entire editorial/awareness layer the competitor owns. Build the traffic-by-page-type chart here.
5. **Find topic & keyword gaps (domain-level).** List topics/keywords competitors rank for that the target does not. Exclude competitor-branded and irrelevant terms. Prioritize **high-volume, lower-KD, business-relevant** opportunities.
6. **Find near-winner quick wins (target's own pages).** Mine the **target's** Positions export for keywords where it already ranks **positions 4–15** with meaningful volume. These existing-page tweaks are the highest-ROI quick wins and must appear in the Quick Read *alongside* competitor-driven gaps (see "Near-Winner Quick Wins" below). *Run `scripts/near_winners.py`.*
7. **Find page-level depth gaps.** For shared topics, compare how many keywords each page ranks for. Where a competitor page out-ranks the target page, note the missing subtopics/entities to add. For the single highest-value shared page, run a **live page teardown** (see below). *Run `scripts/page_teardown.py` on the page(s).*
8. **Measure cluster momentum.** Group gap keywords into topic clusters and compute each cluster's total volume, 12-month trend, recent trajectory, and a Growing/Stable/Declining label (see "Cluster Momentum" below). Place this *before* the findings so it frames them, and never recommend a net-new build in a maturing/declining cluster without labeling it a **harvest play**. Build the cluster-sizing chart here. *Run `scripts/cluster_momentum.py` (do not hand-derive the trend math — that is the step that has produced mislabeled clusters).*
9. **Deep-dive the competitor's top cluster.** Identify the single cluster that drives the **most competitor traffic** (this is about the *competitor*, not the target), then explain **what the competitor is doing better there and how the target should replicate it**: which exact pages earn the traffic, which pages/keywords are gaining most, the structural pattern behind them, concrete pages the target should create off the back of that cluster, and what the target can learn (see "Top-Cluster Deep-Dive" below). This is the centerpiece of Finding 1 and is **mandatory** — it turns the cluster from a number into an executable build plan for the target. Build the winning-pages chart here. *Run `scripts/top_cluster_deepdive.py --survey` to pick the cluster, then `--folder` to build the gaining-pages table.*
10. **Map the buyer journey.** Classify gaps by intent (informational, commercial, transactional) and flag any empty funnel stage.
11. **Audit quality & freshness.** For existing target pages near the opportunity, check freshness, thoroughness, readability, structured data, and information gain vs. the live SERP. Convert every quality gap into an explicit, buildable **refresh brief**, not vague "improve depth" advice.
12. **Benchmark content velocity.** Compare blog pages indexed, total blog traffic, and traffic-per-page for each domain, then state the resourcing implication (see "Content Velocity" below). Place near the prioritized opportunities so it informs publishing pace and quality bar. *Run `scripts/content_velocity.py` for these velocity numbers.*
13. **Prioritize.** Score every opportunity (see "Prioritization") and rank. Separate quick wins from larger builds.
14. **Extract learnings.** For each finding where the competitor does something well, state explicitly what the target can learn and replicate.
15. **Deliver.** Produce the gap workbook + a concise report with the highest-value opportunities first, including the required charts. Optionally include content briefs for the top items.

## Competitor Discovery

If competitors are not provided, distinguish **business competitors** from **organic competitors**. Use at least two methods:

- **Shared-keyword tools** (Ahrefs/Semrush "competing domains") to find domains with high keyword overlap.
- **Manual SERP sampling**: search 20–60 representative queries across funnel stages; record recurring domains, page types, and SERP features.
- **Page/folder inspection**: see which competitor templates, hubs, tools, glossaries, or comparison pages earn traffic.

Select 3–5 final competitors with meaningful overlap and comparable (not impossibly dominant) authority. Prefer a mix of direct product competitors and SEO content/publisher competitors.

## Traffic Concentration Profile

This is the opening frame of the report, before the gaps. Two domains can have very different traffic *shapes*, and the shape drives the recommendation. Compute it from the **Positions export** (sum the `Traffic` column), not the Pages export, so totals match.

1. **Total estimated organic traffic** per domain (sum of `Traffic` across all ranked keywords). State it as an estimate.
2. **Traffic by page type.** Bucket every ranking URL into `Homepage / Blog / Tools / Playbook / Integrations / Templates / Other` using path rules (e.g., `/blog/` → Blog, `/tools/` → Tools, root → Homepage). Sum `Traffic` per bucket per domain.
3. **Read the shape.** A product-led target (traffic concentrated on homepage + tool pages) versus a blog-led competitor (traffic concentrated in editorial) is the central story: the target may *lead on total traffic yet still be absent from the entire awareness/editorial layer the competitor owns.* Lead the Executive Summary with exactly this framing when it holds.

**Required chart — Traffic by Page Type.** Grouped bar chart, target vs competitor, one group per page type, y-axis in thousands of visits. This is the chart that belongs in the *Competitor Coverage Snapshot* section. Generate with matplotlib (label the bars, hide top/right spines). Save as PNG and embed with relative path Markdown (`![...](chart_traffic_by_type.png)`), keeping the image file next to the report.

## Near-Winner Quick Wins (Target's Own Pages)

The single highest-ROI move is usually improving a page the target *already has* but that sits just below the fold. Mine the **target's** Positions export:

- Filter to `Position` between **4 and 15** and a meaningful `Search Volume` (e.g., ≥ 2,000).
- Group by `URL` to find the pages with the most near-winner volume; these are the quick-win pages.
- For each, the action is on-page (tune title/H1, expand copy, add use-cases/FAQ, internal links), not a net-new build.

These near-winner quick wins **must appear in the Quick Read table** alongside competitor-driven gaps — the original failure mode is a report that only lists competitor gaps and ignores the target's own almost-ranking pages. Score them high on Winnability (already close) and low on Effort.

## Cluster Momentum

Group gap keywords into topic clusters (regex on the keyword text is fine; label it approximate) and report a momentum table sorted by volume: **total volume, 12-month trend %, recent trajectory %, and a Growing / Stable / Declining label.**

**Critical method note.** Semrush's `Trends` column (and similar normalized series) is per-keyword interest scaled 0–100, not absolute volume. In a fast-growing category, naive first-vs-last or volume-weighting makes *every* cluster look like it is surging, which is useless for discrimination. Instead:

- Parse the 12 monthly values per keyword; volume-weight across the cluster.
- **12-month trend** = mean(last 3 months) vs mean(first 3 months).
- **Recent trajectory** = mean(last 3 months) vs mean(months 4–9). This isolates *recent* acceleration and is the field that actually separates clusters.
- Label from recent trajectory: `Growing` ≥ +10%, `Declining` ≤ −8%, else `Stable / Maturing`.

Momentum rule: a cluster that is flat or declining is a **harvest play** (capture residual demand), not a net-new investment — say so explicitly in the relevant finding. Report the laggard cluster honestly even if it contradicts the user's stated expectation.

**Honesty guardrail (do not inflate momentum).** Report only the numbers the volume-weighted method above actually produces. Do **not** relabel clusters as "Growing" or quote large headline percentages (e.g., "+117%, every cluster accelerating") to make the story more exciting — that pattern is the exact artifact this method is designed to avoid. In most real AI/SaaS datasets the honest result is that most clusters are `Stable / Maturing` with only one or two genuinely `Growing`; deliver that even if it is less dramatic than a stakeholder expects.

**Required chart — Cluster Sizing & Momentum.** Horizontal bar chart sorted by total cluster volume (x-axis in thousands), bars **color-coded by direction** (green = Growing, amber = Stable/Maturing, red = Declining), with the recent-trajectory % annotated on each bar. Embed it in or next to Finding 1 with relative path Markdown (`![...](chart_cluster_sizing.png)`).

## Top-Cluster Deep-Dive (Finding 1)

This is the centerpiece of every report and is **mandatory**. The job of this finding is to tell the target **what the competitor is doing better in its content and how to copy it.** Identify the cluster that drives the **most competitor traffic**, then do not stop at the cluster total — dissect *how* the competitor wins it and convert it into an executable build plan for the *target*. Answer five questions in order:

**Pick the right cluster first (cluster selection rule).** The deep-dive must center on a cluster the competitor wins through **replicable content** the target could realistically build, not through brand or product lock-in. Before locking the cluster: (a) exclude brand/navigational terms and the homepage when sizing competitor clusters, and (b) skip clusters that are not transferable — e.g. user-generated store listings (`/g/` GPTs), pages that rank only because of raw brand authority, or product surfaces unique to the competitor. If the single biggest raw cluster is non-replicable, say so explicitly in one line and deep-dive the **largest replicable, content-built cluster** instead (e.g. a programmatic `/translate/` directory). Naming why the bigger cluster was skipped is part of the finding.

1. **How does the competitor win this cluster?** Pull the competitor's ranking URLs for the cluster's keywords (Positions export filtered to the cluster, grouped by `URL`; or a Pages export filtered to the winning folder, e.g. `/translate/`). Identify the **mechanism**: a single authority page, a programmatic directory of templated child pages, an editorial hub-and-spoke, a glossary, comparison pages, etc. Name it explicitly — the mechanism dictates what the target must build.
2. **Which pages are gaining the most traffic?** Rank the competitor's cluster pages by estimated traffic and list the top 6–10 with their traffic, keyword count, and primary query (volume + position). **Also compute a per-page recent-trajectory %** (volume-weighted, last 3 months vs months 4–9, same method as Cluster Momentum) so the table separates *fast-gaining* child pages from the mature hub — this is what reveals where momentum is actually concentrated. This is the "what's working for them" table.
3. **What is the pattern behind the winners?** Read *why* those specific pages win, not just that they do. Look for the repeatable insight: e.g., long-tail variants beat the head term (lower KD, better positions), templated child pages each capture an exact-match intent the hub cannot, or a specific page format matches searcher intent (tool widget vs article). State 2–4 concrete lessons backed by the numbers (cite KD and position contrasts).
4. **Which pages should the target create (off this cluster)?** This is the required payoff of the finding: a prioritized **Suggested Pages** table that tells the target exactly what to build because the competitor proves it works in this cluster. Each row maps to proven demand: suggested target URL/slug, target keyword, volume, KD, and a one-line "why (learning applied)." Prioritize entries where the competitor proves demand **at winnable difficulty** (mid KD, competitor already ranking) over the highest-volume-but-KD-100 head terms. Where the target already has a thin/partial page in the cluster, cite it as proof the model works for this domain (validation), then recommend scaling it. Never end the finding on the competitor's pages alone — always convert them into target pages to create.
5. **What should the target learn and replicate?** Translate the pattern into a concrete build standard: page architecture (hub + child template), on-page intent match (e.g., working tool widget above the fold for tool intent, not an article), exact-match H1/title, unique supporting copy length, internal cross-linking between sibling pages, and — critically — the **structured-data edge** (often the competitor relies on raw authority with *no* JSON-LD, so the target can out-optimize on `FAQPage`/`SoftwareApplication`/`ItemList` schema even at lower domain authority). Close with whether this is a **strategic build** (Growing cluster) or a **harvest play** (maturing/declining), and a rough first-sprint scope (e.g., 6–8 pages in 30–45 days, then scale the template).

**Required chart — Winning Cluster Pages.** Horizontal bar chart of the competitor's top cluster pages by estimated traffic (x-axis in thousands), labeled with each page slug. Title it after the cluster and its mechanism (e.g., "ChatGPT's Winning Translation Pages (Programmatic /translate/ Directory)"). Save as PNG beside the report and embed in Finding 1 with relative-path Markdown (`![...](chart_<cluster>_pages.png)`).

**Honesty guardrail.** Suggest only pages backed by real keyword demand in the export, and prefer winnable KD over vanity head terms. If the cluster's biggest terms are all KD ~100 brand/generic terms the target cannot win, say so and pivot the suggestions to the winnable long-tail — do not pad the table with unrealistic head-term targets.

## Live Page Teardown (Depth & Quality Gaps)

For the highest-value shared page (where the competitor outranks the target), fetch **both pages live** and build a side-by-side teardown table, then convert every row into a concrete refresh brief. Required attributes to compare:

- Last-updated / published date (check visible date AND JSON-LD `dateModified`).
- Number of items/tools covered and total word count.
- Comparison-table columns — does it include **price** and **cons**?
- Per-item section structure (e.g., "why we picked it," ideal-for, pros/cons, pricing).
- Embedded video; number and type of images (real screenshots vs stock/logos).
- First-person testing / E-E-A-T signals (count first-person mentions), author byline, social proof.
- Schema / structured data (`BlogPosting`, `AggregateRating`, `FAQPage`).

Quick ways to capture these: extract page text for word/section/first-person counts; and `curl` the raw HTML and grep for `application/ld+json`, `datePublished`, `dateModified`, `author`, `AggregateRating`, `ratingValue`.

The deliverable is a **buildable refresh spec**: exact number of items to add, which named items, which table columns, how many images, which byline/date elements, and which schema types — never "improve depth."

**Finding 2 must contain all of the following (do not ship without all four):**
1. A one-line statement of which near-winner page is targeted, its current position, the keyword, volume, and KD.
2. A **side-by-side teardown table** with **6–8 attribute rows** (minimum: word count/depth, comparison table presence, E-E-A-T/author, date stamps, media, schema), each row stating *current state* vs *what's missing* — captured from a **live fetch**, not assumed.
3. A **numbered, buildable Action Brief** (exact table columns to add, exact schema types, exact byline/date elements, exact image count) — every item must map to a missing row in the table.
4. A **"What [Target] Can Learn"** takeaway generalizing the depth principle.

A generic instruction like "add depth" or "improve schema," or a teardown table under 6 rows, is an automatic fail.

## Content Velocity

Using the Pages export, compare for each domain: **blog pages indexed, total blog traffic, and traffic-per-blog-page.** Then state the resourcing implication: if the competitor's blog is both larger and more efficient per page, estimate roughly how many pages the target needs to close the traffic gap **at its current per-page quality vs at the competitor's quality bar**, and use that to recommend a publishing pace and quality standard. Place this near the Bottom Line. Label page counts as directional (indexed pages in the export, not a full crawl).

## Prioritization

Score each opportunity and sort descending. Default model:

| Factor | Scale | Notes |
|---|---|---|
| Search demand | 1–5 | Volume or SERP visibility. |
| Business value | 1–5 | Commercial/conversion relevance, not just traffic. |
| Winnability | 1–5 | Inverse of KD relative to target authority; higher = easier. |
| Effort | 1–5 | 5 = hardest to produce. |
| **Priority score** | — | `(Demand + Business value + Winnability) − Effort` |

Label each opportunity as **Quick win** (existing page tweak or low-effort new page) or **Strategic build** (new cluster, tool, or major asset). Quick wins go first in the Quick Read table.

## Deliverables

Produce both unless the user asks for a lighter version:

1. **Gap workbook (CSV/Sheet)** using the columns in `templates/gap_workbook.csv`. One row per opportunity with evidence, intent, target page, action, and priority score. Keep raw exports here.
2. **Concise report (Markdown)** following `templates/report_template.md`. Put the answer first and follow this exact section order: **Executive Summary** (lead with total-traffic comparison + concentration framing), **Cluster Momentum** table, **Quick Read: Top Opportunities** table (mixing near-winner quick wins and competitor gaps), **Competitor Coverage Snapshot** (embed the *traffic-by-page-type* chart here), **Main Findings** (one gap theme each, with evidence + action + a mandatory **"What [Target] Can Learn"** takeaway if the competitor offers a transferable lesson) — where **Finding 1 is the mandatory Competitor Top-Cluster Deep-Dive** that tells the target what the competitor does better and how to copy it (cluster-sizing chart + winning-pages chart + how the competitor wins it + what's gaining most traffic + a Suggested Pages table of pages the target should create + learnings to replicate), with a **live page teardown + refresh spec** woven into the depth/quality finding — **Content Velocity & Resourcing**, a **Bottom Line**, and a mapped **References** section. Weave the method sections into where they belong rather than appending them as standalone blocks.
   - **Three charts are mandatory**: traffic-by-page-type (Competitor Snapshot), cluster-sizing/momentum (Finding 1), and winning-cluster-pages (Finding 1 deep-dive). Save all as PNGs beside the report and embed with relative-path Markdown so they render in the deliverable.
   - **Use inline numbered citations** (`[1]`, `[2]`, …) woven into the prose for every factual/data claim, and close with a **References** section that maps each number to its source export, script, or live-page extraction.
   - **Findings completeness check — every main finding gets the same rigour (do not ship if any are missing):**
     - **Finding 1** must contain all five: (1) the named win mechanism, (2) a *gaining-pages table with per-page recent-trajectory %*, (3) the 2–4 pattern lessons with KD/position contrasts, (4) a **Suggested Pages table for the target** (slug + keyword + volume + KD + why), and (5) a learn-and-replicate build standard ending in strategic-build-vs-harvest + first-sprint scope. A bare cluster volume figure or a missing Suggested Pages table is an automatic fail — this is the most common failure mode. Also confirm the deep-dive sits on a **replicable** competitor cluster (brand/homepage and product-locked clusters like `/g/` GPTs excluded, with a one-line note if a bigger raw cluster was skipped).
     - **Finding 2** must contain all four (see "Live Page Teardown" gate): the targeted near-winner page line, a 6–8 row live teardown table (current vs missing), a numbered buildable Action Brief mapped to the missing rows, and a "What [Target] Can Learn" takeaway. A teardown under 6 rows or a vague "add depth" brief is an automatic fail.
     - **Universal rule:** every main finding ends with a buildable action (named pages, exact tables/schema/counts) and a "What [Target] Can Learn" takeaway — no finding may stop at a metric or a bare chart.

Optionally add **content briefs** for the top 3–5 opportunities (target keyword/topic, intent, recommended page type, suggested sections/entities to cover, internal links, and what makes it better than the current SERP).

## Writing & Quality Rules

- **Lead with the opportunity, not the metric.** Every finding states the gap and the recommended action in plain language.
- **No raw keyword dumps in the report.** Keep large exports in the workbook; the report shows only the prioritized, decision-ready shortlist.
- **Tie every recommendation to evidence**: the competitor proving it, the keyword/page, volume/KD, and intent.
- **Label estimates.** Mark third-party traffic/volume as estimates; never overstate ranking certainty. Explicitly flag approximations: regex-based clustering, normalized-trend interpretation, and directional page-count/resourcing estimates.
- **Refresh briefs must be buildable.** Convert depth/quality findings into concrete specs (item counts, table columns, schema types), never vague "improve depth" or "add schema."
- **Let momentum gate the recommendations.** Tie trend direction to each recommendation; label net-new builds in maturing/declining clusters as harvest plays.
- **Separate new-page gaps from improve-existing-page gaps**, since the action and effort differ.
- **Always surface the target's near-winner pages.** Do not produce a report that only lists competitor gaps; the pos 4–15 quick wins on the target's own pages are usually the fastest ROI and must appear in the Quick Read table.
- **Always extract learnings.** After each Main Findings section, include a "What [Target] Can Learn" paragraph that turns the competitor's success into a transferable lesson for the target (only apply in sections where the competitor does something well that helps the target).
- **Charts must render and be accurate.** Build the three required charts from the real exports, verify them visually before embedding, and reference them with relative paths so they display in the delivered file.
- **Make Finding 1 a build plan, not a number.** The top-cluster deep-dive must always answer how the competitor wins the cluster, which pages gain the most traffic, which pages the target should create, and what to learn/replicate — never leave the biggest cluster as a bare volume figure.
- **Cite inline.** Weave numbered citations into the prose and map them in a References section; do not leave data claims unsourced.
- **Be realistic.** Flag which competitors are beatable vs. aspirational; don't recommend chasing terms the target cannot win soon.
- Explain SEO jargon only when it changes the decision; write for a content/marketing lead, not only SEO experts.

## Fallback (No SEO Tools)

When no exports or APIs are available: sample representative queries in Google, record who ranks and the dominant page types, use `site:targetdomain.com [topic]` to check existing coverage, review the target's sitemap/indexed pages for missing clusters, and inspect competitor top pages manually. Clearly state that volumes and difficulty are directional estimates.

## Resources

- `templates/gap_workbook.csv` — column schema for the opportunity workbook.
- `templates/report_template.md` — structure for the concise report.

### Scripts (use these; do not re-derive the math by hand)

The quantitative steps below have repeatable failure modes when re-implemented from scratch in a fresh session — most often **mislabeling a large growing cluster as small/declining** because the `Trends` column is treated as volume, or producing a thin Finding 1. **Always run the bundled scripts rather than improvising the calculations.** They live in `scripts/` and share `scripts/cga_common.py`. All take CSV exports and print + save results; run each with `--help` first, and adjust the cluster/brand/folder arguments to the actual market.

| Script | Workflow step | What it guarantees |
|---|---|---|
| `scripts/cluster_momentum.py` | Step 8 (Cluster Momentum) | Volume-weighted 12-mo + recent-trajectory math with brand exclusion, so clusters are sized and labelled correctly (prevents the "growing cluster shown as declining" bug). Prints an honesty check on how many clusters are "Growing." |
| `scripts/top_cluster_deepdive.py` | Step 9 (Finding 1) | `--survey` lists the largest competitor folders and flags non-replicable ones (`/g/`); `--folder` builds the gaining-pages table with per-page **recent-trajectory %**, the exact evidence Finding 1's gate requires. |
| `scripts/near_winners.py` | Step 6 (Near-Winner Quick Wins) | Extracts the target's pos 4–15 keywords and rolls them up by URL to name the pages to refresh. |
| `scripts/content_velocity.py` | Step 12 (Content Velocity) | Per-domain blog pages indexed, total blog traffic, and traffic-per-blog-page — the Content Velocity numbers for both domains in one run. |
| `scripts/page_teardown.py` | Steps 7 & 11 (Live Teardown) | Live-fetches a URL and reports word count, H2s, tables, media, byline, JSON-LD @types, and datePublished/dateModified — the live evidence Finding 2 must be built from. |
| `scripts/build_gap_workbook.py` | Step 5 (domain-level gaps) | Optional: merge target vs competitor keyword exports into a deduplicated missing/weak workbook with priority scores. |

**Brand exclusion is mandatory before clustering or gap mining.** `cga_common.brand_token_variants()` covers common misspellings (e.g. `chat gbt`, `chatgtp`); extend it for the brand in scope. Skipping this lets brand navigation masquerade as content opportunities.

**Charts.** After running the scripts, build the three mandatory charts (traffic-by-page-type, cluster sizing/momentum, winning-cluster pages) from their CSV outputs with short matplotlib snippets, verify them visually, and embed with relative paths.

**Fresh-session note.** A new session only inherits the skill text, these scripts, and whatever exports the user provides — not any analysis done in a previous session. Re-run the scripts on the current exports every time; never copy numbers from memory of an earlier run.
