# Domain plan — learnifyai.in

## Your question: can I create a subdomain?

YES. Subdomains under learnifyai.in are created at your domain registrar's DNS panel, for example:

| Subdomain | Points to | Purpose |
|---|---|---|
| `studio.learnifyai.in` | hosting provider (GitHub Pages / Netlify / Cloudflare Pages IP or CNAME) | Agency landing page |
| `demos.learnifyai.in` | same hosting | The 3 demo sites |
| `www.learnifyai.in` | same hosting | standard alias |

Steps (owner action — identity-verification class, I cannot do this for you):
1. Choose hosting: GitHub Pages (free, we already have working GitHub credentials) is the fastest option for a static site.
2. In your registrar DNS panel add: `CNAME studio -> your-hosting-target` (or A record if required).
3. I configure the hosting side (repo/settings) once you've chosen.

Status: `CONFIGURATION_REQUIRED` — no DNS record exists yet.

## Honest note on the domain itself

`learnifyai.in` is an `.in` domain with "learnifyai" in the name — fine for a personal/product brand, but slightly mismatched for a US/UK/AU/UAE website-services studio. Options:

1. **Use it now (free):** `studio.learnifyai.in` — works today, zero cost, professional enough to start.
2. **Buy a studio domain later (~$10-15/yr):** e.g. a neutral brand .com — better for cold-outreach credibility. This is a financial decision = owner's call, and only after Day 3 feedback.

Recommendation: start with option 1, revisit on Day 4 with real reply-rate data. Do not spend money before outreach proves the offer works.
