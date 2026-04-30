import { makeOrgCrud } from '../../../src/convex/server/org-crud'
import { m, q } from './auth-builders'
import { projectSchema } from './s'
const endpoints = makeOrgCrud({
  builders: { m, q },
  schema: projectSchema,
  table: 'project'
})
const { addEditor, create, editors, list, read, removeEditor, restore, rm, setEditors, update } = endpoints
export { addEditor, create, editors, list, read, removeEditor, restore, rm, setEditors, update }
