# Replica design - MYRAA component specs (post-pass)

Tokens: `replica/design/tokens.json` - all 19 pairs pass WCAG AA
(`python contrast.py replica/design/tokens.json` -> 0 failing, exit 0).

Changes applied in this pass:

| role | before | after | why |
|------|--------|-------|-----|
| text-muted | #657086 (3.95:1 / 3.57:1) | #7E8DA4 (5.84:1 / 5.27:1) | AA for body-size labels |
| border-input (new) | - | #526689 (3.39:1 on bg) | AA non-text contrast for input boundaries |

Applied to `resources/app/dist/myraa_v6_styles.css`:
- `--text-muted` token updated (cascades app-wide).
- `--border-input` role added next to the other border roles.
- `.bottom-input-container:focus-within` -> border turns `--border-input` plus a
  3px translucent cyan ring; the input bar now shows a visible focus state.

Applied to `mobile_companion.html`:
- 11px pad label `#64748b` -> `#94a3b8` (matches its own `--text-dim`, passes AA).

## Component specs (as-built, for future passes)

Input bar (`.bottom-input-container`)
  states    default (border-subtle), focus-within (border-input + 3px ring)
  tokens    bg rgba(16,24,39,.8), radius lg, blur 20px
  a11y      textarea has no own outline; container focus ring is the visible state

Buttons (`.tool-btn`, `.voice-mic-btn`, `.send-btn`)
  variants  ghost (tool), accent-ring (mic), accent fill (send)
  states    default, hover, focus-visible (2px --border-focus ring, system-wide)
  a11y      real <button>, focus rings from the global :focus-visible rules

Cards (`.action-card`) - focus-visible ring accent-cyan, hover elevate.
Modals (`.modal-dialog`) - motion disabled under prefers-reduced-motion.
Toasts - success/warning/error roles from tokens.

## Not changed (deliberately)

- Status dashboard palette: its own greys already pass on its near-black bg.
- React bundle CSS (`assets/index-*.css`): owned by the built app; the override
  layer `myraa_v6_styles.css` is the supported surface.
- Fonts: Outfit / JetBrains Mono / Orbitron / Rajdhani already open-licensed.
