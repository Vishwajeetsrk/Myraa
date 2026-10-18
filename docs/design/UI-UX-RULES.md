# MYRAA UI/UX Implementation Rules

## Mandatory Rules

1. **No Emojis Anywhere**:
   - Every status message, toast, tooltip, table cell, or button icon MUST be an inline SVG or approved ASCII fallback (`[OK]`, `[!]`, `[*]`, `[+]`, `[-]`, `[>]`).
   - Zero Unicode characters in the range `U+1F000` to `U+1FAFF`.

2. **Contrast & Legibility**:
   - Contrast between text and background must meet or exceed WCAG AA standards (4.5:1 minimum).
   - Never use low-contrast grey-on-dark for essential informative content.

3. **Responsive Parity**:
   - Desktop and mobile layouts must provide access to the same core functionality.
   - Use CSS media queries at breakpoints:
     - Mobile: `< 640px` (Collapsible bottom sheet or drawer)
     - Tablet: `640px - 1024px` (Compact navigation rail)
     - Desktop: `> 1024px` (Full expanded sidebar navigation)

4. **Keyboard Accessibility**:
   - All interactive controls (`button`, `input`, `a`, `select`) must have visible `:focus-visible` outlines matching `--border-active`.
   - Modals and drawers must trap focus and close on `Escape`.
