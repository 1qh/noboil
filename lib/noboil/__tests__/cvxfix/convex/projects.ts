import { makeOrgCrud } from '../../../src/convex/server/org-crud'
import { m, q } from './auth-builders'
import { projectSchema } from './s'
const endpoints = makeOrgCrud({
  builders: { m, q },
  schema: projectSchema,
  table: 'project'
})
const { create, list, read, restore, rm, update } = endpoints
export { create, list, read, restore, rm, update }
