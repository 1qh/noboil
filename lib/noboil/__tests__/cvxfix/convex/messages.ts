import { makeChildCrud } from '../../../src/convex/server/child'
import { m, q } from './auth-builders'
import { chatSchema, messageSchema } from './s'
const endpoints = makeChildCrud({
  builders: { m, q },
  meta: {
    foreignKey: 'chatId',
    index: 'by_chatId',
    parent: 'chat',
    parentSchema: chatSchema,
    schema: messageSchema
  },
  table: 'message'
})
const { create, get, list, rm, update } = endpoints
export { create, get, list, rm, update }
