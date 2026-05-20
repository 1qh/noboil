import { boolean, object, string } from 'zod/v4'
import { makeOrgCrud } from '../../src/convex/server'
import { stubBuilders } from '../_stub'

const projectSchema = object({ done: boolean(), name: string() })
const projectCrud = makeOrgCrud({
  builders: stubBuilders,
  options: { acl: true, rateLimit: { max: 30, window: 60_000 }, softDelete: true },
  schema: projectSchema,
  table: 'project'
})
export { projectCrud }
