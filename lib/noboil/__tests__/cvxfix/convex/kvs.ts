import { makeKv } from '../../../src/convex/server/kv'
import { cm, cq } from './auth-builders'
import { kvSchema } from './s'
const { get, list, rm, restore, set } = makeKv({
  builders: { m: cm, q: cq },
  keys: ['banner', 'k', 'x', 'never', 'roleyes', 'roleno'],
  schema: kvSchema,
  softDelete: true,
  table: 'siteConfig',
  writeRole: true
})
const fnGate = makeKv({
  builders: { m: cm, q: cq },
  schema: kvSchema,
  softDelete: true,
  table: 'siteConfig',
  writeRole: () => false
})
const fnGateOk = makeKv({
  builders: { m: cm, q: cq },
  schema: kvSchema,
  softDelete: true,
  table: 'siteConfig',
  writeRole: () => true
})
const setDenied = fnGate.set
const setAllowed = fnGateOk.set
export { get, list, restore, rm, set, setAllowed, setDenied }
