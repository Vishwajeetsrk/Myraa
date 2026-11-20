# CRM

- `leads.csv` — one row per lead, header matches the full spec schema (Lead ID through Delivery).
- Statuses (in order): NEW, RESEARCHED, QUALIFIED, CONTACT_READY, DRAFTED, APPROVAL_REQUIRED, CONTACTED, REPLIED, INTERESTED, PROPOSAL_SENT, INVOICE_SENT, DEPOSIT_PAID, IN_PROGRESS, DELIVERED, FINAL_PAYMENT_PENDING, PAID, LOST, FOLLOW_UP.
- Rules: publicly listed business info only; opt-outs are permanent; no message moves past APPROVAL_REQUIRED without owner approval.

This folder is git-ignored — client/lead data never goes to GitHub.
