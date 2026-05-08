import { makeOrgCrud } from '../../src/spacetimedb/server'
import { stubField, stubPk, stubSpacetime, stubTable } from '../_stub'
const projectCrud = makeOrgCrud(stubSpacetime, {
  fields: { name: stubField },
  idField: stubField,
  options: { acl: true, softDelete: true },
  orgIdField: stubField,
  orgMemberTable: stubTable,
  pk: stubPk,
  table: stubTable,
  tableName: 'project'
})
export { projectCrud }
