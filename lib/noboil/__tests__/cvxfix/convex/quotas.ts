import { customCtx } from 'convex-helpers/server/customFunctions'
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4'
import type { Mb, Qb } from '../../../src/convex/server/types'
import { makeQuota } from '../../../src/convex/server/quota'
import { mutation, query } from './_generated/server'
const cm = zCustomMutation(
  mutation,
  customCtx(() => ({}))
) as unknown as Mb
const cq = zCustomQuery(
  query,
  customCtx(() => ({}))
) as unknown as Qb
const { check, consume, record } = makeQuota({
  builders: { m: cm, q: cq },
  durationMs: 60_000,
  limit: 3,
  table: 'pollVoteQuota'
})
export { check, consume, record }
