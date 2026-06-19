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

4017 tests — 3178 unit + 235 integration + 604 e2e (52 cvx/blog, 26 cvx/chat, 14 cvx/movie, 128 cvx/org, 82 cvx/poll, 52 stdb/blog, 26 stdb/chat, 14 stdb/movie, 128 stdb/org, 82 stdb/poll).

<!-- /AUTO-GENERATED:TEST-COUNTS -->

## Next

byerag adoption — map its tables onto noboil factories (owned / log / audit / singleton / quota / budget / kv / cache), import the tools `_lib`, keep domain + provider code product-side. Gated by user greenlight.
