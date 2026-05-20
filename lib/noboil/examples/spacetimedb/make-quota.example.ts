import { makeQuota } from '../../src/spacetimedb/server'
import { stubField, stubSpacetime, stubTable } from '../_stub'

const voteQuota = makeQuota(stubSpacetime, {
  durationMs: 60_000,
  limit: 10,
  ownerField: stubField,
  table: stubTable,
  tableName: 'pollVoteQuota'
})
export { voteQuota }
