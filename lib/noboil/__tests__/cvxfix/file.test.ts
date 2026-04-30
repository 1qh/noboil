import { Glob } from 'bun'
import { describe, expect, test } from 'bun:test'
import { convexTest } from 'convex-test'
import { resolve } from 'node:path'
import schema from './convex/schema'
const cvxDir = resolve(import.meta.dir, 'convex')
const loadModules = () => {
  const out: Record<string, () => Promise<Record<string, unknown>>> = {}
  const glob = new Glob('**/*.ts')
  for (const rel of glob.scanSync({ cwd: cvxDir }))
    out[`../convex/${rel.replace(/\.ts$/u, '.js')}`] = async () =>
      (await import(`${cvxDir}/${rel}`)) as Record<string, unknown>
  return out
}
const t = () => convexTest(schema, loadModules())
const apiMod = (await import('./convex/_generated/api')) as {
  api: {
    files: {
      cancelChunkedUpload: unknown
      confirmChunk: unknown
      getUploadProgress: unknown
      info: unknown
      startChunkedUpload: unknown
      upload: unknown
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
