# MYRAA Motion & Micro-Interaction Rules

## Principles

Motion in MYRAA is purposeful, subtle, and responsive. It guides attention and communicates state changes without causing cognitive fatigue or motion sickness.

## Duration & Curves

- **Micro-interactions (Buttons, Toggles, Links)**:
  - Duration: `100ms - 150ms`
  - Properties: `background-color`, `border-color`, `box-shadow`
  - Easing: `cubic-bezier(0.16, 1, 0.3, 1)`

- **Surface Transitions (Drawers, Modals, Menus)**:
  - Duration: `200ms - 250ms`
  - Properties: `opacity`, `transform` (`scale(0.98)` to `scale(1)`)
  - Easing: `cubic-bezier(0, 0, 0.2, 1)` (Enter), `cubic-bezier(0.4, 0, 1, 1)` (Exit)

- **Layout Shifts**:
  - Avoid animating layout dimensions (`width`, `height`, `margin`) directly. Prefer `transform: translateX()` or `transform: translateY()`.

## Accessibility (Reduced Motion)

When the user specifies `prefers-reduced-motion: reduce`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
All transitions snap immediately into their final visual state.
