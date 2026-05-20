import { makeBudget } from '../../../src/convex/server/budget'
import { cm, cq } from './auth-builders'

const endpoints = makeBudget({
  builders: { m: cm, q: cq },
  cap: 1000,
  inflightMax: 4,
  table: 'budget'
})
export const { add, auditInvariants, check, pruneStale, reserve, settle } = endpoints
