#!/usr/bin/env bun
/* eslint-disable no-console,@typescript-eslint/no-unused-vars */

const bold = (s: string) => `\u001B[1m${s}\u001B[0m`,
  dim = (s: string) => `\u001B[2m${s}\u001B[0m`,
  yellow = (s: string) => `\u001B[33m${s}\u001B[0m`,
  sync = (_args: string[]) => {
    console.log(`\n${bold('noboil sync')} — pull upstream changes\n`)
    console.log(`  ${yellow('!')} This command will be available in a future release.`)
    console.log(`  ${dim('It will compare your project against the latest noboil template')}`)
    console.log(`  ${dim('and apply non-breaking updates to shared components and utilities.')}\n`)
  }

export { sync }
