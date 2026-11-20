# Outreach Templates — DRAFT ONLY, never sent without owner approval

Policy: every message below stays in DRAFT until the owner approves (onboarding answer #10). Personalization fields in {{DOUBLE_BRACES}} must be filled from an actual observed fact about that business — if no real observation exists, the lead does not get a message.

Rules (from SOP): no fake audits, no fake clients, no fake results, no fake urgency, no guarantees, no insults, no mass-generic blasts. One specific observation per message. Short.

---

## Template A — first contact (email or contact form)

Subject: Quick website idea for {{BUSINESS_NAME}}

Hi {{BUSINESS_NAME}},

I came across your business while looking at {{CITY}} {{NICHE}}s and noticed {{SPECIFIC_OBSERVATION}}.

I build fast, modern, mobile-ready websites for local businesses — I put together a quick idea of how yours could look, including a clearer booking/contact path on mobile.

Would you like me to send the preview? No obligation, and I won't follow up more than twice if I don't hear back.

—
Vishwajeet Side Income
{{EMAIL}} · {{PORTFOLIO_URL}}

<!-- SPECIFIC_OBSERVATION examples (only if actually true):
     "your site doesn't load over HTTPS on mobile"
     "there's no visible phone/booking button on the mobile view"
     "your listing links to a Facebook page instead of a website"
     "the contact page is missing from the main menu"
-->

---

## Template B — Day 2 follow-up (only if no reply)

Subject: Re: Quick website idea for {{BUSINESS_NAME}}

Hi — just floating this back up. The specific thing I'd fix first for {{BUSINESS_NAME}} is {{SPECIFIC_OBSERVATION}}.

Happy to send the one-page preview if useful, otherwise I'll stop following up here.

—
Vishwajeet Side Income

---

## Template C — Day 5 final follow-up (only if no reply)

Subject: Re: Quick website idea for {{BUSINESS_NAME}}

Hi — last note from me on this. If a website refresh isn't a priority right now, no problem at all — I'll close the file.

If it is, reply anytime and I'll send the preview.

—
Vishwajeet Side Income

<!-- STOP RULES: any "no", "not interested", "remove me", or invalid business = permanent stop.
     Set lead reply + outreach_status accordingly and cancel follow-ups. -->

---

## Template D — interested reply: pricing answer

Subject: Re: {{BUSINESS_NAME}}

Great question. Current packages:

- Starter — $150: one-page site, mobile-ready, contact form, CTA, basic SEO, deployment.
- Standard — $250: up to 3 pages, lead form, map section, booking/WhatsApp CTA, basic SEO, analytics where authorized.
- Maintenance — $25/month (optional after launch): small edits and content updates.

50% to start, 50% before final handover. I can send a fixed-price proposal today if you'd like — which package fits best?

—
Vishwajeet Side Income

<!-- Never invent discounts. If a discount is desired, the owner must add it to pricing.json first. -->

---

## Template E — request for examples/portfolio link

Happy to share — here's my portfolio: {{PORTFOLIO_URL}}
And three labeled demo sites I built (fictional businesses, clearly marked as demos):
- {{DEMO_DENTIST}} · {{DEMO_SALON}} · {{DEMO_HOMESERVICE}}

Want me to mock up a version of your homepage before we talk? I can do that as a first step.

---

## Send log discipline

For every send (manual by owner today, automated after Gmail connection):
1. Record date in CRM `last_contact`.
2. Set next_follow_up = +2 days (Day 0 send), cancel after reply or stop rule.
3. Only APPROVED messages may be recorded as CONTACTED.
