# Portfolio Risk Monitor Engineering Guide

## Project Priorities

This repository is a React and TypeScript portfolio risk monitoring application.
Prioritize, in order:

1. Correct financial calculations and status semantics.
2. Behavior-preserving, reviewable changes.
3. Clear separation between domain logic, orchestration, and presentation.
4. Regression coverage that supports future refactoring.
5. Accessible and predictable user interfaces.

Do not trade correctness or explicit domain behavior for a shorter implementation.

## Repository Map

- `src/engine/`: pure parsing, calculation, attribution, portfolio, and status logic.
- `src/store/`: Zustand state and IndexedDB persistence.
- `src/workers/` and `src/ui/report-view/workers/`: worker protocols and expensive background calculations.
- `src/ui/` and `src/routes/`: React orchestration and user interface.
- `src/ui/report-view/components/`: report views and presentation-oriented components.
- `src/ui/report-view/components/portfolio/`: prop-driven interactive portfolio panels.
- `src/ui/report-view/components/pdf/`: PDF page composition and PDF-specific layout.
- `src/ui/report-view/hooks/`: cohesive report feature state and orchestration.
- `src/ui/report-view/portfolio/`: pure view-level portfolio calculations and weight rules.
- `src/ui/report-view/helpers/`: focused chart, label, regression, and series helpers.
- `src/test/`: shared render helpers, setup, mocks, and report fixtures.
- `src/**/__tests__/`: unit, component, and integration tests.

Keep these ownership boundaries clear when adding or moving code.

## Working Process

Before changing code:

1. Read the relevant implementation, types, nearby tests, and package scripts.
2. Inspect the current Git status and preserve unrelated user changes.
3. Identify the observable behavior, public interfaces, and financial invariants affected.
4. Run the smallest useful baseline test or check for the area.
5. For risky refactors, add characterization tests before changing structure.

During implementation:

- Make the smallest coherent change that fully handles the request.
- Keep structural refactoring separate from intentional behavior changes when practical.
- Reuse sound local patterns, test helpers, fixtures, and types.
- Do not weaken TypeScript, lint, accessibility, or tests to make a change pass.
- Do not update tests only to mirror implementation details.
- Do not add a production dependency unless the repository cannot reasonably solve the problem already.

After implementation:

1. Run targeted tests while iterating.
2. Format changed files.
3. Run lint on changed files.
4. Run the full test suite for any production-code change.
5. Run full lint and the production build for nontrivial changes.
6. Fix failures caused by the change and rerun the failed checks.
7. Inspect the final diff for accidental edits, debug output, dead code, unsafe assertions, skipped tests, and unrelated formatting.
8. Report exactly what passed, what failed, and which checks were not run.

Establish the baseline before attributing a repository-wide failure to the current change. Do not hide or normalize pre-existing failures; report them separately.

## Project Commands

Use npm because `package-lock.json` is the repository lockfile.

- Targeted test: `npm test -- --run path/to/file.test.tsx`
- Full tests: `npm test -- --run`
- Lint changed files: `npx eslint path/to/file.ts path/to/file.tsx`
- Full lint: `npm run lint`
- Format changed files: `npx prettier --write path/to/file`
- Formatting check: `npx prettier --check .`
- TypeScript and production build: `npm run build`
- Development server: `npm run dev`

Never claim a command passed unless it was executed successfully.

## Architecture

### Module Cohesion

Organize code by responsibility and reason to change, not by file length alone.

- Before adding logic to a feature component, classify it as domain calculation, view-level transformation, stateful workflow, orchestration, or presentation.
- Keep one canonical implementation of each calculation. Search existing engine and feature modules before adding another version.
- Do not create catch-all `helpers.ts` or `utils.ts` modules. Use focused names such as `series`, `labels`, `regression`, `portfolioWeights`, or the relevant domain concept.
- Co-locate a helper with its feature until it is genuinely shared. Move reusable financial behavior into `src/engine/`.
- Treat file length as a diagnostic signal, not a refactoring target. Moving an entire mixed component into one large hook is not an architectural improvement.
- Preserve a small public surface. Export only functions and types required by real callers.

