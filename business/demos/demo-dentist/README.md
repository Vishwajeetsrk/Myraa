# Demo: Clearpath Dental Care (fictional dentist website)

**Demo website — fictional business created as a portfolio example.**

`Clearpath Dental Care` is not a real practice. Every name, quote, address,
phone number, hour and service description on this site is placeholder content
written for layout demonstration only.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Single-page site with all 11 required sections, SEO meta tags, semantic markup and a top-of-file HTML comment marking the business as fictional. |
| `styles.css` | Framework-free, mobile-first stylesheet with CSS custom properties (calm clinical palette: teal/blue + white + dark slate). |
| `script.js` | ~60 lines of vanilla JS: hamburger menu (aria-expanded, Escape to close, outside-click close), demo form handling, footer year. |
| `README.md` | This file. |

## How to open

No build step, no dependencies, no network requests:

1. Double-click `index.html` (opens via `file://`), or
2. Serve the folder locally, e.g. `python -m http.server`.

## Sections

1. Sticky header — inline SVG tooth logo, nav, "Book Appointment" CTA
2. Hero — headline, subline, CTAs, original inline SVG illustration (labeled as placeholder artwork)
3. Services grid (6) — checkups, cleaning, whitening, veneers, invisible aligners, emergency care
4. Standards (trust) — process-based statements only: sterilization protocol, digital X-rays, same-day emergency slots, costs agreed up front. No awards, ratings or certifications.
5. About / team — placeholder staff cards (`Dr. A. Example`, `J. Placeholder`, `S. Placeholder`) with roles labeled "placeholder name"
6. Testimonials — visibly labeled "Sample layout — placeholder content", generic filler quotes, bylines "Placeholder Patient, demo only"
7. Location — styled "Map placeholder" block (no external iframe), 555 phone, `123 Demo Street`, placeholder hours
8. FAQ — 4 items using native `<details>`/`<summary>` (keyboard accessible for free)
9. Booking — form clearly badged "Demo form — not connected"; submit is intercepted and only prints an on-page notice
10. Mobile nav — hamburger toggle working in vanilla JS, with no-JS fallback (nav stays visible)
11. Footer — demo disclosure line + fictional-business notice

## Disclosure

- Top of `index.html`: HTML comment stating the business is fictional.
- Visible in the hero: pill badge "Demo website — fictional practice".
- Visible in the footer: "Demo website — fictional business created as a portfolio example."
- Testimonials block: "Sample layout — placeholder content".
- Booking form: "Demo form — not connected".
- `meta name="robots" content="noindex, nofollow"` — a fictional demo business should not be indexed.

## Accessibility & performance notes

- Skip link, landmarks (`header`/`nav`/`main`/`footer`), labelled sections, associated form labels
- Visible focus styles (`:focus-visible`), AA-or-better text contrast
- All icons are inline SVG with `aria-hidden` (decorative) or labelled `<title>`/`role="img"` — no emoji anywhere
- Responsive from 320px up (mobile-first breakpoints at 640 / 760 / 900 / 1100px)
- `prefers-reduced-motion` respected; system font stack; zero external resources
