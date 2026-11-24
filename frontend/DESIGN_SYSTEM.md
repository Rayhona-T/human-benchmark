# HUMAN BENCHMARK — Frontend Design System

## Visual direction

The interface uses a refined scientific aesthetic: deep ink text and surfaces,
light neutral canvas colors, one restrained blue accent, precise borders, small
radius values, and limited shadow. The goal is clarity and credibility rather
than a generic dashboard or futuristic visual style.

## Tokens

Design tokens are centralized as CSS custom properties in
`src/styles/index.css`.

- Colors include ink, neutral, accent, success, warning, error, information,
  disabled, and semantic text/surface/border values.
- Typography uses local system font stacks; no external font service is needed.
- The monospace stack is available for protocol IDs and technical metadata.
- Spacing uses a shared 0.25rem-based scale.
- Radii, shadows, transitions, z-index layers, and focus-ring values are
  centralized.
- Reduced-motion preferences disable nonessential transitions and animation.

## Typography

- Primary: system sans-serif stack
- Monospace: platform-compatible monospace stack
- Headings use a tight line height and a responsive primary heading size.
- Body copy uses a 1.5 line height.
- Labels and controls use 44px minimum interaction targets where applicable.

## Component inventory

- `Button`: primary, secondary, ghost, danger, loading, and disabled states
- `TextLink`: keyboard-visible text link
- `Card`: standard and elevated surfaces
- `Badge`: neutral, success, warning, error, and information tones
- `Divider`: lightweight section separator
- `Label`, `TextInput`, `Select`, `Checkbox`: labeled form controls
- `Feedback`: success, warning, error, and information status messages
- `Loading`: accessible loading status
- `EmptyState`: empty result/state presentation

## Accessibility conventions

- Components use semantic HTML and explicit accessible names.
- The global focus ring is visible and offset from controls.
- Error feedback is exposed to assistive technology.
- Loading and feedback states have appropriate live roles.
- Disabled controls use native `disabled` behavior.
- Meaning is not communicated by color alone.
- Layout and component styles support narrow viewports.
- WCAG 2.2 AA is a target, not a claim of completed compliance.

## Responsive conventions

The showcase collapses multi-column grids below 720px. Components use wrapping,
full-width form inputs, and 44px minimum controls. No experiment layout or
navigation behavior is implemented here.

## Component preview

Start the development server and open `/design-system`. This route is a
development preview and does not add product navigation or implement the
application shell. It exists in development builds only: production builds
leave out the route and the page (Cycle 10 Task 10.4), and the path shows the
not-found page there.