### Domain Logic

Keep portfolio calculations, parsing, alignment, sorting, metrics, drawdown, attribution, and status rules in pure TypeScript outside React.

- Put reusable financial logic in `src/engine/`.
- Make inputs and outputs explicit and typed.
- Keep calculations deterministic and free of stores, DOM APIs, React, and presentation formatting.
- Keep display formatting out of domain calculations.
- Test boundary conditions close to the domain function.

Do not add substantial inline calculations to `ReportView`, `PortfolioTab`, `Wizard`, or another component. Extract and test them first.

Interactive views and PDF output must not maintain separate implementations of the same calculation. Share tested data preparation and formatting-independent rules; keep only output-specific composition separate.

### Presentation Components

Presentation components:

- Render typed values received through props.
- Receive event callbacks rather than mutating stores directly.
- May own state that is purely visual and local, such as an open menu or temporary input draft.
- Do not parse files, build reports, access persistence, create workers, or know store implementation details.
- Must be renderable with small fixtures and testable through user-visible behavior.

Prefer explicit props and focused view models. Avoid very broad contexts or components that accept many unrelated modes.

### Containers and Orchestration

Feature or container components:

- Read Zustand selectors and connect domain state to views.
- Coordinate workers, file APIs, routing, persistence hydration, and user commands.
- Translate domain data into presentation props.
- Own loading, empty, error, and unavailable-state decisions.
- Keep orchestration visible, but move pure transformations out.

Do not create a container/view pair for every trivial component. Extract a boundary when it removes business logic, side effects, substantial transformation, reuse pressure, or testing difficulty from the view.

For report features:

- `ReportView` assembles report-level dependencies and provider values.
- Tab components coordinate focused hooks and presentation sections.
- Hooks own cohesive editable workflows or derived feature analytics.
- Portfolio and PDF section components render typed props and emit commands.
- PDF page components own page boundaries and PDF-only layout.

Do not bypass these boundaries by importing stores or broad contexts into presentation sections.

### Hooks

Use custom hooks for cohesive reusable stateful behavior, not merely to reduce file length.

- Hooks may coordinate React state, stores, workers, or browser APIs.
- Hooks must expose domain-oriented values and commands, not JSX.
- Keep pure calculations as ordinary functions.
- Avoid hiding a large component inside one equally large hook.
- Group returned values and commands by a cohesive workflow when a hook exposes several operations.
- Keep independent workflows in separate hooks rather than growing one feature-wide hook.

### Context

- Prefer explicit props inside a feature subtree.
- Use context at stable feature boundaries where many descendants need the same contract.
- Split contexts by consumer domain, such as navigation, tables, sleeves, portfolio, and PDF.
- A consumer should not subscribe to unrelated report state.
- Do not reintroduce a single all-purpose report context as new features are added.
- Keep provider and fixture contracts aligned so focused consumers remain easy to test.

### State Ownership

- Keep state as close as possible to its consumers.
- Use component state for temporary interaction state.
- Use Zustand for genuinely shared workflow, report, underlying-data, or UI state.
- Persist only state that must survive reloads.
- Do not copy Zustand data into local state solely to transform or display it.
- Do not store values that can be derived during render.
- Avoid competing sources of truth.
- Treat persistence hydration as a distinct state and preserve route-guard behavior.

### Effects

Use effects only to synchronize with an external system such as a worker, timer, observer, browser API, or persistent store.

Do not use effects for:

- Deriving values from props or state.
- Responding to a direct user action that belongs in an event handler.
- Keeping two pieces of React state synchronized.
- Ordinary data transformation.
- Resetting state when a clearer owner, initializer, reducer, or component key solves it.

Every effect must use correct dependencies, clean up resources, avoid stale closures, and tolerate React development setup/cleanup cycles. Terminate workers and clear timers, listeners, and observers.

### Memoization

Do not add `useMemo`, `useCallback`, or `memo` automatically.

