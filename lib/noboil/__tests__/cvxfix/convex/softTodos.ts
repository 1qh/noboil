import { makeCrud } from '../../../src/convex/server/crud'
import { cm, cq, m, pq, q } from './auth-builders'
import { todoSchema } from './s'
const endpoints = makeCrud({
  builders: { cm, cq, m, pq, q },
  options: { softDelete: true },
  schema: todoSchema,
  table: 'softTodo'
})
const { create, restore, rm, update } = endpoints
const { list, read } = endpoints.auth
export { create, list, read, restore, rm, update }
