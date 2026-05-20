import type { GenericMutationCtx, GenericQueryCtx } from 'convex/server'
import { makeFileUpload } from '../../../src/convex/server/file'
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server'

const getAuthUserId = async (ctx: GenericMutationCtx<never> | GenericQueryCtx<never>): Promise<null | string> => {
  const id = await ctx.auth.getUserIdentity()
  return id ? id.subject : null
}
const endpoints = makeFileUpload({
  action,
  getAuthUserId: getAuthUserId as never,
  internalMutation,
  internalQuery,
  mutation,
  namespace: 'files',
  query
})
export const {
  assembleChunks,
  cancelChunkedUpload,
  CHUNK_SIZE,
  confirmChunk,
  finalizeAssembly,
  getSessionForAssembly,
  getUploadProgress,
  info,
  startChunkedUpload,
  upload,
  uploadChunk,
  validate
} = endpoints
