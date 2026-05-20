import { boolean, object, string } from 'zod/v4'
import { makeCrud } from '../../src/convex/server'
import { stubBuilders } from '../_stub'

const todoSchema = object({ done: boolean(), title: string() })
const todoCrud = makeCrud({
  builders: stubBuilders,
  options: {
    pub: 'done',
    rateLimit: { max: 30, window: 60_000 },
    search: 'title',
    softDelete: true
  },
  schema: todoSchema,
  table: 'todo'
})
export { todoCrud }
