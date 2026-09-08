# Writing Rules: Practitioner Report Voice

These rules govern all report prose. They exist because the failure mode of AI-written SEO reports is data description in a hedging, generic voice. The fix is structural and verbal discipline.

## Voice

- Conclusion first, evidence second. Every section (2 through 8) opens with a single **bold key-finding headline sentence** that states the verdict for that section. This is the most important structural rule. The headline sentence is a finding, not a topic label. Good: "**Backlink volume is inflated by sitewide placements from 10 domains that account for 74% of all links.**" Bad: "This section covers the total referring domains and backlinks." Evidence, tables, and interpretation follow after the headline. Never open a section with methodology, context, or a table.
- One hedge, stated once. If a finding has a caveat (e.g. "repeated links are not inherently bad"), say it once where the finding is introduced and never repeat it. The structure carries the nuance: one section proves the strength, another proves the risk.
- Each major claim appears in exactly one section. If you are about to restate something, point to the section that owns it instead.
- Plain, direct sentences. Banned phrases and words: "it is important to note", "it's worth mentioning", "in today's digital landscape", "robust", "delve", "leverage", "holistic", "comprehensive overview", "landscape", "navigate the complexities". No rhetorical questions. No "not just X but Y" constructions.
- Do not use em-dashes or en-dashes in prose. Use commas, colons, or separate sentences.
- Audience is a marketing lead and an SEO practitioner. Define nothing they already know (DR, dofollow, disavow). Explain only judgment calls, like why a metric is treated as a vanity metric.

## Formatting

- Bold the opening key-finding headline sentence of each section. Beyond that, bold sparingly: headline numbers and key terms only, never other whole sentences.
- Tables carry data; prose carries interpretation. Never describe in prose what a table already shows. Every table needs at least one sentence of interpretation before or after it.
- Numbers exact as pulled, with thousands separators. Percentages to one decimal place.
- Name real domains as evidence. "High-authority sources include github.com and forbes.com" beats "many authoritative sites".

## Recommendations

- Specific enough to act on this week. "Publish developer tutorials for agent workflows on digitalocean.com" not "improve content marketing".
- Every recommendation names a target, channel, or asset.
- Cite Google documentation (disavow guidance, spam policies) and Ahrefs field definitions as footnote references. Do not cite blogs or SEO commentary sites.

## Quality checklist (verify before delivering)

- [ ] Executive Summary is exactly two paragraphs and under 150 words; no bullets, tables, or subsections
- [ ] Executive Summary paragraph 1 opens with a one-sentence profile-health verdict, then data points only
- [ ] Executive Summary paragraph 2 states whether an active backlink strategy exists, names it, explains it plainly, and gives the result (or states links are organically earned with no outreach)
- [ ] The competitor opt-in question was asked after the data source was confirmed, with the extra-API-credit caveat
- [ ] Every section opens with a bold key-finding headline sentence (verdict, not topic label)
- [ ] Last-3-months link growth and loss (RDs and backlinks gained vs lost) is reported in section 2; growth divergence finding (if triggered) is in section 2
- [ ] Disavow stance appears exactly once, in section 4
- [ ] If the user opted IN: Competitor Benchmarking and Competitor Backlink Comparison (Link Gaps & Opportunities) appear in order (using exactly 2 competitors), the link-gap CSVs and competitor chart are produced, and sections are numbered with them included
- [ ] If the user opted OUT: both competitor sections are absent, no competitor data was pulled, no competitor chart or link-gap CSVs exist, the Executive Summary makes no competitor comparison, sections are renumbered with no gaps, and the Methodology appendix notes competitor analysis was excluded to conserve API credits
- [ ] No standalone conclusion section exists
- [ ] Methodology is in the appendix
- [ ] Zero em-dashes or en-dashes in prose
- [ ] No banned phrases (search the draft for: delve, robust, landscape, leverage, holistic, "important to note", "worth mentioning", "this highlights")
- [ ] Every table has interpretation prose
- [ ] Any missing data pull is disclosed and the affected section marked partial
- [ ] Referring-domains-as-primary-KPI argument closes the Acquisition Source Breakdown section
- [ ] Report does NOT include a Priority Improvement Plan or 90-Day Action Plan section
