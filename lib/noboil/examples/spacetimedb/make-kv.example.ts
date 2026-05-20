import { makeKv } from '../../src/spacetimedb/server'
import { stubField, stubSpacetime, stubTable } from '../_stub'

const siteConfigKv = makeKv(stubSpacetime, {
  fields: { value: stubField },
  keyField: stubField,
  options: { softDelete: true },
  table: stubTable,
  tableName: 'siteConfig'
})
export { siteConfigKv }
