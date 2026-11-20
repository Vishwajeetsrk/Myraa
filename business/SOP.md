# Business SOP — vishwajeet side income

Living standard operating procedure. Every step states what MYRAA automates vs what requires the owner.

## 1. Lead discovery

1. Search public business listings / Google Maps / directories / public websites for target niches in target markets.
2. Only publicly listed business contact info. No private data, no purchased lists, no scraping behind auth.
3. Respect robots.txt, platform terms, rate limits, privacy and anti-spam laws.
4. Owner action: none (safe automation allowed).

## 2. Qualification

1. Score each prospect on observable website problems (mobile, speed, CTA, contact, SEO basics, HTTPS, content clarity).
2. Output: Website Score /100 + top problems + constructive improvement note.
3. Owner action: none (analysis only, read-only on public sites).

## 3. Personalization + outreach draft

1. Draft ONE specific short message per lead based on actual observed issues.
2. Banned claims: fake audits, fake clients, fake results, fake testimonials, guarantees, false urgency.
3. Status moves to APPROVAL_REQUIRED.
4. Owner action: APPROVE each send (current policy: approval required for every message).

## 4. Send + track

1. Send only through a connected, authenticated channel (currently: manual send by owner, or Gmail after secure OAuth connection).
2. Record send date; schedule follow-ups: Day 0 first message, Day 2 follow-up, Day 5 final follow-up.
3. Stop permanently on: no / opt-out / request to stop / invalid business.
4. Owner action: none beyond the approval in step 3.

## 5. Reply classification

1. Classify: INTERESTED / QUESTION / PRICE_OBJECTION / NOT_INTERESTED / REQUEST_FOR_CALL / REQUEST_FOR_EXAMPLES / REQUEST_FOR_PROPOSAL / READY_TO_BUY / UNKNOWN.
2. Prepare response using current pricing.json — no invented discounts.
3. Owner action: approve reply sends (same outreach policy).

## 6. Proposal + invoice

1. Proposal generated from template (client name, problem, solution, package, deliverables, timeline, price, terms, revisions, maintenance, assumptions, acceptance).
2. Invoice generated with actual business/tax config supplied by owner — never fabricated tax data.
3. Payment link only after payment provider is connected.
4. Owner action: financial commitments, contracts, sending the proposal/invoice (owner sends or approves).

## 7. Onboarding (after deposit verified)

1. Deposit RECEIVED status confirmed (provider confirmation or owner confirmation).
2. Create project workspace + send onboarding questionnaire (business name, logo, colors, services, contact, hours, photos, socials, booking link, style, competitors, pages, requirements).
3. Owner action: none (safe).

## 8. Build

1. Client brief -> research -> sitemap -> wireframe -> design system -> implementation -> responsive QA -> accessibility QA -> content QA.
2. Existing projects are never blindly overwritten; new client work goes in its own folder.
3. Owner action: none (safe automation).

## 9. QA before delivery

Desktop/tablet/mobile check, navigation, forms, buttons, typography, spacing, images, accessibility, performance, SEO, broken links -> automated QA report.

## 10. Deployment

1. Only with authenticated, owner-connected hosting accounts. Tokens never exposed.
2. Post-deploy verification: open site, test pages/forms/links/mobile/HTTPS, capture screenshots, confirm production URL.
3. Owner action: connect hosting account once (secure flow).

## 11. Delivery

1. Package: URL, access instructions, source repo where applicable, assets, docs, SEO notes, maintenance option, final invoice, support info.
2. Ownership transfer only after configured payment condition (50% balance) is satisfied.
3. Owner action: approve handover.

## 12. Support / maintenance

Maintenance clients: small edits + content updates per package; anything out of scope gets a fresh quote.

## 13. Daily loop

- Morning: review target, pipeline, replies, overdue follow-ups, new prospects, audits, outreach drafts, demos, paid work, metrics.
- Evening: revenue, leads, messages, replies, conversions, projects, payments, problems, next actions.
- Priority engine: paid delivery > high-intent prospect > proposal/invoice waiting > follow-up > new lead > portfolio > automation > polish.

## 14. Financial records

Invoices, payments, expenses, refunds, outstanding balances recorded in `business/finance/` (git-ignored). Revenue != profit: track fees, domains, hosting, software, API usage, refunds against gross.
