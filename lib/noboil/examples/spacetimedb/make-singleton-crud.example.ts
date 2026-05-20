import { makeSingletonCrud } from '../../src/spacetimedb/server'
import { stubField, stubSpacetime, stubTable } from '../_stub'

const profile = makeSingletonCrud(stubSpacetime, {
  fields: { bio: stubField, name: stubField },
  table: stubTable,
  tableName: 'profile'
})
export { profile }
