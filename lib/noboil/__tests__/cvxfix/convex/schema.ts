import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  childTable,
  kvTable,
  logTable,
  orgTables,
  ownedTable,
  presenceTable,
  quotaTable,
  rateLimitTable,
  singletonTable,
  uploadTables
} from '../../../src/convex/server'
import { chatSchema, kvSchema, messageSchema, profileSchema, todoSchema, voteSchema } from './s'

export default defineSchema({
  audit: defineTable({
    action: v.string(),
    actor: v.string(),
    // oxlint-disable-next-line unicorn/max-nested-calls
    args: v.optional(v.string()),
    // oxlint-disable-next-line unicorn/max-nested-calls
    mode: v.optional(v.string()),
    ok: v.boolean(),
    // oxlint-disable-next-line unicorn/max-nested-calls
    traceId: v.optional(v.string()),
    // oxlint-disable-next-line unicorn/max-nested-calls
    ts: v.optional(v.number())
  })
    .index('by_actor', ['actor'])
    .index('by_trace', ['traceId']),
  chat: ownedTable(chatSchema),
  message: childTable(messageSchema, 'chatId'),
  ...orgTables(),
  pollVoteQuota: quotaTable(),
  ...presenceTable(),
  ...rateLimitTable(),
  ...uploadTables(),
  budget: defineTable({
    balance: v.number(),
    // oxlint-disable-next-line unicorn/max-nested-calls
    inflight: v.optional(v.number()),
    owner: v.string(),
    periodKey: v.string(),
    // oxlint-disable-next-line unicorn/max-nested-calls
    reservations: v.optional(v.array(v.any()))
  })
    .index('by_owner', ['owner'])
    .index('by_periodKey', ['periodKey']),
  fetchMovie: defineTable({
    rating: v.number(),
    title: v.string(),
    tmdb_id: v.string(),
    // oxlint-disable-next-line unicorn/max-nested-calls
    updatedAt: v.optional(v.number())
  }).index('by_tmdb_id', ['tmdb_id']),
  hardLog: logTable(voteSchema),
  movie: defineTable({
    rating: v.number(),
    title: v.string(),
    tmdb_id: v.string(),
    // oxlint-disable-next-line unicorn/max-nested-calls
    updatedAt: v.optional(v.number())
  }).index('by_tmdb_id', ['tmdb_id']),
  profile: singletonTable(profileSchema),
  project: defineTable({
    // oxlint-disable-next-line unicorn/max-nested-calls
    deletedAt: v.optional(v.number()),
    // oxlint-disable-next-line unicorn/max-nested-calls
    editors: v.optional(v.array(v.id('users'))),
    name: v.string(),
    orgId: v.id('org'),
    updatedAt: v.number(),
    userId: v.id('users')
  })
    .index('by_org', ['orgId'])
    .index('by_org_user', ['orgId', 'userId']),
  siteConfig: kvTable(kvSchema),
  softTodo: ownedTable(todoSchema),
  tagItem: defineTable({
    label: v.string(),
    updatedAt: v.number(),
    userId: v.id('users')
  }).index('by_user', ['userId']),
  todo: ownedTable(todoSchema),
  // oxlint-disable-next-line unicorn/max-nested-calls
  users: defineTable({ email: v.optional(v.string()), name: v.optional(v.string()) }),
  vote: logTable(voteSchema)
})
