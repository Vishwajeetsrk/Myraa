# Vishwajeet Side Income — Agency Landing Page

A production-quality static landing page for a freelance website-service studio ("Vishwajeet Side Income", wordmark **VSI**). It presents the studio's offer to local businesses: problem framing, what you get, live demo links, packages, process, FAQ and a contact form.

## What this is

- **Unscaffolded static HTML** — plain files, no framework, no bundler, no npm, no build step.
- Mobile-first, semantic, accessible (skip link, labelled controls, visible focus states, reduced-motion support).
- No trackers, no cookies, no backend. The contact form composes a `mailto:` message in the visitor's own email app; no data is stored or sent anywhere else.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Full page: SEO/OpenGraph meta, all nine sections, inline SVG marks and icons |
| `styles.css` | Design tokens (CSS custom properties), layout, components, responsive rules |
| `script.js` | Dynamic year, mobile nav, scroll reveal, mailto form composition |
| `README.md` | This file |

## How to open

Double-click `index.html`, or:

```
start index.html
```

It works directly via `file://` in any modern browser. The only network request is the optional Google Fonts stylesheet (Inter + Playfair Display); offline it falls back gracefully to the system font stack.

## Sections

1. Hero — problem-to-solution headline, primary CTA "Get a free website idea", secondary CTA "See packages"
2. Problem — common issues local businesses face (no site, outdated, not mobile-friendly, slow)
3. Solution — what every project includes
4. Examples — three cards linking to `../../demos/demo-dentist/`, `../../demos/demo-salon/`, `../../demos/demo-homeservice/`, each labelled "Live demo (fictional business)"
5. Packages — Starter $150, Standard $250, Maintenance $25/month (prices in USD; final quote confirmed per project)
6. Process — brief, research, design, build, QA, launch (typical turnaround 2-5 days for a starter site)
7. FAQ — ownership, revisions (2 rounds included), content, hosting, payment (50% upfront / 50% before handover), maintenance
8. Contact — mailto form to `support.learnifyai@gmail.com` with an honest "no data is stored" note
9. Footer — copyright with JS-driven year, links back to the demos folder

## Content policy

- No emojis anywhere; icons are inline SVG or ASCII.
- No invented testimonials, client logos, statistics or awards. Trust statements describe the actual process (responsive QA and accessibility checks on every project).
- Visuals are CSS gradients and original geometric SVG shapes; preview areas are explicitly labelled "Preview placeholder".
