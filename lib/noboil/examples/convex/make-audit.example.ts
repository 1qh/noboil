import { makeAudit } from '../../src/convex/server'
import { stubBuilders } from '../_stub'

const audit = makeAudit({
  builders: stubBuilders,
  table: 'audit',
  ttlMs: 30 * 24 * 60 * 60 * 1000
})
export { audit }
