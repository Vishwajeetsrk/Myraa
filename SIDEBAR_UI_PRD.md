# MYRAA Navigation / Sidebar UI Upgrade - PRD

Version target: 9.8.2
Date: 2026-11-20
Status: IMPLEMENTED AND VERIFIED (2026-11-20, v9.8.2). See `sidebar_design_v982.css` and `sidebar_design_v982.js`.

## 1. Problem

The current sidebar works but has inconsistent vertical rhythm, uneven icon/label alignment, weak active-state hierarchy, a divider that does not visually group sections, and a compressed profile footer at narrower widths. Existing rules are spread across `myraa_v6_styles.css`, `ui_polish_phase14.css` and `myraa_design_system.css`, so later overrides fight earlier ones.

## 2. Goals

1. One predictable spacing scale for the sidebar: 4/8/12/16/20 px.
2. Perfectly aligned icon, label and badge columns across all nav items.
3. Clear active state with a left accent rail, not only a background tint.
4. Grouped sections with section labels and consistent dividers.
5. Footer profile block aligned to the same grid, never clipped.
6. Responsive behaviour that collapses labels without breaking alignment.
7. Non-destructive: additive CSS loaded after existing styles; no JS or 3D companion changes.

## 3. Non-goals

- Rebuilding the React bundle.
- Changing navigation logic, routes, icons or data.
- Changing the 3D avatar, voice loop, camera controls or any existing listener.
- Removing or overriding existing accessibility rules.

## 4. Design contract

| Token | Value | Use |
| --- | --- | --- |
| `--sb-pad-x` | 12px | Sidebar horizontal padding |
| `--sb-pad-y` | 16px | Sidebar vertical padding |
| `--sb-item-h` | 42px | Nav item height |
| `--sb-item-gap` | 6px | Space between nav items |
| `--sb-icon-w` | 20px | Fixed icon column |
| `--sb-label-gap` | 12px | Icon to label gap |
| `--sb-radius` | 10px | Item radius |
| `--sb-rail-w` | 3px | Active accent rail |

## 5. Layout rules

- `.left-sidebar` uses `display:flex; flex-direction:column; gap:16px` with header, scrollable nav and footer as three regions.
- `.nav-group` gets `gap:var(--sb-item-gap)` and optional `[data-label]` section captions.
- `.nav-item` is a 3-column grid: fixed icon, flexible label, auto badge. All rows share the same baseline.
- Icon column is centred within 20px; text uses `text-overflow:ellipsis` and `white-space:nowrap`.
- Active item gets a left rail via `::before`, background tint and stronger text colour.
- Badge is right-aligned, monospaced, and never wraps.
- Divider uses a 1px line with 8px vertical margin inside the nav region only.
- Profile footer uses the same 20px icon column and aligns with nav rows.

## 6. Responsive

- `>=1280px`: full labels and badges.
- `<1280px`: hide labels and badges, centre icons, keep 42px hit targets, show `title`/`aria-label` tooltips (existing markup).
- `<900px`: reduce padding to 8px, keep hit targets at 42px.

## 7. Accessibility

- Minimum 42px hit target.
- `:focus-visible` outline preserved and strengthened.
- `prefers-reduced-motion` disables transitions.
- No emoji; icons come from the installed real packages.

## 8. Acceptance criteria

1. All nav item icons start on the same x-coordinate at every breakpoint.
2. Labels and badges share a common vertical baseline.
3. Active state is distinguishable by rail + colour + weight, not colour alone.
4. No horizontal scrollbar or clipped text in the sidebar at 1280x720 and 1920x1080.
5. Profile footer remains visible and aligned at 1280x720.
6. 3D companion and avatar panel still render and are not covered.
7. Existing UI tests still pass; new structural tests pass.

## 9. Risks

- Bundled JS may inject inline styles that override CSS; mitigated by scoped selectors and `!important` only where necessary.
- Over-aggressive z-index could cover the 3D companion; no z-index is introduced in this overlay.

## 10. Verification

- Static CSS parse and selector checks in `tests/test_universal_upgrade.cjs`.
- Live HTTP check that `index.html` loads the new stylesheet.
- Visual check at 1280x720 and 1920x1080 using the browser tooling where available.
