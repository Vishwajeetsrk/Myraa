# Replica recon - MYRAA UI surfaces

Method: replica-recon / replica-design (Jakeschincariol/replica-skill, MIT).
Target: MYRAA's own UI (clean-room pass over our own app, not a third-party clone).

## Surfaces

| id | surface | file | stack |
|----|---------|------|-------|
| S01 | Main app shell | `resources/app/dist/index.html` + `assets/index-*.js` (React) + `myraa_v6_styles.css` | React + three.js avatar, custom override CSS |
| S02 | UI addons (health badge, universal control) | `ui-health-patch.js`, `universal-control-addon.js`, `myraa_v6_app.js` | vanilla JS, inline styles |
| S03 | Status dashboard | `status-dashboard.html` | standalone page, own inline styles |
| S04 | Mobile companion | `mobile_companion.html` | standalone page, own inline styles |
| S05 | Installer page | `installer.html` | standalone page |

## Key components (S01, from myraa_v6_styles.css)

- Bottom multimodal input bar (`.bottom-input-container`, `.chat-textarea`, `.voice-mic-btn`, `.send-btn`)
- Action cards (`.action-card`), quick controls (`.quick-ctrl-btn`), tool buttons (`.tool-btn`)
- Left sidebar nav (`.nav-item`), right panel, modals (`.modal-dialog`, `.modal-close-btn`)
- Toasts, loading spinners/skeletons (`.myraaSpin`, shimmer)
- Focus ring system (`:focus-visible` group) and reduced-motion block already present

## Colour roles observed (from `:root`)

bg/canvas/surface/surface-elevated (dark navy ramp), accent cyan + blue,
success/warning/error/info, text primary/secondary/muted/code.
Greys in use: 4 text levels + borders via rgba. No more than 7 greys - healthy.

## Findings driving this pass

1. `--text-muted: #657086` failed AA on bg (3.95:1) and surface (3.57:1).
2. No input border colour role; no visible focus state on the input bar container.
3. `mobile_companion.html` used `#64748b` for an 11px label on dark (below AA).
4. Status dashboard muted grey `#94a3b8` is fine (AA on its near-black bg) - left as is.
