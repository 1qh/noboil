# References

Comprehensive reference index for the web agent harness plan.

## Official documentation links

- AI SDK v6: <https://ai-sdk.vercel.ai/docs>
- Convex: <https://docs.convex.dev>
- @convex-dev/auth: <https://labs.convex.dev/auth>
- convex-helpers: <https://github.com/get-convex/convex-helpers>
- MCP: <https://modelcontextprotocol.io>
- Next.js App Router: <https://nextjs.org/docs/app>
- Playwright: <https://playwright.dev>

## oh-my-openagent source paths (commit `5073efe`)

- Main agent loop: `src/index.ts`
- Agent definitions: `src/agents/`
- Delegation: `src/tools/delegate-task/`
- Background tasks: `src/features/background-agent/`
- MCP: `src/mcp/`
- Compaction: `src/index.compaction-model-agnostic.static.test.ts`
- Tools: `src/tools/`
- System prompts: `src/agents/sisyphus/`, `src/agents/sisyphus-junior/`
- Task management: `src/features/claude-tasks/`
- Run continuation: `src/features/run-continuation-state/`

## Key API reference quick links

- `streamText`: <https://ai-sdk.vercel.ai/docs/reference/ai-sdk-core/stream-text>
- `generateText`: <https://ai-sdk.vercel.ai/docs/reference/ai-sdk-core/generate-text>
- `tool`: <https://ai-sdk.vercel.ai/docs/reference/ai-sdk-core/tool>
- Convex actions: <https://docs.convex.dev/functions/actions>
- Convex mutations: <https://docs.convex.dev/functions/mutations>
- Convex queries: <https://docs.convex.dev/functions/query-functions>
- Convex scheduling: <https://docs.convex.dev/scheduling/scheduled-functions>

## oh-my-openagent documentation & visualizations

The oh-my-openagent repo contains rich Mermaid-based architecture visualizations:

- Orchestration system guide with 3-layer architecture diagram: `docs/guide/orchestration.md`
- Planning state machine (Prometheus interview flow): `docs/guide/orchestration.md` (stateDiagram-v2)
- Atlas execution flow: `docs/guide/orchestration.md` (flowchart LR)
- Feature AGENTS.md files with per-module context: `src/features/AGENTS.md`, `src/hooks/AGENTS.md`

Our plan’s Mermaid diagrams are inspired by these but adapted for the web architecture (Convex + Next.js instead of CLI).

## noboil internal references

- Schema patterns: `packages/convex/src/server/setup.ts`
- CRUD with hooks: `packages/convex/src/server/crud.ts`
- Test auth: `packages/be-convex/convex/testauth.ts`
- Proxy middleware: `packages/fe/src/proxy.ts`
