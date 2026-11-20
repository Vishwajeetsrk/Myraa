# Liora Hair & Beauty Studio — Demo Salon Website

A self-contained, static demo website for a **fictional** salon business, built as a
portfolio example.

> **Demo website — fictional business created as a portfolio example.**
> All business details, prices, testimonials, photos, and contact information are
> placeholders. Nothing here represents a real company.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Full single-page site (semantic markup, SEO meta, inline SVG icons) |
| `styles.css` | Mobile-first stylesheet, CSS custom properties, no frameworks |
| `script.js` | Vanilla JS: hamburger nav, header shadow, footer year |
| `README.md` | This file |

## How to open

No build step and no dependencies. Either:

- Double-click `index.html`, or
- Open it in a browser via `file:///.../demo-salon/index.html`

The only external request is the optional Google Fonts stylesheet
(Fraunces + Inter); system serif/sans fallbacks are defined, so the page
looks correct offline.

## What's inside

1. Sticky header with original SVG logo mark and "Book Now" CTA
2. Hero with headline, subline, CTAs, and a labeled gradient/SVG visual
3. Six services with duration, placeholder USD price, and SVG icons
4. Gallery of six labeled placeholder tiles (no external images)
5. About section with three placeholder stylist cards
6. Testimonials visibly labeled **"Sample layout — placeholder content"**
7. Booking CTA with a form marked **"Demo form — not connected"** (mailto)
8. Hours table, fake address (45 Demo Lane, (555) numbers), map placeholder
9. Four-item FAQ (native `<details>` accordion)
10. Mobile hamburger navigation (vanilla JS, `aria-expanded`, Escape to close)
11. Footer with the demo disclosure line

## Design notes

- **Palette:** warm sand (`#F6EFE6`) + deep plum (`#4B2340`) with soft blush accents
- **Type:** Fraunces (display) / Inter (body), with Georgia and system-ui fallbacks
- **Accessibility:** skip link, semantic landmarks, labeled form controls,
  visible focus states, keyboard-operable nav and FAQ, contrast-checked palette,
  `prefers-reduced-motion` support
- **SEO:** title, meta description, Open Graph tags, `noindex` (it is a demo)

## Fictional business details

- Name: Liora Hair & Beauty Studio
- Address: 45 Demo Lane, Suite 2, Springfield, ST 00000
- Phone: (555) 010-0182
- Email: hello@liora-demo.example
