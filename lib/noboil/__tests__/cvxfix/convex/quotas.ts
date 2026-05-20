import { makeQuota } from '../../../src/convex/server/quota'
import { cm, cq } from './auth-builders'

const { check, consume, record } = makeQuota({
  builders: { m: cm, q: cq },
  durationMs: 60_000,
  limit: 3,
  table: 'pollVoteQuota'
})
export { check, consume, record }
