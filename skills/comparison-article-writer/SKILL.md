---
name: comparison-article-writer
title: "Comparison Article Writer"
description: "Write high-quality, research-backed "X vs Y" comparison blog articles (products, tools, services, brands, methods, or..."
category: "Creative & Design"
image: "icon.svg"
icon: "icon.svg"
version: "2.5.0"
tags: ["article", "automation", "comparison", "creative", "myraa-skill", "writer"]
---

# Comparison Article Writer

# Comparison Article Writer

Write blog articles that compare two or more options and help the reader decide. This covers product/tool comparisons (e.g., "Notion vs Obsidian"), service or plan comparisons, brand head-to-heads, multi-option roundups ("5 best X alternatives"), and concept comparisons ("REST vs GraphQL").

A great comparison article is not a feature dump. It is **decision content**: it tells the reader who each option is for, where each one wins and loses, and which one *they* should pick. This skill grounds that content in real keyword research and SERP analysis so the article matches what actually ranks.

## Step 1: Collect the intake brief (do this FIRST)

Ask the user for the information below before doing anything else. Do not start research or drafting until the essentials (marked **required**) are answered. If the user already provided some answers, only ask for what is missing. Present the checklist in one clean message so the user can answer everything at once.

Tell the user: *"The more of this you give me, the better and more accurate the article. If you skip something, I'll research it or make a reasonable assumption and flag it."*

### A. The core comparison (required)
1. **What are we comparing?** Exact names of the 2+ options (e.g., "Ahrefs vs Semrush"). Include URLs if available.
2. **What category/type are they?** (e.g., SEO tools, project management apps, running shoes, programming frameworks).
3. **How many options?** Head-to-head (2) or roundup (3+)? If a roundup, is there a clear "main" pick?

### B. Audience & purpose (required)
4. **Who is the reader?** (e.g., small-business owners, senior developers, beginners, enterprise buyers). Their expertise level and what they care about.
5. **What decision are they trying to make?** (e.g., "which tool to buy", "which to migrate to", "which to learn first").
6. **What stage are they at?** Just exploring, actively comparing finalists, or ready to buy?

### C. Comparison criteria (required)
7. **What dimensions matter most?** (e.g., price, ease of use, features, integrations, support, performance, scalability). List in rough priority order. (Pricing is always included in the comparison table.)
8. **Any deal-breakers or must-haves?** (e.g., "must have a free tier", "must support SSO", "must run on Mac").

### D. SEO & keyword research (required — ASK THIS EXPLICITLY)
9. **Do you have an SEO tool connected to Manus (Ahrefs, Semrush, or similar)?** Ask the user directly. If yes, use it for real keyword research (search volume, difficulty, related terms, SERP data). If no, tell the user you'll do public SERP-based keyword research instead, which is directional rather than exact.
10. **Target keyword / primary search query** (e.g., "notion vs obsidian", "best CRM for startups"). If the user doesn't have one, propose one from research and confirm.

### E. Your angle & verdict (strongly recommended)
11. **Do you have a recommended winner, or should it stay neutral?** A clear verdict makes a stronger article.
12. **Is there a bias to disclose?** (e.g., you sell one of the options, it's an affiliate post, you're an official brand). This changes tone and required disclosures.
13. **Your unique take / first-hand experience.** Have you actually used these tools? Real usage notes, opinions, or data make the article original — and as Step 2 will show, first-person experience often matters for ranking.

### F. Source material (strongly recommended)
14. **Factual data on each option:** pricing, plans, key features, specs, limits. Paste it, link it, or attach docs. *Accuracy of facts is the #1 quality driver — if you don't provide this, the skill will research and verify it but must flag anything uncertain.*
15. **Internal links / CTAs** to include (product pages, signup, related posts).

### G. Format & constraints (optional)
16. **Word count / depth** — note that the SERP analysis in Step 2 will recommend a target length based on what ranks; confirm or override.
17. **Tone** (professional, casual, witty, technical).
18. **Output format** (Markdown default, Google Doc-ready, HTML).
19. **Deadline or publish date**, and **language** if not English.

### Minimum to start
The absolute minimum is items **1, 4, 7, 9, and 10**. Everything else can be researched or assumed — but always tell the user what you assumed.

## Step 2: Keyword research + SERP analysis (do this BEFORE writing)

This step determines the keyword target and the content format that actually ranks. Do not skip it.

### 2a. Keyword research
- **If the user has a connected SEO tool (Ahrefs/Semrush/etc.):** use it (via the appropriate MCP/connector) to pull search volume, keyword difficulty, and related/secondary keywords for the target query. Identify the best primary keyword and 3-8 supporting keywords to weave into the article.
- **If no SEO tool is available:** do public SERP research with `search`, Google autocomplete patterns, "People Also Ask", and related searches to infer the primary keyword, intent, and supporting terms. Tell the user this is directional, not exact volume data.
- Confirm search intent: is the query informational ("what's the difference"), commercial ("which is better to buy"), or navigational? Match the article to it.

