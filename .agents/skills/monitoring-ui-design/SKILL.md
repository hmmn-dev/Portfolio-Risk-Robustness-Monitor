---
name: monitoring-ui-design
description: Design and refine the React and Material UI experience in this portfolio monitoring repository. Use for layouts, visual hierarchy, dashboards, report tabs, portfolio summaries, tables, charts, dialogs, forms, controls, responsive behavior, accessibility, dark mode, or any prompt involving UI design or UX. Follow coherent established patterns after inspecting them, but improve weak or unfinished patterns instead of copying them blindly.
---

# Monitoring UI Design

Build a quiet, scan-first interface for repeated portfolio monitoring work. Use the existing MUI theme and component architecture as a foundation, not as proof that every current design decision is correct.

## Inspect Before Designing

1. Read `AGENTS.md` and the relevant architecture skills.
2. Inspect `src/theme.ts`, the complete user flow, neighboring screens, shared components, and UI tests.
3. Identify the user's primary decision, secondary evidence, available actions, and exceptional states.
4. Distinguish a stable design convention from a locally unfinished implementation.
5. State what should remain visually consistent and what needs deliberate improvement.

Do not treat `PortfolioSummaryPanel` or another existing screen as a canonical pattern merely because it exists. When a pattern is weak, improve it coherently and consider whether the theme or a shared component should change.

## Product Character

- Design for analysts repeatedly scanning, comparing, filtering, and acting on monitoring data.
- Prefer restrained, information-dense layouts over marketing composition, decorative illustration, or oversized typography.
- Make the portfolio, risk state, freshness, and available action apparent without explanatory feature copy.
- Use whitespace to establish groups, not to make operational screens sparse.
- Avoid decorative gradients, orbs, nested cards, excessive chips, and many equal-weight panels.
- Do not make every value a card. Use compact metric grids, tables, definition layouts, and clear section bands.

## Information Hierarchy

For each view, order information by the user's decision process:

1. Current state or outcome.
2. Material risk, exception, or freshness signal.
3. Supporting trends and comparisons.
4. Diagnostics and technical detail.
5. Relevant actions.

Use one clear page title and restrained section headings. Match typography to the surface: compact panels use compact headings; reserve large display type for true page-level identity.

Do not give primary metrics, regression diagnostics, status counts, warnings, and actions identical visual weight. Group related values and make the most decision-relevant information easiest to scan.

## Material UI Usage

- Use the repository's MUI components, theme tokens, responsive breakpoints, and `sx` conventions.
- Prefer theme palette, spacing, typography, shape, and state colors over hardcoded values.
- If a recurring value is missing from the theme, add a deliberate theme token or shared component instead of repeating local constants.
- Use MUI icons for familiar actions. Use `IconButton` plus a tooltip for compact familiar tools; use icon-and-text buttons for explicit commands.
- Use `Tabs` for views, `ToggleButtonGroup` for exclusive modes, `Switch` or `Checkbox` for binary settings, `Select` or `Menu` for option sets, and inputs for numeric values.
- Prefer established MUI or MUI X controls when they materially improve keyboard, validation, calendar, or responsive behavior. Before adding MUI X, verify Community versus commercial licensing, align its version with the installed MUI X line, and configure shared providers once at the app boundary.
- Use `Paper` only for genuinely bounded tools or sections. Do not nest decorative cards or wrap every subsection in another `Paper`.
- Respect the theme's shape globally. Do not introduce arbitrary local radii to make a surface appear softer.
- Preserve light and dark mode contrast. Status colors must come from semantic theme colors and must include text or icons.

Use component APIs appropriate to the installed MUI version. Do not add another styling system or a production dependency for ordinary layout work.

## Monitoring Semantics

- Distinguish fresh, stale, unknown, unavailable, partial, loading, and failed states.
- Never imply healthy status from absent data.
- Show observation time or age when freshness affects interpretation.
- Keep realized and in-trade drawdown labels explicit, including source timeframe where relevant.
- Keep decimal calculations separate from displayed percentages.
- Explain exposure controls in domain terms: state what `1.00` preserves and whether the value
  scales return contribution, allocation, or fixed notional. In this repository, portfolio sleeve
  weights multiply return exposure; do not leave the meaning implied by a generic `Weight` label.
- Make risk and status readable without color alone.
- Keep warning and error copy concise, specific, and paired with a recovery action when one exists.
- Do not use a generic empty state when permission, unavailable data, filtering, or failure has a different meaning.

## Summary Surfaces

Treat portfolio and sleeve summaries as decision surfaces, not dumps of every available metric.

- Lead with a compact group of primary return and risk metrics.
- Separate portfolio health and exceptions from model diagnostics such as regression.
- Put technical detail below the decision summary or behind progressive disclosure when it is not needed continuously.
- Prefer plain labels such as `Annualized alpha` over raw implementation notation such as `alpha_ann` unless the notation is domain-required.
- Present exposures or betas as structured rows, bars, or a compact table rather than one long sentence.
- Explain non-obvious metrics with a clearly discoverable info control that works on hover and keyboard focus. Give the control an exact accessible name and keep the visible metric label concise.
- Make custom composition or stale-data caveats visible without dominating the whole summary.
- Show `n/a` or unknown states honestly and explain only when the reason is actionable.
- Include comparisons or baselines only when the underlying calculation is trustworthy and available.

