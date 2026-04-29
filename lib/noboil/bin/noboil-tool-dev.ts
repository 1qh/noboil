#!/usr/bin/env bun
/* eslint-disable no-console */
/* oxlint-disable eslint-plugin-unicorn(no-process-exit) */
import { run as runCodegen } from './noboil-tool-codegen'
import { run as runDocgen } from './noboil-tool-docgen'
import { run as runNew } from './noboil-tool-new'
import { run as runRemove } from './noboil-tool-remove'
const SUBCOMMANDS: Record<string, { description: string; run: (argv: string[]) => Promise<void> }> = {
  codegen: {
    description: 'Generate registry/types/callers/schema-hashes from authored tools',
    run: async () => runCodegen()
  },
  docgen: { description: 'Generate INVENTORY.md (tool catalog)', run: async () => runDocgen() },
  new: { description: 'Scaffold a new tool: <provider>/<...segments> [--kind=action|query|mutation]', run: runNew },
  remove: { description: 'Remove a tool: <provider>/<...segments>', run: runRemove }
}
const printHelp = (): void => {
  console.log('noboil tool <subcommand> [args]')
  console.log('')
  console.log('Subcommands:')
  for (const [name, { description }] of Object.entries(SUBCOMMANDS)) console.log(`  ${name.padEnd(10)} ${description}`)
  console.log('')
  console.log('Run `noboil tool <subcommand> --help` for subcommand-specific usage (where applicable).')
}
const run = async (argv: string[]): Promise<number> => {
  const sub = argv[0]
  if (!sub || sub === '-h' || sub === '--help') {
    printHelp()
    return sub ? 0 : 2
  }
  const cmd = SUBCOMMANDS[sub]
  if (!cmd) {
    console.error(`unknown subcommand: ${sub}`)
    console.error('')
    printHelp()
    return 2
  }
  await cmd.run(argv.slice(1))
  return 0
}
if (import.meta.main) process.exit(await run(process.argv.slice(2)))
export { run }
