/* eslint-disable no-console */
import { describe, expect, test } from 'bun:test'
import { doctor } from '../doctor'
import { eject } from '../eject'
import { status } from '../status'
import { sync } from '../sync'
import { upgrade } from '../upgrade'
const silenced = (fn: () => unknown) => {
  const orig = console.log
  console.log = () => undefined
  try {
    return fn()
  } finally {
    console.log = orig
  }
}
describe('root --help commands', () => {
  test('doctor --help', async () => {
    await silenced(async () => {
      await doctor(['--help'])
    })
    expect(true).toBe(true)
  })
  test('upgrade --help', () => {
    silenced(() => upgrade(['--help']))
    expect(true).toBe(true)
  })
  test('sync + status + eject --help (with process.exit guard)', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const origExit = process.exit
    process.exit = () => {
      throw new Error('__exit__')
    }
    const safe = (fn: () => unknown) => async () => {
      try {
        await fn()
      } catch (error) {
        if (!(error instanceof Error) || error.message !== '__exit__') throw error
      }
    }
    try {
      await silenced(safe(async () => sync(['--help'])))
      await silenced(safe(() => status(['--help'])))
      await silenced(safe(async () => eject(['--help'])))
    } finally {
      process.exit = origExit
    }
    expect(true).toBe(true)
  })
})
