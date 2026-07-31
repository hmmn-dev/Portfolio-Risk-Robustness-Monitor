---
name: portfolio-monitor-validation
description: Validate portfolio-monitoring calculations and user behavior in this repository. Use for changes to deal or underlying-data parsing, attribution, returns, drawdown, MAR, Sharpe, regression, rolling metrics, risk status, portfolio composition, charts, PDF reports, Zustand persistence, file workflows, or web workers.
---

# Portfolio Monitor Validation

Protect the domain semantics that make the report trustworthy. Use explicit invariants and focused tests rather than relying only on rendered output.

## Identify the Contract

1. Trace input data through parsing, engine functions, stores or workers, and the rendered report.
2. Write down units, timestamp assumptions, missing-data behavior, ordering, and status thresholds.
3. Identify whether the change affects the base portfolio, a filtered/custom portfolio, realized drawdown, or in-trade/MTM drawdown.
4. Establish a targeted test baseline.
5. Add a regression or characterization test before changing ambiguous behavior.

Do not infer a financial convention from a label alone. Verify it in types, calculations, fixtures, and current tests.

## Calculation Checks

Cover applicable boundary cases:

- empty and one-point series;
- all-zero or constant series;
- positive-only and negative-only series;
- `NaN`, infinite, missing, and zero-denominator inputs;
- unsorted, duplicate, missing, or non-overlapping timestamps;
- exact threshold and window boundaries;
- too few observations;
- extreme values and floating-point tolerance.

Verify these invariants:

- Decimal returns are not confused with displayed percentages.
- Drawdown sign and units remain consistent.
- Series align by timestamp when dates may differ.
- Stable ordering is deterministic when comparison values are equal.
- Trading-day windows and minimum-observation rules preserve their intended boundaries.
- Realized and MTM drawdown remain distinct.
- Filtered composition and custom weights do not mutate the base report.
- Unknown or insufficient evidence never becomes a healthy status.
- PDF obfuscation changes labels only, never calculation data.
- Interactive and PDF output consume the same tested calculation when their financial semantics are identical.
- Base, filtered, and custom portfolio paths delegate shared formulas rather than maintaining copies.

Test pure rules directly in `src/engine/__tests__/` or the nearest focused helper test.

## Custom Composition And Weighting

Treat portfolio weights as a financial contract, not a generic numeric transform:

- A sleeve weight multiplies that sleeve's return contribution. `1.00` preserves the baseline
  contribution and `0.00` removes it.
- Build each contribution against the preceding unmodified baseline portfolio equity, using
  initial capital for the first MTM observation. Do not scale the full historical equity curve or
  use accumulated custom weighted equity as the denominator.
- Select sleeves independently from weighting them. Exclude unselected sleeve PnL while retaining
  the baseline timeline and denominator required by the contribution-return contract.
- Apply the same weighting meaning to realized and MTM paths while preserving their distinct source
  data and observation frequency.
- Align independently constructed contribution series by timestamp. Array-position alignment is
  acceptable only when one replay explicitly guarantees a shared timeline.

Start changes with a small hand-calculated fixture. Cover the applicable invariants:

- all sleeves at `1.00` reconcile with the base portfolio within floating-point tolerance;
- `0.00` removes a sleeve and asymmetric weights such as `2.00` and `0.50` scale independently;
- a high-growth history still shows the expected exposure change instead of masking it through a
  larger custom-equity denominator;
- a selected subset from a large portfolio excludes every unselected contribution;
- unordered deals, the first marked loss, concurrent positions, and open-to-realized transitions
  remain deterministic;
- multiple symbols or contribution records belonging to one sleeve are accumulated, not
  overwritten.

## Parsing and Attribution Checks

For imported deals or underlying files, cover applicable cases:

- supported delimiters, headers, encoding, BOM, and line endings;
- malformed, empty, and partial rows;
- numeric and textual entry variants;
- symbol normalization and file-name inference;
- attribution scoped by symbol, position, magic identifier, and sleeve;
- duplicate candles and deterministic chronological ordering;
- missing required underlying symbols.

Treat file and persisted contents as untrusted. Test fallback behavior explicitly.

## UI Checks

Use React Testing Library and `user-event` to verify:

- persistence hydration before routing;
- upload, replace, remove, and reset workflows;
- loading and worker activity;
- empty, partial, unavailable, error, and recovery states;
- tabs, dialogs, filters, composition, weights, and drawdown modes;
- accessible names and keyboard operation;
- risk/status text in addition to color;
- chart and grid behavior with missing or non-finite data;
- PDF settings and obfuscation behavior at the component boundary.
- exact dialog and control accessible names after presentation extraction.

Prefer `renderWithTheme` and shared report fixtures. Query by role and accessible name. Mock workers, IndexedDB, browser observers, ECharts, file APIs, PDF capture, and object URLs only at their boundaries.

## Store and Worker Checks

- Preserve Zustand hydration and migration behavior.
- Keep persisted state backward compatible or add migration coverage.
- Type worker requests and responses.
- Use request identifiers when obsolete responses can arrive late.
- Test error messages and ignored stale responses where applicable.
- Terminate workers and release browser resources.
- Keep worker computation accessible as pure functions when practical.

## Validate

Run the most relevant unit and component tests during implementation, then:

1. `npm test -- --run`
2. `npm run lint`
3. `npm run build`
4. `git diff --check`

Inspect changed fixtures to ensure they represent the intended units and dates. Report the invariants tested, user states covered, and any domain assumption that remains uncertain.
