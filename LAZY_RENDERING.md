# Lazy Rendering in the Sleeves View

This document explains the lazy rendering approach added to the "All sleeves" view and how it works.

## Why this was needed
Rendering every sleeve section at once is expensive because each section contains multiple charts and rolling metrics. When many sleeves are present, switching to the "All sleeves" mode can cause long blocking renders.

To keep the UI responsive while still using the **global page scroll** (not a local/virtualized list), we render sections only when they approach the viewport.

## Summary of the approach
We implemented a lightweight lazy-render mechanism using `IntersectionObserver`:

- Each sleeve section is wrapped in a `LazySection` component.
- `LazySection` renders a placeholder box with fixed height until the wrapper scrolls into view.
- When the section intersects the viewport (with some margin), it renders the full content and never reverts.
- When generating a PDF (via print), lazy rendering is **disabled** to ensure everything renders before printing.

This avoids the heavy cost of rendering all charts at once, but keeps the global scroll behavior.

## Key files
- `src/ui/ReportView.tsx` — contains the `LazySection` component and integration in the Sleeves tab.

## How `LazySection` works
A simplified view of the logic:

- A wrapper `div` is observed with `IntersectionObserver`.
- Before it is visible, we render a placeholder: a blank box with `height: ALL_SLEEVES_PLACEHOLDER_HEIGHT`.
- When the wrapper becomes visible (within `rootMargin`), we render the real content.

Key settings:

- `rootMargin: '200px'` means the section starts rendering **before** it reaches the viewport, reducing pop-in.
- `placeholderHeight` is set to `720` to roughly match the height of a full sleeve section.

## Integration details
In the Sleeves tab:

- **Tabbed mode** renders only the selected sleeve (no lazy logic needed).
- **All sleeves** mode renders every sleeve, each wrapped in `LazySection`:

```
<LazySection
  placeholderHeight={ALL_SLEEVES_PLACEHOLDER_HEIGHT}
  disabled={isPrinting}
>
  <Stack>
    ...charts and metrics...
  </Stack>
</LazySection>
```

## Print/PDF behavior
When the "Generate PDF report" button is clicked:

- The view switches to "All sleeves".
- `isPrinting` is set to `true`.
- `LazySection` is disabled (`disabled={isPrinting}`), so all content renders immediately.
- `window.print()` is triggered.

After printing, the previous sleeve view mode is restored.

## Notes / tradeoffs
- Lazy rendering is not full virtualization; all sections still exist in the DOM as placeholders.
- Placeholder height is a fixed estimate. If the section layout changes significantly, adjust:
  - `ALL_SLEEVES_PLACEHOLDER_HEIGHT`
  - `rootMargin`
- This approach is compatible with global scroll and print/export flows.

## How to adjust
- To render sooner or later, change `rootMargin` in `LazySection`.
- To reduce layout shift, tune `ALL_SLEEVES_PLACEHOLDER_HEIGHT`.
- To always render everything, set `disabled={true}` or remove `LazySection`.
