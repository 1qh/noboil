import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { kvTable, logTable, ownedTable, quotaTable, singletonTable } from '../../../src/convex/server'
import { kvSchema, profileSchema, todoSchema, voteSchema } from './s'
export default defineSchema({
  pollVoteQuota: quotaTable(),
  profile: singletonTable(profileSchema),
  siteConfig: kvTable(kvSchema),
  todo: ownedTable(todoSchema),
  users: defineTable({ name: v.optional(v.string()) }),
  vote: logTable(voteSchema)
})
