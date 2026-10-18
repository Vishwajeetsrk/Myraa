# MYRAA Design Thinking Engine

## Philosophy

MYRAA rejects basic, bare-bones UI prototypes. Every visual interface generated or modified by MYRAA must project state-of-the-art elegance, intentional hierarchy, and responsive fluidity.

## Core Design Principles

### 1. Curated Aesthetics & Depth
- **Color Palettes**: Curated dark and light themes with calibrated HSL values. Avoid plain saturated defaults (pure red, green, or blue). Use rich slate, obsidian, indigo, and cyan accents.
- **Glassmorphism & Elevation**: Subtle backdrop blurs (`backdrop-filter: blur(12px)`), layered surfaces with translucent borders (`rgba(255, 255, 255, 0.08)`), and soft multi-stop box shadows.
- **Visual Contrast**: Strict adherence to WCAG AA contrast standards (minimum 4.5:1 for normal text, 3:1 for large text). Primary text uses high-contrast neutral whites (`#ffffff` or `#f8fafc`).

### 2. Modern Typography
- Modern geometric sans-serif fonts: **Inter** for clean user interfaces and dense data, **Outfit** for elegant display headlines, and **JetBrains Mono** for code and technical stats.
- Modular type scale with fixed proportional line heights (`1.2` for headings, `1.5` for body copy, `1.7` for long-form prose).
- Optical balance: Distinct weight contrasts between headers (SemiBold 600 or Bold 700) and body content (Regular 400 or Medium 500).

### 3. Spatial System & Layout
- 4px/8px Spatial Rhythm: Every margin, padding, gap, and dimension maps to increments of 4px (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`).
- Fluid Containers: CSS Flexbox and CSS Grid layout models with responsive container queries and media queries (`640px`, `768px`, `1024px`, `1280px`).
- Density Awareness: Layouts must accommodate both information-dense enterprise views and spacious presentation decks.

### 4. Zero-Emoji Standard
- **Zero Emojis**: Emojis (Unicode U+1F000+) are strictly prohibited in user interfaces, status cards, and notifications.
- **Inline SVG Icons**: All iconography is rendered via lightweight, clean inline SVG vectors with matching `stroke-width` (typically 1.75px to 2px) and semantic `aria-hidden` attributes.
- **Standard Fallbacks**: In plain-text or console environments, use approved ASCII markers: `[OK]`, `[!]`, `[*]`, `[+]`, `[-]`, `[>]`.

### 5. Motion & Micro-Interactions
- Subtle, purposeful micro-animations on hover, active states, and route changes.
- Standard transition timing: `150ms` for micro-states, `250ms` for cards and panels, `400ms` for complex page transitions.
- Easing: Smooth cubic-bezier curves (`cubic-bezier(0.16, 1, 0.3, 1)`).
- Accessibility: Respect `prefers-reduced-motion` media query to ensure inclusive UX.
