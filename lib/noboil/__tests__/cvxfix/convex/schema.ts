import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { kvTable, ownedTable, quotaTable, singletonTable } from '../../../src/convex/server'
import { kvSchema, profileSchema, todoSchema } from './s'
export default defineSchema({
  pollVoteQuota: quotaTable(),
  profile: singletonTable(profileSchema),
  siteConfig: kvTable(kvSchema),
  todo: ownedTable(todoSchema),
  users: defineTable({ name: v.optional(v.string()) })
})
