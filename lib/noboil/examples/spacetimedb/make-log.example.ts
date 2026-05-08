import { makeLog } from '../../src/spacetimedb/server'
import { stubField, stubSpacetime, stubTable } from '../_stub'
const messageLog = makeLog(stubSpacetime, {
  fields: { text: stubField },
  idempotencyKeyField: stubField,
  options: { rateLimit: { max: 30, window: 60_000 } },
  parentField: stubField,
  table: stubTable,
  tableName: 'message'
})
export { messageLog }
