/** biome-ignore-all lint/style/noProcessEnv: env module, intentional process.env */
import { config } from '@a/config'
import { wsToHttp } from 'noboil/spacetimedb'

const STDB_HTTP_URL = process.env.SPACETIMEDB_URI
  ? wsToHttp(process.env.SPACETIMEDB_URI)
  : `http://localhost:${config.ports.stdb}`
const STDB_MODULE = process.env.SPACETIMEDB_MODULE_NAME ?? config.module
export { STDB_HTTP_URL, STDB_MODULE }