### 2b. Analyze the top 10 ranking Google articles
Search the target keyword and open the articles currently ranking in the top 10 organic positions (skip ads, videos, and pure listicles unless they dominate). For the top results, determine the **winning content pattern**:
- **Length:** approximate word count of the top-ranking pieces. Recommend a target length in that range (often match or slightly exceed the median).
- **Perspective:** Are the winners written in **first person from hands-on experience** ("I used both for 3 months…") or are they **objective/generic comparisons** (features, prices, specs compared neutrally)? Or a hybrid? This is critical — match what wins.
- **Structure & elements:** Do they lead with a verdict? Use a comparison table? Include screenshots, pros/cons, FAQ, scoring? Note recurring sections.
- **Angle & differentiation:** What do they all cover, and what do they miss? Find the gap to make this article better (fresher data, clearer verdict, real testing, a decision aid).

Write a short **SERP brief** (3-6 sentences) summarizing the recommended length, perspective, structure, and differentiation angle. Share it with the user before drafting, or proceed if they asked you to just write it — but always reflect these findings in the article.

### 2c. Verify all facts
- Confirm current pricing, plans, features, specs, and limits for each option directly from official sources (`webpage_extract`/`browser` on the vendor's pricing/features pages). Pricing and features go stale fast — always check recency and dates.
- Build a **fact table** (one row per option, columns = the chosen criteria) before writing. This becomes the comparison table and prevents contradictions.
- Flag every claim you could not verify so the user can confirm before publishing.

## Step 3: Write the article

Read `references/article-structure.md` before drafting for the full section-by-section template and quality checklist.

Core principles:
- **Match the SERP-winning pattern from Step 2** — length, perspective (first-person experience vs. objective), and structure. If the winners are experience-led, write from first-person hands-on experience (using the user's notes from intake item 13, or clearly framed as a tester's perspective); if they are objective, stay neutral and data-driven.
- **Comparison table is mandatory and must compare 5-8 features, including pricing.** Pick the most decision-relevant dimensions from the criteria and always include a price/plan row.
- **Lead with the verdict.** Give the bottom line in the first 100-150 words ("the short answer"), then read on for why.
- **Be balanced and fair.** Every option must have genuine strengths and honest weaknesses.
- **Make it scannable.** Clear headers, "best for" callouts, pros/cons.
- **Answer "which should I pick?"** End with use-case-based recommendations ("Choose X if… / Choose Y if…").
- **Stay accurate.** Never invent prices, features, or stats. Mark unverified items clearly.
- **Weave in keywords naturally** — primary keyword in title, intro, one H2, and meta description; supporting keywords across H2s/H3s. No stuffing.

## Step 4: Add images (mandatory — 3-4 per article)

Every comparison article must ship with **3-4 relevant images** embedded in the Markdown with descriptive captions and SEO alt text. Do not deliver a text-only article. Generate or source the images, save them to an `images/` folder beside the article, and reference them with relative paths.

### Required image set (default 3-4)
Unless the user specifies otherwise, produce these, in priority order:
1. **Hero image** (near the top, after the intro): a neutral, on-topic visual representing the comparison. For product/tool comparisons, prefer official screenshots or logos; for lifestyle/concept topics, a relevant photo. Keep it neutral so it does not pre-bias the verdict.
2. **Custom comparison infographic** (right after the comparison table): a polished side-by-side graphic summarizing the 3-4 headline differences (e.g., price, key metric, best-for). This is the most shareable asset — create it with AI image generation (`generate_image`), describing each label, value, icon, and the two-column layout in detail. Verify all text renders correctly.
3. **Data chart** (in the most data-heavy section, usually pricing/cost or performance): a precise chart built with **Python (matplotlib)** from the verified fact table — never an AI-generated chart for quantitative data. Label axes, units, and sources.
4. **Supporting photo or screenshot** (in a key criterion section, e.g., safety, ease of use, setup): one more concrete visual that illustrates a major decision point.

If the topic genuinely supports only three strong images, ship three; never fewer than three.

### Routing rules (consult the `imagegen` skill if unsure)
- **Conceptual/polished visuals** (hero, infographic, callout cards) → `generate_image`. Use a reference image first when multiple generated images must look consistent.
- **Quantitative charts** (cost, performance, benchmarks) → Python/matplotlib from the fact table. Do not fabricate values.
- **Real product UIs / pricing pages** → capture or source actual screenshots via `browser`; do not invent fake UI.
- **Stock photos** for lifestyle topics → source via `search` (type=image), verify each with the file viewer, and copy into the article `images/` folder.

### Placement, captions, and alt text
- Embed images near the content they support (hero after intro; infographic after the table; chart in the data section; photo in a criterion section).
- Give every image a one-line italic caption and descriptive, keyword-aware alt text (`![alt text](images/file.png)`).
- Verify every generated/sourced image with the file viewer before embedding; regenerate if text is garbled or content is off-topic or unsafe (e.g., for family/child topics, show supervised, safe interactions).

## Step 5: Deliver

- Provide the article as a Markdown file (default) plus a short summary that includes: the SERP brief (recommended length/perspective and why), any assumptions made, and a list of facts the user should verify before publishing.
- Include a suggested title tag, meta description, and the primary + supporting keyword usage.
- Attach the article and its `images/` folder so all 3-4 images render; confirm the image count and that captions/alt text are present.
- Offer to adjust length, tone, perspective, the comparison table, or the images.
