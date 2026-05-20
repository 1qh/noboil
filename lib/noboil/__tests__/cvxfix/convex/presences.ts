import { makePresence } from '../../../src/convex/server/presence'
import { m, q } from './auth-builders'

const endpoints = makePresence({ m, q })
const { heartbeat, leave, list } = endpoints
export { heartbeat, leave, list }