Use memoization for measured expensive work, stable identity required by an API, or an established calculation hot path. Dependencies must be complete and stable. Never silence hook dependency warnings without resolving the underlying ownership or identity problem.

## React and UI Rules

- Use semantic HTML and MUI components consistently with the existing theme.
- Controls must have accessible names and keyboard behavior.
- Give period filters one feature-level owner. Derive every period-sensitive chart, summary, table, and diagnostic from the same range, while clearly distinguishing current-snapshot indicators that should not change with that range.
- Keep direct interaction feedback urgent. When recalculation is expensive, defer only the non-urgent derived update with a React transition, expose an accessible pending state, and do not present stale results as current without indication.
- Do not communicate risk or status through color alone; include text or another semantic indicator.
- Cover responsive behavior when changing report grids, tables, dialogs, tabs, or charts.
- Keep MUI `sx` styling focused and avoid duplicating shared styles.
- Keep ECharts option builders pure and separate from chart components.
- Handle empty and non-finite chart data without producing misleading visuals.
- Keep PDF-only presentation separate from interactive screen behavior.
- Avoid components that mix data preparation, store access, worker orchestration, PDF generation, and large JSX trees. Refactor such components incrementally behind tests.

## TypeScript Rules

- Preserve strict typing and the browser-only app type environment.
- Do not introduce `any` when a safe type can be expressed.
- Use `unknown` for untrusted data and narrow it explicitly.
- Use discriminated unions for mutually exclusive states and worker messages.
- Prefer exhaustive handling for status and request variants.
- Avoid non-null assertions and type assertions used only to silence the compiler.
- Keep exported APIs intentionally small and stable.
- Represent financial units clearly in names and types where ambiguity is possible.

## Testing Policy

Tests are part of the implementation.

### Test by Responsibility

- Test `src/engine/` calculations and transformations with focused unit tests.
- Test components with Vitest, React Testing Library, `user-event`, and `renderWithTheme`.
- Test routing and store integration at feature boundaries.
- Test worker request/response behavior at the protocol boundary.
- Test persistence migration and hydration behavior separately from component rendering.

### Test Observable Behavior

- Query by accessible role and name first.
- Then use labels and visible text.
- Use test IDs only when no meaningful user-facing selector exists.
- Avoid CSS-structure selectors and implementation-specific class names.
- Prefer user events over direct handler invocation.
- Mock external boundaries such as workers, IndexedDB, browser observers, file APIs, time, PDF capture, and ECharts.
- Do not mock internal components unless isolating a feature boundary is the purpose of the test.
- Avoid large snapshots.

### Required Coverage

For a bug fix, add a regression test that demonstrates the bug when practical.

For a refactor:

- Preserve public behavior and component contracts.
- Add characterization coverage before moving insufficiently covered behavior.
- Do not rewrite tests merely because implementation moved.
- Keep parent integration tests as characterization coverage.
- Add direct React Testing Library coverage for extracted interaction-heavy presentation components.
- Do not add isolated tests for trivial wrappers that have no behavior or meaningful rendering contract.
- Treat a failed exact accessible-name query as a possible semantic markup defect before weakening the query.

Cover applicable states:

- persistence not yet hydrated;
- empty or missing input;
- valid input;
- malformed or partial input;
- loading or worker activity;
- error and recovery;
- unavailable underlying data;
- unknown or non-finite metrics;
- dialogs, filters, selections, and reset behavior.

## Portfolio Monitoring Correctness

Changes to calculations, parsing, charts, status, filtering, or report generation require explicit invariant review.

- Preserve the distinction between decimal returns and displayed percentages.
- Preserve drawdown sign and unit conventions.
- Align series by timestamp rather than array position unless the contract explicitly guarantees alignment.
- Keep ordering deterministic for equal values and duplicate timestamps.
- Handle empty, one-point, constant, missing, non-finite, and zero-denominator inputs.
- Verify trading-day window boundaries and minimum-observation rules.
- Keep realized and in-trade/MTM drawdown semantics distinct.
- Treat sleeve weights as return-exposure multipliers applied to each sleeve's contribution
  against the preceding baseline portfolio equity. Do not reinterpret them as fixed-dollar
  historical PnL multipliers or re-denominate them against a custom weighted equity curve.
