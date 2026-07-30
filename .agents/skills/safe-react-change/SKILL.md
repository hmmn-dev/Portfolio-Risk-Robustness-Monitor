---
name: safe-react-change
description: Implement nontrivial React or TypeScript features, bug fixes, and component changes in this portfolio risk monitor using baseline inspection, behavior-focused tests, scoped edits, and complete validation. Use for general production-code changes; combine with react-refactor for structural work and portfolio-monitor-validation when financial or monitoring behavior is affected.
---

# Safe React Change

Apply a repeatable change workflow that preserves behavior, tests the right contract, and leaves an auditable result.

## Inspect

1. Read `AGENTS.md`.
2. Inspect Git status, the relevant source, its types, nearby tests, and shared test helpers.
3. Identify the observable behavior, affected callers, and public interfaces.
4. Run the smallest relevant test or lint command to establish a baseline.
5. Distinguish pre-existing failures from failures introduced by the task.

Do not edit until the current ownership and behavior are understood.

## Define the Change

- State the intended behavior and what must remain unchanged.
- Identify edge cases and external boundaries.
- Choose the smallest coherent implementation.
- For a bug, add a regression test that fails for the reported behavior when practical.
- For financial or status behavior, also use `$portfolio-monitor-validation`.
- For primarily structural work, also use `$react-refactor`.

## Implement

- Search for the canonical calculation or transformation before adding another implementation.
- Keep pure calculations outside React and stores.
- Keep presentation components driven by typed props and callbacks.
- Keep store, worker, file, routing, and persistence coordination in feature/container code or focused hooks.
- Do not deepen an already mixed component. Make the smallest useful ownership extraction or also use `$react-refactor`.
- Do not add new catch-all helper modules; place code with the domain or focused feature responsibility that owns it.
- Use effects only for external synchronization.
- Preserve unrelated changes and avoid broad cleanup.
- Do not weaken types, lint rules, accessibility, or assertions.

Run targeted tests after each meaningful step.

## Test

Choose tests by responsibility:

- Pure logic: focused unit tests in the nearest `__tests__` directory.
- Component behavior: Vitest, React Testing Library, `user-event`, and `renderWithTheme`.
- Routing or stores: integration tests through the public feature behavior.
- Workers, files, IndexedDB, charts, or PDF capture: mock the external boundary.

Prefer accessible roles, labels, and visible text. Assert user-observable results instead of hook calls, component internals, or CSS structure.

Update a test only when the intended contract changed. Do not make a test less specific merely to make it pass.

## Validate

Run, at minimum, for production-code changes:

1. `npm test -- --run path/to/relevant.test.tsx`
2. `npx prettier --write <changed files>`
3. `npx eslint <changed TypeScript files>`
4. `npm test -- --run`
5. `npm run lint`
6. `npm run build`
7. `git diff --check`

If a repository-wide command has a known baseline failure, verify the changed files separately and report the baseline failure exactly. Never report a failed check as passing.

## Review

Inspect the final diff for:

- unrelated edits or formatting churn;
- debug output and commented code;
- skipped, focused, or weakened tests;
- unsafe casts and non-null assertions;
- duplicated sources of truth;
- duplicate screen/PDF or base/custom calculation paths;
- new broad context fields consumed by only one feature;
- mixed components made shorter only by moving their contents into one broad hook;
- missing cleanup for workers, timers, listeners, observers, and object URLs;
- accidental behavior changes.

Report the implementation, tests added or adjusted, commands run, and any remaining risk.
