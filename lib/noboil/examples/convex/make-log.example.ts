import { object, string } from 'zod/v4'
import { makeLog } from '../../src/convex/server'
import { stubBuilders } from '../_stub'
const messageSchema = object({ text: string() })
const messageLog = makeLog({
  builders: stubBuilders,
  rateLimit: { max: 30, window: 60_000 },
  schema: messageSchema,
  search: 'text',
  table: 'message'
})
export { messageLog }
