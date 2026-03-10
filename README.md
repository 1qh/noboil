# ohmystack

[![npm](https://img.shields.io/npm/v/ohmystack)](https://www.npmjs.com/package/ohmystack)
[![npm](https://img.shields.io/npm/v/@ohmystack/convex)](https://www.npmjs.com/package/@ohmystack/convex)
[![npm](https://img.shields.io/npm/v/@ohmystack/spacetimedb)](https://www.npmjs.com/package/@ohmystack/spacetimedb)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Schema-first, zero-boilerplate fullstack.
Pick your database.

Define a Zod schema once.
Get authenticated CRUD, typesafe forms, file upload, real-time subscriptions,
pagination, search, soft delete, org multi-tenancy with ACL, rate limiting, and conflict
detection — all generated.
Works with Convex or SpacetimeDB.

## Quick Start

```sh
bun ohmystack@latest init
```

Pick a database, name your project, done.
The CLI scaffolds the full monorepo.

## Before / After

### Convex

Raw Convex — ~50 lines for 4 endpoints, no validation, no rate limiting:

```tsx
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')
    return ctx.db
      .query('blog')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .order('desc')
      .paginate(paginationOpts)
  }
})

export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    category: v.string(),
    published: v.boolean()
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')
    return ctx.db.insert('blog', { ...args, userId, updatedAt: Date.now() })
  }
})

export const update = mutation({
  args: {
    id: v.id('blog'),
    title: v.optional(v.string()),
    content: v.optional(v.string())
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')
    const doc = await ctx.db.get(id)
    if (!doc || doc.userId !== userId) throw new Error('Not found')
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  }
})

export const rm = mutation({
  args: { id: v.id('blog') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')
    const doc = await ctx.db.get(id)
    if (!doc || doc.userId !== userId) throw new Error('Not found')
    await ctx.db.delete(id)
  }
})
```

With `@ohmystack/convex`:

```tsx
export const { bulkRm, bulkUpdate, create, list, read, rm, update } = crud(
  schema,
  'blog'
)
```

8 endpoints. Auth, ownership, Zod validation, file upload, cursor pagination, rate
limiting, conflict detection — all included.

### SpacetimeDB

Raw SpacetimeDB — ~40 lines for 3 reducers, no validation, no conflict detection:

```tsx
const createPost = spacetimedb.reducer(
  { name: 'create_post' },
  {
    title: t.string(),
    content: t.string(),
    category: t.string(),
    published: t.bool()
  },
  (ctx, args) => {
    ctx.db.blog.insert({
      id: 0,
      ...args,
      updatedAt: ctx.timestamp,
      userId: ctx.sender
    })
  }
)

const updatePost = spacetimedb.reducer(
  { name: 'update_post' },
  { id: t.u32(), title: t.string().optional(), content: t.string().optional() },
  (ctx, { id, ...fields }) => {
    const row = ctx.db.blog.id.find(id)
    if (!row || !identityEquals(row.userId, ctx.sender))
      throw new SenderError('NOT_FOUND')
    ctx.db.blog.id.update({ ...row, ...fields, updatedAt: ctx.timestamp })
  }
)

const deletePost = spacetimedb.reducer(
  { name: 'delete_post' },
  { id: t.u32() },
  (ctx, { id }) => {
    const row = ctx.db.blog.id.find(id)
    if (!row || !identityEquals(row.userId, ctx.sender))
      throw new SenderError('NOT_FOUND')
    ctx.db.blog.id.delete(id)
  }
)
```

With `@ohmystack/spacetimedb`:

```tsx
export const { bulkRm, bulkUpdate, create, list, read, rm, update } = crud(
  schema,
  'blog'
)
```

Same API. Different database.
The schema is the only thing that changes.

## Convex vs SpacetimeDB

| Feature                      | `@ohmystack/convex` | `@ohmystack/spacetimedb` |
| ---------------------------- | ------------------- | ------------------------ |
| CRUD from Zod schema         | yes                 | yes                      |
| Typesafe forms + validation  | yes                 | yes                      |
| File upload with compression | yes                 | yes                      |
| Pagination, search, sort     | yes                 | yes                      |
| Soft delete with restore     | yes                 | yes                      |
| Bulk operations              | yes                 | yes                      |
| Org multi-tenancy with ACL   | yes                 | yes                      |
| Rate limiting                | yes                 | yes                      |
| Conflict detection           | yes                 | yes                      |
| Real-time subscriptions      | yes                 | yes                      |
| Devtools                     | yes                 | yes                      |
| ESLint plugin (16 rules)     | yes                 | yes                      |
| CLI tools                    | yes                 | yes                      |
| Hosting                      | Convex cloud        | Self-hosted              |
| Runtime                      | Server functions    | In-memory WASM           |
| Row-Level Security           | ownership + ACL     | `clientVisibilityFilter` |
| File storage                 | Convex storage      | S3                       |
| Backend tests                | `convex-test`       |                          |
| Swift codegen                | yes                 |                          |
| WebSocket transport          |                     | native                   |

## Monorepo Structure

```
ohmystack/
  apps/
    convex/         4 Convex demo web apps (blog, chat, movie, org)
    spacetimedb/    4 SpacetimeDB demo web apps
    docs/           Documentation site (fumadocs)
  packages/
    cli/            CLI — bun ohmystack@latest init
    convex/         @ohmystack/convex library
    spacetimedb/    @ohmystack/spacetimedb library
    be-convex/      Convex backend (schema + functions)
    be-spacetimedb/ SpacetimeDB backend (Rust module)
    ui/             Shared shadcn components
    fe/             Shared frontend utilities
    e2e/            Shared Playwright utilities
  mobile/convex/    iOS/Android apps (Swift + Skip)
  desktop/convex/   macOS apps (SwiftUI)
  swift-core/       Shared Swift protocols
```

## Packages

| Package                  | Description                  |
| ------------------------ | ---------------------------- |
| `ohmystack`              | CLI — scaffold a new project |
| `@ohmystack/convex`      | Convex library               |
| `@ohmystack/spacetimedb` | SpacetimeDB library          |

## Docs

[ohmystack.dev/docs](https://ohmystack.dev/docs)

## License

MIT. Author: [1qh](https://github.com/1qh/ohmystack).
