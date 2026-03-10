#!/usr/bin/env bun
/* eslint-disable no-console,@typescript-eslint/no-unused-vars */

const bold = (s: string) => `\u001B[1m${s}\u001B[0m`,
  dim = (s: string) => `\u001B[2m${s}\u001B[0m`,
  yellow = (s: string) => `\u001B[33m${s}\u001B[0m`,
  eject = (_args: string[]) => {
    console.log(`\n${bold('noboil eject')} — detach from upstream\n`)
    console.log(`  ${yellow('!')} This command will be available in a future release.`)
    console.log(`  ${dim('It will inline all noboil library code into your project,')}`)
    console.log(`  ${dim('removing the dependency on @noboil/* packages.')}\n`)
    console.log(`  ${dim('For now, see the ejecting guide in the docs:')}\n`)
    console.log(`  ${dim('https://noboil.dev/docs/ejecting')}\n`)
  }

export { eject }
