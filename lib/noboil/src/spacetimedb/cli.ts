#!/usr/bin/env bun
/* eslint-disable no-console */
import { bold, dim, red } from '../ansi'
import { didYouMean } from '../shared/did-you-mean'

const COMMANDS: Record<string, { description: string; run: (argv: string[]) => Promise<unknown> }> = {
  add: {
    description: 'Add a new table/reducer to your project',
    run: async argv => (await import('./add')).add(argv)
  },
  check: {
    description: 'Validate schema/reducer consistency',
    run: async argv => (await import('./check')).run(argv)
  },
  dev: {
    description: 'Start integrated local development workflow',
    run: async argv => (await import('./dev')).dev(argv)
  },
  docs: { description: 'Generate API documentation', run: async argv => (await import('./docs-gen')).run(argv) },
  doctor: { description: 'Run project diagnostics', run: async argv => (await import('./doctor')).run(argv) },
  generate: {
    description: 'Generate project files (docker-compose, etc.)',
    run: async argv => (await import('./generate')).generate(argv)
  },
  migrate: {
    description: 'Schema diff and publish migration plans',
    run: async argv => (await import('./migrate')).run(argv)
  },
  use: {
    description: 'Switch SpacetimeDB target (local / cloud)',
    run: async argv => (await import('./use')).switchTarget(argv)
  },
  validate: {
    description: 'Lint schema, reducers, indexes, and access control',
    run: async argv => (await import('./check')).run(argv.length === 0 ? ['--health'] : argv)
  },
  viz: { description: 'Visualize schema relationships', run: async argv => (await import('./viz')).run(argv) }
}
const printHelp = () => {
  console.log(`\n${bold('noboil stdb')} — Zod schema → fullstack app\n`)
  console.log(bold('Usage:'))
  console.log('  noboil stdb <command> [options]\n')
  console.log(bold('Commands:'))
  for (const [name, { description }] of Object.entries(COMMANDS)) console.log(`  ${name.padEnd(16)} ${dim(description)}`)
  console.log(`\nRun ${dim('noboil stdb <command> --help')} for command-specific options.\n`)
}
const run = async (argv: string[]): Promise<number> => {
  const [cmd, ...rest] = argv
  if (cmd === '--version' || cmd === '-v') {
    const { getCliVersion } = await import('../shared/version')
    console.log(await getCliVersion())
    return 0
  }
  if (!cmd || cmd === '--help' || cmd === '-h') {
    printHelp()
    return 0
  }
  const entry = COMMANDS[cmd]
  if (!entry) {
    const suggestion = didYouMean(cmd, Object.keys(COMMANDS))
    const hint = suggestion ? dim(`  (did you mean ${bold(suggestion)}?)`) : ''
    console.error(`${red("Unknown 'noboil stdb' subcommand:")} ${cmd}${hint}\n`)
    printHelp()
    return 1
  }
  await entry.run(rest)
  return 0
}
if (import.meta.main) process.exit(await run(process.argv.slice(2)))
export { run }
