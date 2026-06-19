# Substrate primitives

noboil is the substrate; a product is the smallest delta on top. byerag is the reference product consumer — its generic engineering lives here, its domain (corpus, retrieval, agent-driver, assessment) stays in byerag.

## Primitives

- `noboil/test` — hermetic adapter (`setHermeticAdapter` / `hermeticTry`, `loadHermeticFixtures`), deterministic LCG RNG (`createLcg` with int/next/pick), fake clock (`setNow` / `restoreNow` / `advanceNow` / `withFakeNow`).
- `budget` factory — `reserve` / `settle` / `check` / `add` / `pruneStale` / `auditInvariants`; generic over cap unit, period (day/hour), inflight max, per-call estimate; cross-period settlement refunds the old window and books overage to today; distinct from `quota`. Convex-first; the STDB equivalent lands on first consumer demand.
- `audit` factory — preset over `log` with a fixed schema (action, actor, args, ok, mode, traceId); `append` / `recent` / `listByActor` / `listByTrace` / `pruneStale`; TTL purge cron.
- `noboil/convex/tools` — Convex-only CLI-tool framework. `_lib/`: builder, types, error, http, manifest, validate, parser, prompt-blocks, define-provider, caller-runtime, codegen (emit / extract-meta / scan / schema). `_bin/`: runtime, codegen, docgen CLIs. `<provider>/` is consumer responsibility, never in noboil. STDB has no equivalent — documented like file storage and pagination.
- shared utils — `noboil/shared/{security,redact,log,sanitize,url,env-file,bounded-stream,http-body}`, plus `noboil/convex/server/test-harness` (`createTestHarness`: convex-test wrapper + scheduled-function drainer + hermetic reset).

## Architecture rules

- Subpath isolation: `noboil/test`, `noboil/budget`, `noboil/convex/tools`.
- Factories stay dual-DB (cross-DB API parity); the CLI-tool framework is Convex-only.
- Each new factory ships a new noboil minor before 0.1.0.

## Quality bar

- Property-based tests for every state machine (budget, log seq, quota window).
- Invariant logging on every transition; constant-time secret comparison; HTTP header allowlists.
- Generated artifacts checked in + drift-tested.
- Framework boundary test: the tools `_lib` carries zero consumer-domain tokens and zero project-scope imports.

## Consumer adoption

A product maps its tables onto factories: owned rows → `crud`, append-only event streams → `log`, audit trails → `audit`, per-user singletons → `singletonCrud`, sliding-window limits → `quota`, spend caps → `budget`, key-value state → `kv`, derived caches → `cacheCrud`. Provider-specific tool code, LLM proxy allowlists, stream protocol, sandbox lifecycle, and secret redaction stay product-side.
