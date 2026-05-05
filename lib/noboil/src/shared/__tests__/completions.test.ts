/* eslint-disable no-console */
import { describe, expect, test } from 'bun:test'
import { printCompletions } from '../../completions'
describe('printCompletions', () => {
  test('bash produces bash completion script', async () => {
    const originalLog = console.log
    let captured = ''
    // oxlint-disable-next-line typescript/no-unused-vars
    console.log = (msg: string) => {
      captured += `${msg}\n`
    }
    try {
      await printCompletions('bash')
    } finally {
      console.log = originalLog
    }
    expect(captured).toContain('_noboil()')
    expect(captured).toContain('complete -F _noboil noboil')
  })
  test('zsh produces zsh completion script', async () => {
    const originalLog = console.log
    let captured = ''
    console.log = (msg: string) => {
      captured += `${msg}\n`
    }
    try {
      await printCompletions('zsh')
    } finally {
      console.log = originalLog
    }
    expect(captured).toContain('#compdef noboil')
  })
  test('fish produces fish completion script', async () => {
    const originalLog = console.log
    let captured = ''
    console.log = (msg: string) => {
      captured += `${msg}\n`
    }
    try {
      await printCompletions('fish')
    } finally {
      console.log = originalLog
    }
    expect(captured).toContain('complete -c noboil')
  })
  test('unknown arg prints usage and exits non-zero', async () => {
    const originalLog = console.log
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalExit = process.exit
    let captured = ''
    let exitCode: number | undefined
    console.log = (msg: string) => {
      captured += `${msg}\n`
    }
    process.exit = (code?: number) => {
      exitCode = code
      throw new Error('__exit__')
    }
    try {
      await printCompletions('xxx')
    } catch (error) {
      if (!(error instanceof Error) || error.message !== '__exit__') throw error
    } finally {
      console.log = originalLog
      process.exit = originalExit
    }
    expect(captured).toContain('Usage: noboil completions')
    expect(exitCode).toBe(1)
  })
  test('install with no shell prints usage and exits', async () => {
    const originalLog = console.log
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalExit = process.exit
    let captured = ''
    let exitCode: number | undefined
    console.log = (msg: string) => {
      captured += `${msg}\n`
    }
    process.exit = (code?: number) => {
      exitCode = code
      throw new Error('__exit__')
    }
    try {
      await printCompletions('install', [])
    } catch (error) {
      if (!(error instanceof Error) || error.message !== '__exit__') throw error
    } finally {
      console.log = originalLog
      process.exit = originalExit
    }
    expect(captured).toContain('install failed')
    expect(exitCode).toBe(1)
  })
})
