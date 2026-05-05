## Symmetry — Convex ⇄ SpacetimeDB API parity

**Done:** unified `noboil()` form · `pub:` syntax · cascade key · `rateLimit` shorthand · `idEquals` · ACL editor reducers + permission checks · custom queries (doc-only) · `useList()` returns `data`.

**Blocked by SpacetimeDB SDK:**

- S5/S6 lazy file loading + `{field}Url` enrichment — no HTTP GET from STDB modules
- S10 server pagination — STDB subscriptions are table-level only

## DX — done

`<AutoForm schema={s.x} />` · compile-time where/field validation · auto `expectedUpdatedAt` · custom error codes · schema validation at definition time · file constraints (`maxSize`, `accept`).

## Docs — done

Architecture mermaid · “first 10 minutes” walkthrough · `file-uploads.mdx` · schema slot system · `recipes.mdx` · `noboil init` walkthrough · `.noboilrc.json` · STDB dev-loop mermaid.

## Tests

<!-- AUTO-GENERATED:TEST-COUNTS -->

3315 tests passing — 3178 unit (incl. 967 cvx pure + 1199 stdb pure) + 137 cvx integration. Run e2e per app via `bun run test:e2e` — counts vary as suites grow.

<!-- /AUTO-GENERATED:TEST-COUNTS -->

## Next

v0.2 absorb-eximagent step 5: table-by-table migration (chats→owned, messages→log, sandboxes→singleton, ownerSpend→budget, etc.) — gated by user greenlight.
