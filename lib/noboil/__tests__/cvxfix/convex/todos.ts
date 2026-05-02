import { makeCrud } from '../../../src/convex/server/crud'
import { cm, cq, m, pq, q } from './auth-builders'
import { todoSchema } from './s'
const endpoints = makeCrud({
  builders: { cm, cq, m, pq, q },
  options: {
    cascade: [{ foreignKey: 'todoId', table: 'tagItem' }],
    hooks: {
      afterCreate: () => undefined,
      afterDelete: () => undefined,
      afterUpdate: () => undefined,
      beforeCreate: (_c, a) => a.data,
      beforeDelete: () => undefined,
      beforeUpdate: (_c, a) => a.patch
    }
  },
  schema: todoSchema,
  table: 'todo'
})
const { auth, create, pub, pubIndexed, rm, update } = endpoints
const { list } = auth
const { read } = auth
const pubList = pub.list
const pubRead = pub.read
export { create, list, pubIndexed, pubList, pubRead, read, rm, update }
