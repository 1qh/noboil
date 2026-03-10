# noboil

[![npm](https://img.shields.io/npm/v/noboil)](https://www.npmjs.com/package/noboil)
[![npm](https://img.shields.io/npm/v/@noboil/convex)](https://www.npmjs.com/package/@noboil/convex)
[![npm](https://img.shields.io/npm/v/@noboil/spacetimedb)](https://www.npmjs.com/package/@noboil/spacetimedb)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

One schema. Typed backend.
Auto forms. Zero boilerplate.

Define a Zod schema once.
Get authenticated CRUD, typesafe forms, file upload, real-time subscriptions,
pagination, search, soft delete, org multi-tenancy with ACL, rate limiting, and conflict
detection — all generated.
Currently supports Convex and SpacetimeDB.

## Quick Start

```sh
bun noboil@latest init
```

Pick a database, name your project, done.
The CLI scaffolds the full monorepo.

## Before / After

Without noboil — ~50 lines per database for basic CRUD, no validation, no rate limiting:

<details> <summary>Raw Convex (~50 lines)</summary>

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

</details>

<details> <summary>Raw SpacetimeDB (~40 lines)</summary>

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

</details>

With noboil — define your schema, get everything:

```tsx
const owned = makeOwned({
  blog: object({
    title: string().min(1, 'Required'),
    content: string().min(3),
    category: zenum(['tech', 'life', 'tutorial']),
    published: boolean(),
    coverImage: cvFile().nullable().optional(),
    tags: array(string()).max(5).optional()
  })
})

export const { create, list, read, rm, update } = crud(
  owned,
  'blog'
)

5 endpoints. Auth, ownership, Zod validation, file upload, cursor pagination, rate
limiting, conflict detection — all included. Same API across databases.
`create`, `update`, and `rm` each accept single or bulk input (up to 100 items).

## Monorepo Structure
```

noboil/ apps/ convex/ 4 Convex demo web apps (blog, chat, movie, org) spacetimedb/ 4
SpacetimeDB demo web apps docs/ Documentation site (fumadocs) packages/ cli/ CLI — bun
noboil@latest init convex/ @noboil/convex library spacetimedb/ @noboil/spacetimedb
library be-convex/ Convex backend (schema + functions) be-spacetimedb/ SpacetimeDB
backend (Rust module) ui/ Shared shadcn components fe/ Shared frontend utilities e2e/
Shared Playwright utilities mobile/convex/ iOS/Android apps (Swift + Skip)
desktop/convex/ macOS apps (SwiftUI) swift-core/ Shared Swift protocols

```

## Packages

| Package               | Description                  |
| --------------------- | ---------------------------- |
| `noboil`              | CLI — scaffold a new project |
| `@noboil/convex`      | Convex library               |
| `@noboil/spacetimedb` | SpacetimeDB library          |

## Docs

[noboil.dev/docs](https://noboil.dev/docs)

## License

MIT. Author: [1qh](https://github.com/1qh/noboil).
```
