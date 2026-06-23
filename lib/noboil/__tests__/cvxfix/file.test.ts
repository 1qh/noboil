import { Glob } from 'bun'
import { describe, expect, test } from 'bun:test'
import { convexTest } from 'convex-test'
import { resolve } from 'node:path'
import schema from './convex/schema'

const cvxDir = resolve(import.meta.dir, 'convex')
const loadModules = () => {
  const out: Record<string, () => Promise<Record<string, unknown>>> = {}
  const glob = new Glob('**/*.ts')
  // oxlint-disable-next-line node/no-sync
  for (const rel of glob.scanSync({ cwd: cvxDir }))
    out[`../convex/${rel.replace(/\.ts$/u, '.js')}`] = async () =>
      (await import(`${cvxDir}/${rel}`)) as Record<string, unknown>
  return out
}
const t = () => convexTest(schema, loadModules())
const apiMod = (await import('./convex/_generated/api')) as {
  api: {
    files: {
      assembleChunks: unknown
      cancelChunkedUpload: unknown
      confirmChunk: unknown
      getUploadProgress: unknown
      info: unknown
      startChunkedUpload: unknown
      upload: unknown
      uploadChunk: unknown
      validate: unknown
    }
  }
}
const { api } = apiMod
const seedUser = async (root: ReturnType<typeof t>): Promise<{ tt: ReturnType<typeof t>; userId: string }> => {
  const userId = (await root.run(async ctx => ctx.db.insert('users', { name: 'seed' }))) as string
  return { tt: root.withIdentity({ subject: userId }) as ReturnType<typeof t>, userId }
}
const callMutate = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.mutation(fn as never, args)
const callQuery = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.query(fn as never, args)
describe('makeFileUpload integration', () => {
  test('upload (auth required) generates a URL string', async () => {
    const { tt } = await seedUser(t())
    const url = (await callMutate(tt, api.files.upload, {})) as string
    expect(typeof url).toBe('string')
    expect(url.length).toBeGreaterThan(0)
  })
  test('upload without auth throws NOT_AUTHENTICATED', async () => {
    const tt = t()
    await expect(callMutate(tt, api.files.upload, {})).rejects.toThrow()
  })
  test('startChunkedUpload returns a session id', async () => {
    const { tt } = await seedUser(t())
    const result = (await callMutate(tt, api.files.startChunkedUpload, {
      contentType: 'image/png',
      fileName: 'a.png',
      totalChunks: 1,
      totalSize: 100
    })) as { uploadId: string }
    expect(typeof result.uploadId).toBe('string')
  })
  test('getUploadProgress returns null for unknown session', async () => {
    const { tt } = await seedUser(t())
    const r = await callQuery(tt, api.files.getUploadProgress, { uploadId: 'x' })
    expect(r).toBeNull()
  })
  test('full chunked-upload flow: start → confirm chunks → progress → cancel', async () => {
    const { tt } = await seedUser(t())
    const { uploadId } = (await callMutate(tt, api.files.startChunkedUpload, {
      contentType: 'image/png',
      fileName: 'b.png',
      totalChunks: 2,
      totalSize: 200
    })) as { uploadId: string }
    const storage1 = (await tt.run(async ctx => ctx.storage.store(new Blob(['a'])))) as string
    const r1 = (await callMutate(tt, api.files.confirmChunk, {
      chunkIndex: 0,
      storageId: storage1,
      uploadId
    })) as { allUploaded: boolean; completedChunks: number }
    expect(r1.completedChunks).toBe(1)
    expect(r1.allUploaded).toBe(false)
    const progress = (await callQuery(tt, api.files.getUploadProgress, { uploadId })) as {
      progress: number
      status: string
    }
    expect(progress.progress).toBe(50)
    expect(progress.status).toBe('pending')
    const cancel = (await callMutate(tt, api.files.cancelChunkedUpload, { uploadId })) as { cancelled: boolean }
    expect(cancel.cancelled).toBe(true)
  })
  test('startChunkedUpload rejects oversize totalSize', async () => {
    const { tt } = await seedUser(t())
    await expect(
      callMutate(tt, api.files.startChunkedUpload, {
        contentType: 'image/png',
        fileName: 'big.png',
        totalChunks: 1,
        totalSize: 999_999_999
      })
    ).rejects.toThrow(/FILE_TOO_LARGE/u)
  })
  test('info returns metadata + url for stored file', async () => {
    const { tt } = await seedUser(t())
    const storageId = (await tt.run(async ctx => ctx.storage.store(new Blob(['x'], { type: 'image/png' })))) as string
    const got = (await callQuery(tt, api.files.info, { id: storageId })) as null | { url?: string }
    expect(got).not.toBeNull()
    expect(typeof got?.url).toBe('string')
  })
  test('validate rejects unknown content-type with cleanup', async () => {
    const { tt } = await seedUser(t())
    const storageId = (await tt.run(async ctx =>
      ctx.storage.store(new Blob(['x'], { type: 'application/x-evil' }))
    )) as string
    await expect(callMutate(tt, api.files.validate, { id: storageId })).rejects.toThrow(/INVALID_FILE_TYPE/u)
  })
  test('uploadChunk for valid pending session returns an upload URL', async () => {
    const { tt } = await seedUser(t())
    const { uploadId } = (await callMutate(tt, api.files.startChunkedUpload, {
      contentType: 'image/png',
      fileName: 'c.png',
      totalChunks: 2,
      totalSize: 200
    })) as { uploadId: string }
    const url = (await callMutate(tt, api.files.uploadChunk, { chunkIndex: 0, uploadId })) as string
    expect(typeof url).toBe('string')
  })
  test('uploadChunk fails for unknown session', async () => {
    const { tt } = await seedUser(t())
    await expect(callMutate(tt, api.files.uploadChunk, { chunkIndex: 0, uploadId: 'no-such' })).rejects.toThrow(
      /SESSION_NOT_FOUND/u
    )
  })
  test('full chunked flow: confirm 2 chunks → assembleChunks merges into final blob', async () => {
    const { tt } = await seedUser(t())
    const { uploadId } = (await callMutate(tt, api.files.startChunkedUpload, {
      contentType: 'image/png',
      fileName: 'big.png',
      totalChunks: 2,
      totalSize: 10
    })) as { uploadId: string }
    const s1 = (await tt.run(async ctx => ctx.storage.store(new Blob(['aaaaa'])))) as string
    const s2 = (await tt.run(async ctx => ctx.storage.store(new Blob(['bbbbb'])))) as string
    await callMutate(tt, api.files.confirmChunk, { chunkIndex: 0, storageId: s1, uploadId })
    const r2 = (await callMutate(tt, api.files.confirmChunk, {
      chunkIndex: 1,
      storageId: s2,
      uploadId
    })) as { allUploaded: boolean }
    expect(r2.allUploaded).toBe(true)
    const final = (await tt.action(api.files.assembleChunks as never, { uploadId })) as {
      contentType: string
      size: number
    }
    expect(final.contentType).toBe('image/png')
    expect(final.size).toBe(10)
    const progress = (await callQuery(tt, api.files.getUploadProgress, { uploadId })) as { status: string }
    expect(progress.status).toBe('completed')
  })
  test('startChunkedUpload rejects unknown content-type', async () => {
    const { tt } = await seedUser(t())
    await expect(
      callMutate(tt, api.files.startChunkedUpload, {
        contentType: 'application/x-evil',
        fileName: 'evil.bin',
        totalChunks: 1,
        totalSize: 10
      })
    ).rejects.toThrow(/INVALID_FILE_TYPE/u)
  })
})
