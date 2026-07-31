---
name: react-refactor
description: Prepare and perform behavior-preserving React refactors in this repository, especially large components, mixed business and presentation logic, broad contexts, state ownership problems, hook extraction, and store or worker orchestration. Use when restructuring ReportView, PortfolioTab, Wizard, report components, hooks, or feature boundaries without intentionally changing user behavior.
---

# React Refactor

Improve ownership and testability incrementally while keeping the application behavior stable.

## Establish Safety

1. Read `AGENTS.md` and inspect the complete feature path, not only the target file.
2. Identify exported APIs, store contracts, context values, worker messages, and user-visible behavior.
3. Run targeted tests and record the baseline.
4. Add characterization tests for behavior that is important but insufficiently covered.
5. Separate any requested behavior change from the structural refactor.

Do not begin a large move while observable behavior is ambiguous.

## Map Before Moving

Inventory the target before editing:

1. List local pure calculations and transformations.
2. List independent state or draft workflows.
3. List effects and external-system boundaries.
4. List visible UI sections and output-specific layouts.
5. List context fields and the consumers that actually need them.
6. Choose the target owner for each responsibility.

Use focused module names. Do not replace a large component with a catch-all `helpers.ts`, `utils.ts`, one feature-wide hook, or one feature-wide context.

Search for an existing calculation before extracting a new one. Keep one tested implementation for interactive views, filtered/custom portfolios, and PDF output whenever their semantics are identical.

## Choose an Ownership Boundary

Classify code before moving it:

- **Domain function:** deterministic parsing, calculation, alignment, sorting, status, or transformation. Keep it in `src/engine/` or a focused pure helper.
- **Presentation component:** renders typed props and emits callbacks. It does not know Zustand, IndexedDB, workers, file parsing, or report construction.
- **Feature/container component:** reads stores, coordinates commands, selects view state, and maps domain results to presentation props.
- **Custom hook:** owns one cohesive reusable lifecycle involving React state or an external system. It returns values and commands, not JSX.
- **Store:** owns genuinely shared or persisted client state, not temporary view drafts or derived values.
- **Output composition:** owns screen or PDF layout boundaries while reusing shared calculations and truly identical presentation sections.

Do not create a container/view pair for a trivial component. Extract only when the boundary reduces mixed responsibilities, side effects, transformation, reuse pressure, or testing difficulty.

## Refactor in Safe Order

Prefer this sequence:

1. Record the ownership map and preserved behavior.
2. Extract pure financial or formatting-independent logic and add unit tests.
3. Stabilize types and explicit input/output contracts.
4. Extract each cohesive state workflow or external lifecycle into a focused hook when useful.
5. Create presentation components around existing user-visible sections.
6. Separate output composition, such as interactive panels and PDF page boundaries.
7. Leave a small feature container that wires hooks, domain values, and callbacks.
8. Narrow broad contexts by consumer domain or replace them with explicit props.
9. Remove obsolete code only after callers and tests have moved.
10. Search for old imports, broad context hooks, duplicate formulas, and dead compatibility paths.

Keep every intermediate step compiling and tested.

## React Constraints

- Do not use effects to derive state or synchronize React state with React state.
- Prefer event handlers, render-time derivation, initializers, reducers, or clearer component ownership.
- Avoid copying store values into component state unless the user is editing an independent draft.
- Diagnose ownership before optimizing rerenders. Move rapidly changing form or dialog drafts to the nearest focused owner before adding memoization.
- Do not hide a large component inside an equally large custom hook.
- Do not hide unrelated editable workflows inside one hook.
- Do not memoize automatically; use memoization only for expensive work or required stable identity.
- Memoize only verified expensive boundaries whose inputs are stable and immutable. Add render-count regression coverage when rerender isolation is part of the fix.
- Remember that `useTransition` changes update priority rather than moving calculations off the main thread. Close urgent UI first and transition derived state; use a worker when the calculation itself still blocks interaction materially.
- Keep hook dependencies complete.
- Preserve accessible names, keyboard behavior, responsive layout, and status semantics.
- Keep ECharts option building and financial calculations pure.
- Keep interactive report and PDF presentation concerns separate.
- Reuse shared pure calculations between interactive and PDF output instead of copying formulas.
- Keep contexts focused by consumer domain; presentation components should prefer typed props.

## Tests During Refactoring

- Keep behavior tests stable while implementation moves.
- Test extracted pure functions directly.
- Keep parent integration tests as characterization coverage.
- Test interaction-heavy presentation components directly with representative props and user events.
- Skip isolated tests for trivial forwarding wrappers with no behavior.
- Test the container at store, route, worker, or persistence boundaries.
- Mock external systems rather than extracted internal components by default.
- Avoid snapshots that make structural movement look like behavioral change.

After each extraction, run the narrow relevant tests. At completion run:

1. `npm test -- --run`
2. `npm run lint`
3. `npm run build`
4. `git diff --check`

## Review

Verify that:

- no behavior or public contract changed unintentionally;
- responsibilities are clearer, not merely distributed across more files;
- the container is orchestration-focused;
- presentation components are independently renderable;
- pure logic is independently testable;
- helpers are focused by domain rather than collected in a catch-all module;
- interactive and PDF paths do not duplicate calculation logic;
- contexts expose only values required by their consumer domain;
- hooks each own one cohesive workflow;
- there are no forwarding abstractions with no ownership value;
- no duplicate state or calculation path was introduced.

Judge success by ownership and testability, not line-count reduction. Report preserved invariants, new boundaries, tests used as safety rails, and any remaining mixed responsibility that should be handled in a later refactor.
