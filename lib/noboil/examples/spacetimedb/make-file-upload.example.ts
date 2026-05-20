import { makeFileUpload } from '../../src/spacetimedb/server'
import { stubField, stubPk, stubSpacetime, stubTable } from '../_stub'

const avatarUpload = makeFileUpload(stubSpacetime, {
  fields: { contentType: stubField, data: stubField, filename: stubField, size: stubField },
  idField: stubField,
  maxFileSize: 5 * 1024 * 1024,
  namespace: 'avatars',
  pk: stubPk,
  table: stubTable
})
export { avatarUpload }