- Keep composition selection and weighting orthogonal: `1.00` preserves a sleeve's baseline
  contribution, `0.00` removes it, and all sleeves at `1.00` must reconcile with the base
  portfolio within floating-point tolerance.
- Measure the first MTM observation against initial capital so an opening in-trade loss is not
  silently discarded.
- Preserve base portfolio data when applying filtered composition or custom weights.
- Never present missing or unknown evidence as a healthy status.
- Keep sleeve attribution scoped correctly by symbol, position, and magic identifier.
- Treat imported file contents and persisted data as untrusted input.
- Keep PDF obfuscation from altering the underlying report data.

When one of these rules changes intentionally, document the new contract in tests.

## Workers and Browser Boundaries

- Type worker messages as discriminated request and response unions.
- Include request identifiers when stale responses could overwrite newer work.
- Handle worker errors and termination.
- Keep expensive pure computation callable outside the worker so it can be unit tested.
- Revoke object URLs and release browser resources.
- Do not access Node-only globals from browser production code or browser-compiled tests.

## Dependency Changes

Before adding or upgrading a package:

1. Check whether the existing stack already provides the capability.
2. Verify the current supported and patched version from a primary source.
3. Review peer dependencies, Node requirements, bundle impact, and migration notes.
4. Make explicit version changes and update only `package-lock.json`.
5. Run `npm audit`, tests, lint, and the production build.
6. Report unrelated remaining advisories separately.

Do not use `npm audit fix --force` without reviewing and validating every major-version change.

## Refactoring Rules

A refactor must preserve behavior unless the request explicitly changes it.

Before a substantial refactor:

1. Identify behavioral invariants and exported interfaces.
2. Establish a passing targeted baseline.
3. Inventory local calculations, state workflows, effects, context dependencies, and visible sections.
4. Define the intended module ownership before moving code.
5. Add characterization tests where coverage is weak.
6. Choose one ownership boundary to improve.
7. Keep intermediate steps buildable and tested.

Preferred direction:

- Large mixed component -> container plus focused presentation components.
- Inline financial transformation -> pure typed engine/helper function.
- Cohesive worker or browser lifecycle -> focused custom hook.
- Broad context -> smaller domain-focused contexts or explicit props.
- Duplicated status/calculation logic -> one tested domain function.
- Implicit state combinations -> discriminated union or reducer.

Do not:

- Rewrite an entire report feature when incremental extraction is sufficient.
- Change behavior, structure, naming, and styling simultaneously.
- Move code only to reduce file length.
- Add forwarding helpers or abstractions with no clear ownership benefit.
- Create generic frameworks inside the application.
- Duplicate a calculation for screen, PDF, filtered, or custom-portfolio output.
- Replace one broad component with one broad hook or context.

After moving code, search for obsolete imports, old broad context hooks, duplicate formulas, and unreachable compatibility paths before considering the refactor complete.

## Definition of Done

A production-code change is complete only when:

- the requested behavior is implemented;
- domain and UI responsibilities remain clear or improve;
- relevant regression coverage exists;
- targeted tests pass;
- changed files pass formatting and lint checks;
- the full test suite passes;
- full lint and the production build were run for nontrivial changes;
- failures are fixed or clearly identified as pre-existing;
- no accidental changes remain;
- verification and limitations are reported honestly.

## Repository Skills

Use the applicable repo skill for nontrivial work:

- `$safe-react-change`: features, fixes, and general React/TypeScript changes.
- `$react-refactor`: structural refactors or preparation for future refactoring.
- `$monitoring-ui-design`: Material UI layout, visual hierarchy, interaction design, responsive behavior, accessibility, and UX refinement.
- `$portfolio-monitor-validation`: calculations, status logic, parsing, portfolio composition, charts, persistence, workers, or report behavior.

Multiple skills may apply to the same task. Follow this root file at all times; skills add workflow detail rather than replacing these rules.
