import { makeLog } from '../../../src/convex/server/log'
import { m, q } from './auth-builders'
import { voteSchema } from './s'
const endpoints = makeLog({
  builders: { m, q },
  pub: true,
  schema: voteSchema,
  table: 'hardLog'
})
const { append, list, purgeByParent, read, rm } = endpoints
export { append, list, purgeByParent, read, rm }
