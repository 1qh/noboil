import { makeAudit } from '../../../src/convex/server/audit'
import { cm, cq } from './auth-builders'
const endpoints = makeAudit({
  builders: { m: cm, q: cq },
  table: 'audit'
})
const { append, listByActor, listByTrace, pruneStale, recent } = endpoints
export { append, listByActor, listByTrace, pruneStale, recent }
