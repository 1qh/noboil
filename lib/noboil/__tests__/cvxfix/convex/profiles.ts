import { makeSingletonCrud } from '../../../src/convex/server/singleton'
import { m, q } from './auth-builders'
import { profileSchema } from './s'
const { get, upsert } = makeSingletonCrud({
  builders: { m, q },
  schema: profileSchema,
  table: 'profile'
})
export { get, upsert }
