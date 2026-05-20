import { object, string } from 'zod/v4'
import { makeKv } from '../../src/convex/server'
import { stubBuilders } from '../_stub'

const bannerSchema = object({ message: string(), severity: string() })
const siteConfigKv = makeKv({
  builders: stubBuilders,
  keys: ['banner', 'maintenanceMode'] as const,
  schema: bannerSchema,
  softDelete: true,
  table: 'siteConfig'
})
export { siteConfigKv }
