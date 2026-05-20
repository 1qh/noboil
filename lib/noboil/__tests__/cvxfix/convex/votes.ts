import { makeLog } from '../../../src/convex/server/log'
import { m, q } from './auth-builders'
import { voteSchema } from './s'

const endpoints = makeLog({
  builders: { m, q },
  schema: voteSchema,
  softDelete: true,
  table: 'vote'
})
const { append, authIndexed, list, listAfter, purgeByParent, read, restoreByParent, rm, update } = endpoints
export { append, authIndexed, list, listAfter, purgeByParent, read, restoreByParent, rm, update }
