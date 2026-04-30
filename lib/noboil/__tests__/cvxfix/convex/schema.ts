import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  childTable,
  kvTable,
  logTable,
  orgTable,
  orgTables,
  ownedTable,
  presenceTable,
  quotaTable,
  singletonTable,
  uploadTables
} from '../../../src/convex/server'
import { chatSchema, kvSchema, messageSchema, profileSchema, projectSchema, todoSchema, voteSchema } from './s'
export default defineSchema({
  audit: defineTable({
    action: v.string(),
    actor: v.string(),
    args: v.optional(v.string()),
    mode: v.optional(v.string()),
    ok: v.boolean(),
    traceId: v.optional(v.string()),
    ts: v.optional(v.number())
  })
    .index('by_actor', ['actor'])
    .index('by_trace', ['traceId']),
  chat: ownedTable(chatSchema),
  message: childTable(messageSchema, 'chatId'),
  ...orgTables(),
  pollVoteQuota: quotaTable(),
  ...presenceTable(),
  ...uploadTables(),
  budget: defineTable({
    balance: v.number(),
    inflight: v.optional(v.number()),
    owner: v.string(),
    periodKey: v.string(),
    reservations: v.optional(v.array(v.any()))
  }).index('by_owner', ['owner']),
  movie: defineTable({
    rating: v.number(),
    title: v.string(),
    tmdb_id: v.string(),
    updatedAt: v.optional(v.number())
  }).index('by_tmdb_id', ['tmdb_id']),
  profile: singletonTable(profileSchema),
  project: orgTable(projectSchema),
  siteConfig: kvTable(kvSchema),
  todo: ownedTable(todoSchema),
  users: defineTable({ name: v.optional(v.string()) }),
  vote: logTable(voteSchema)
})
