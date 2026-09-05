/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: test fixtures construct and assert partial, invalid, or runtime-shaped values to exercise edge cases */
import { makeLog } from '../../../src/convex/server/log'
import { m, q } from './auth-builders'
import { voteSchema } from './s'

const endpoints = makeLog({
  builders: { m, q },
  pub: true,
  schema: voteSchema,
  table: 'hardLog'
})
const ep = endpoints as typeof endpoints & { pubIndexed?: unknown }
const { append, list, purgeByParent, read, rm } = endpoints
const { pubIndexed } = ep
export { append, list, pubIndexed, purgeByParent, read, rm }
