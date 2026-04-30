import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { childTable, kvTable, logTable, ownedTable, quotaTable, singletonTable } from '../../../src/convex/server'
import { chatSchema, kvSchema, messageSchema, profileSchema, todoSchema, voteSchema } from './s'
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
  pollVoteQuota: quotaTable(),
  profile: singletonTable(profileSchema),
  siteConfig: kvTable(kvSchema),
  todo: ownedTable(todoSchema),
  users: defineTable({ name: v.optional(v.string()) }),
  vote: logTable(voteSchema)
})
