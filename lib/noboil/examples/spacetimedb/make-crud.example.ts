import { makeCrud } from '../../src/spacetimedb/server'
import { stubField, stubPk, stubSpacetime, stubTable } from '../_stub'

const todoCrud = makeCrud(stubSpacetime, {
  fields: { done: stubField, title: stubField },
  idField: stubField,
  options: { rateLimit: { max: 30, window: 60_000 }, softDelete: true },
  pk: stubPk,
  table: stubTable,
  tableName: 'todo'
})
export { todoCrud }
