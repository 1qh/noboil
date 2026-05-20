import { makeQuota } from '../../src/convex/server'
import { stubBuilders } from '../_stub'

const voteQuota = makeQuota({
  builders: stubBuilders,
  durationMs: 60_000,
  limit: 10,
  table: 'pollVoteQuota'
})
export { voteQuota }
