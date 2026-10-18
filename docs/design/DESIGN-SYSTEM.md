# MYRAA Design System

## Overview

The MYRAA Design System defines the foundational visual language of the MYRAA AI OS. It guarantees consistent hierarchy, high aesthetic polish, zero emojis, and accessibility across all views.

## Foundations

### 1. Colors & Dark Surface Architecture
- Background: `#090d16` (Deep obsidian navy)
- Surface: `#0f172a` (Elevated slate blue)
- Surface Highlight: `#1e293b` (Hover / active card background)
- Subtle Border: `rgba(255, 255, 255, 0.08)`
- Primary Brand: `#6366f1` (Indigo)
- Secondary Accent: `#06b6d4` (Cyan)
- Tertiary Accent: `#8b5cf6` (Violet)

### 2. Typography
- Display: `'Outfit', sans-serif`
- UI & Body: `'Inter', -apple-system, sans-serif`
- Monospace: `'JetBrains Mono', 'Fira Code', monospace`

### 3. Pure SVG Icon Library
All iconography uses vector SVGs. Zero emoji policy strictly observed. Standard set:
- Checkmark (`check`)
- Close / Dismiss (`close`)
- Warning (`warning`)
- Lightning / Action (`lightning`)
- Settings / Engine (`gear`)
- Target / Metric (`target`)
- Folder / Directory (`folder`)
- Shield / Security (`shield`)
- Robot / AI (`robot`)
- Lightbulb / Insight (`bulb`)
- Code / File (`code`)
- Chart / Analytics (`chart`)

### 4. Components
- **Buttons**: Primary (`bg: var(--color-primary)`), Ghost (`border: 1px solid var(--border-subtle)`), Destructive (`bg: var(--color-error)`).
- **Cards**: Translucent dark surfaces with subtle 1px border and optional glow shadow on hover.
- **KPI Metrics**: Prominent numeric displays with trend indicators and descriptive micro-labels.
- **Sidebars / Navigation**: Collapsible rail with tooltips in collapsed state and full text in expanded state.
