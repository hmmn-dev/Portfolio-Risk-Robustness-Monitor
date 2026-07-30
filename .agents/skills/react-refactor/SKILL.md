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

## Choose an Ownership Boundary

Classify code before moving it:

- **Domain function:** deterministic parsing, calculation, alignment, sorting, status, or transformation. Keep it in `src/engine/` or a focused pure helper.
- **Presentation component:** renders typed props and emits callbacks. It does not know Zustand, IndexedDB, workers, file parsing, or report construction.
- **Feature/container component:** reads stores, coordinates commands, selects view state, and maps domain results to presentation props.
- **Custom hook:** owns one cohesive reusable lifecycle involving React state or an external system. It returns values and commands, not JSX.
- **Store:** owns genuinely shared or persisted client state, not temporary view drafts or derived values.

Do not create a container/view pair for a trivial component. Extract only when the boundary reduces mixed responsibilities, side effects, transformation, reuse pressure, or testing difficulty.

## Refactor in Safe Order

Prefer this sequence:

1. Extract pure financial or formatting-independent logic and add unit tests.
2. Stabilize types and explicit input/output contracts.
3. Extract cohesive external lifecycles, such as worker or browser-resource management, into focused hooks when useful.
4. Create presentation components around existing user-visible sections.
5. Leave a small feature container that wires stores, hooks, and callbacks.
6. Narrow broad context values or replace them with explicit props where it improves ownership.
7. Remove obsolete code only after callers and tests have moved.

Keep every intermediate step compiling and tested.

## React Constraints

- Do not use effects to derive state or synchronize React state with React state.
- Prefer event handlers, render-time derivation, initializers, reducers, or clearer component ownership.
- Avoid copying store values into component state unless the user is editing an independent draft.
- Do not hide a large component inside an equally large custom hook.
- Do not memoize automatically; use memoization only for expensive work or required stable identity.
- Keep hook dependencies complete.
- Preserve accessible names, keyboard behavior, responsive layout, and status semantics.
- Keep ECharts option building and financial calculations pure.
- Keep interactive report and PDF presentation concerns separate.

## Tests During Refactoring

- Keep behavior tests stable while implementation moves.
- Test extracted pure functions directly.
- Test presentation components with representative props and user events.
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
- there are no forwarding abstractions with no ownership value;
- no duplicate state or calculation path was introduced.

Report preserved invariants, new boundaries, tests used as safety rails, and any remaining mixed responsibility that should be handled in a later refactor.
