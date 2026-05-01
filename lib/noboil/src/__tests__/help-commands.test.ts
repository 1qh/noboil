/* eslint-disable no-console */
import { describe, expect, test } from 'bun:test'
import { doctor } from '../doctor'
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
})
