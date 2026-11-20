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
