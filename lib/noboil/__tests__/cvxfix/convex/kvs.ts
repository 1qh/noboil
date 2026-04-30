import { makeKv } from '../../../src/convex/server/kv'
import { cm, cq } from './auth-builders'
import { kvSchema } from './s'
const { get, list, rm, restore, set } = makeKv({
  builders: { m: cm, q: cq },
  schema: kvSchema,
  softDelete: true,
  table: 'siteConfig',
  writeRole: true
})
export { get, list, restore, rm, set }
