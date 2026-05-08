# Typed examples

Each `*.example.ts` file is a real, type-checked use of a public noboil factory. JSDoc `@example` blocks reference these files via `@see` so renames break compile, not just docs.

These files compile under `bun run fix` (via the `examples` glob in `tsconfig.json`). They are **not** shipped to npm — `tsdown.config.ts` bundles only entries listed in `package.json` `exports`.
