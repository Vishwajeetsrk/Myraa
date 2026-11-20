# MYRAA Business Workspace — vishwajeet side income

Operating system for the 7-day website-service challenge. Single source of truth for all business data.

## Layout

| Path | Purpose | Git |
|---|---|---|
| `BUSINESS_PROFILE.md` | Onboarding answers, domains, email, markets, policy | committed (no secrets) |
| `pricing.json` | Packages, payment terms, target math | committed |
| `SOP.md` | Lead -> delivery standard operating procedure | committed |
| `README.md` | This file | committed |
| `templates/` | Proposal, invoice, onboarding questionnaire | committed |
| `sites/agency/` | Studio landing page (static) | committed |
| `demos/` | Demo sites: dentist, salon, home-service (all fictional, labeled) | committed |
| `crm/leads.csv` | Lead database — full spec schema | **GIT-IGNORED** |
| `state/` | Pipeline + payment state models (all real zeros until real events) | **GIT-IGNORED** |
| `finance/` | Invoices, payments, expenses, profit tracking | **GIT-IGNORED** (to be created) |
| `clients/` | Per-client project workspaces (created on first deposit) | **GIT-IGNORED** |
| `reports/` | Archived daily business reports (additive, never overwritten) | **GIT-IGNORED** |

## MYRAA awareness API

MYRAA reads this workspace directly through `resources/app/dist/business_os.cjs`, mounted at `/api/business`.

| Route | Returns |
|---|---|
| `GET /api/business/status` | Workspace path, existence, route list |
| `GET /api/business/summary` | Leads, revenue math, finance, templates, inventory, blockers |
| `GET /api/business/report?format=markdown` | Daily report as Markdown |
| `POST /api/business/report/save` | Archives a timestamped report in `reports/` |
| `GET /api/business/reports` | Archived report list |
| `GET /api/business/leads?status=&industry=&country=&q=` | Filtered lead query |
| `GET /api/business/finance` | Collected, expenses, net, remaining target |
| `GET /api/business/templates` | Template list |
| `POST /api/business/templates/render` | Safe placeholder rendering (unresolved placeholders preserved) |
| `GET /api/business/inventory` | Spreadsheets, documents, images, templates, data, email files |
| `GET /api/business/excel` | Spreadsheet list |
| `GET /api/business/excel/analyze?file=crm/leads.csv` | CSV parsed directly; XLSX routed through `excel_intelligence.cjs` |
| `GET /api/business/email` | Email address, connection state, drafts, outreach templates |

Voice/text intents routed through `unified_capability_router.cjs`:

- "business report" -> `BUSINESS_REPORT`
- "how many leads do I have" -> `BUSINESS_LEADS`
- "revenue status" -> `BUSINESS_FINANCE`
- "email status" -> `BUSINESS_EMAIL`

All four are read-only. They never send email, move money, or write to the CRM.

## Hard rules

- No emojis anywhere in any business asset.
- No fabricated leads, replies, payments, testimonials, clients, or results.
- Status vocabulary: `NOT_DONE`, `CONFIGURATION_REQUIRED`, `AUTHENTICATION_REQUIRED`, `TOOL_UNAVAILABLE`, `APPROVAL_REQUIRED` — used honestly.
- Never store passwords/API secrets/OAuth tokens in this folder or anywhere in git.
- Outreach: DRAFT -> APPROVAL_REQUIRED -> (owner approves) -> SEND -> TRACK. No send happens without approval.
- A payment is only PAID after verified provider confirmation or explicit owner confirmation.
- Opt-outs stop follow-ups permanently.

## Connected services status (real)

| Service | Status |
|---|---|
| GitHub | WORKING (git push verified) |
| Gemini AI | WORKING (key present, secure storage) |
| Browser automation | AVAILABLE |
| Gmail (send) | AUTHENTICATION_REQUIRED (secure OAuth flow needed) |
| Razorpay | CONFIGURATION_REQUIRED (account exists, not connected) |
| Stripe | CONFIGURATION_REQUIRED (no config found) |
| Hosting deploy | CONFIGURATION_REQUIRED (no tokens found) |
| learnifyai.in subdomain | CONFIGURATION_REQUIRED (DNS is a user action) |