Before accepting a summary design, verify that a user can answer quickly: How is the portfolio performing? What is the main risk? Is anything unhealthy or unavailable? What changed from the baseline? Where can I inspect the evidence?

## Layout And Responsive Behavior

- Use stable grids, explicit min/max widths, and responsive `Stack` or CSS grid layouts.
- Keep related content adjacent. Prefer intrinsic or content-sized tracks for a matrix and its legend; use `1fr` only when the resulting empty space is intentional.
- Adapt data density from measured container space. Define readable minimum and bounded maximum dimensions, scale progressively between them, and use scrolling only after the minimum no longer fits.
- Keep container measurement and `ResizeObserver` cleanup in the component, but move reusable sizing decisions into pure tested helpers.
- Keep controls from shifting when labels, loading states, or values change.
- Keep pending, validation, and status feedback from shifting nearby content. Use non-flow feedback for transient global work, or reserve a stable footprint when the message belongs inside the surface.
- Let dense tables scroll horizontally on small screens rather than compressing text beyond readability.
- Reflow toolbars into logical groups on narrow screens; preserve command order and accessible names.
- Keep chart dimensions stable and labels visible. Do not let missing data collapse a chart region unexpectedly.
- Ensure long sleeve names, symbols, translated labels, and large values wrap or truncate intentionally. Use ellipsis for single-line labels and show the full value on hover or focus only when overflow was actually detected.
- Do not scale font size directly with viewport width.

## Time Ranges And Expensive Updates

- Give presets and custom dates one typed range model and one feature-level owner.
- Apply the range consistently to every period-sensitive chart, summary, table, drawdown indicator, correlation matrix, and diagnostic. Keep current-snapshot indicators explicit when they intentionally remain independent.
- Define UTC handling, inclusive end-date behavior, available-data bounds, and reversed or invalid input behavior in a pure tested helper.
- Keep range controls and primary chart feedback immediate. Use `useTransition` for genuinely expensive downstream recalculation, with `aria-busy` and a concise live refresh indicator.
- Use one clear pending signal for one operation. Do not stack redundant spinners, progress bars, banners, or overlays that communicate the same state.
- Keep stale sections visually identifiable while a transition is pending; do not replace usable content with a blank loading state.
- Group date pickers and presets as one responsive control. Preserve logical command order when they stack and keep stable spacing between subgroups.

## Charts And Dense Matrices

- Apply one selected time range to related equity and drawdown charts.
- Use restrained theme-aware chart fills when they improve reading the series shape. Check opacity and contrast separately in light and dark modes.
- Keep correlation values visible by default when they materially improve scanning, while retaining an explicit toggle for users who prefer color-only comparison.
- Keep matrix legends beside compact matrices instead of pushing them to a remote page edge.
- Let small matrices use more generous cells, then reduce cell and value-label size progressively toward a readable baseline as the portfolio grows.
- Preserve horizontal scrolling for matrices that cannot fit at the minimum readable cell size.

## Accessibility

- Use semantic HTML before ARIA and preserve logical heading order.
- Give dialogs one concise accessible title; do not include alerts or actions inside the title relationship.
- Give every control an accessible name and visible focus state.
- Support keyboard operation for tabs, dialogs, menus, toggles, and table actions.
- Associate errors and helper text with their controls.
- Preserve the accessible field structure supplied by MUI X. Test both the labeled field group and its form value rather than assuming a conventional single-input DOM.
- Check contrast in light and dark modes, including charts, disabled controls, focus, and status indicators.
- Treat a failed exact role/name query as a potential semantic defect before weakening the test.

## Component Boundaries

- Keep presentation components driven by typed props and callbacks.
- Keep calculations, status aggregation, and view-model construction outside JSX.
- Extract a shared component only for a stable repeated visual pattern, not merely similar markup.
- Keep interactive and PDF composition separate. Reuse calculations and truly identical presentational sections only when their constraints match.
- Combine with `$react-refactor` when design work exposes mixed ownership, and with `$portfolio-monitor-validation` when displayed financial or status semantics could change.

## Verification Workflow

1. Add or update React Testing Library coverage for user-visible behavior and accessible names.
2. Test pure responsive sizing and date-range rules directly; test calendar opening, defaults, toggles, truncation, and pending states through user behavior.
3. Exercise loading, empty, unavailable, error, partial, and success states that apply.
4. Start the development server and visually inspect the changed flow at representative desktop and mobile sizes.
5. Exercise hover, focus, keyboard, dialogs, menus, toggles, scrolling, and long-content cases.
6. Inspect both light and dark modes when the surface supports them.
7. Verify PDF output separately when shared presentation code changes.
8. Run targeted tests, full tests, lint, build, and `git diff --check` according to `AGENTS.md`.

Report the hierarchy and UX decisions made, the states inspected, viewport coverage, automated checks, and any remaining design limitation. Do not claim visual verification without actually opening the rendered interface.
