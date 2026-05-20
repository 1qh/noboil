import { makeChildCrud } from '../../../src/convex/server/child'
import { m, pq, q } from './auth-builders'
import { chatSchema, messageSchema } from './s'

const endpoints = makeChildCrud({
  builders: { m, pq, q },
  meta: {
    foreignKey: 'chatId',
    index: 'by_chatId',
    parent: 'chat',
    parentSchema: chatSchema,
    schema: messageSchema
  },
  options: {
    hooks: {
      afterCreate: () => undefined,
      afterDelete: () => undefined,
      afterUpdate: () => undefined,
      beforeCreate: (_c, a) => a.data,
      beforeDelete: () => undefined,
      beforeUpdate: (_c, a) => a.patch
    },
    pub: { parentField: 'published' }
  },
  table: 'message'
})
const { create, get, list, pub, rm, update } = endpoints
const pubList = pub?.list
const pubGet = pub?.get
export { create, get, list, pubGet, pubList, rm, update }
