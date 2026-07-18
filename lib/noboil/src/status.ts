/* eslint-disable no-console */
import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { bold, dim, green, red, yellow } from './ansi'
import { readManifestFrom } from './shared/manifest'

const HELP = `
${bold('noboil status')} — snapshot of the current project
Usage:
  noboil status
Shows: database, scaffolded-from hash, drift vs upstream, last sync, install health.
`
const humanizeAge = (isoDate: string): string => {
  const ms = Date.now() - new Date(isoDate).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days < 1) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  return `${Math.floor(days / 30)} months ago`
}
type Manifest = NonNullable<ReturnType<typeof readManifestFrom>>['manifest']
const printSyncAge = (rc: Manifest): void => {
  if (!rc.scaffoldedAt) return
  const stale = (Date.now() - new Date(rc.scaffoldedAt).getTime()) / 86_400_000 > 30
  const staleTag = stale ? ` ${yellow('(stale)')}` : ''
  console.log(`  ${dim('last sync:')} ${humanizeAge(rc.scaffoldedAt)}${staleTag}`)
  if (stale) console.log(`    ${yellow('!')} consider ${dim('noboil sync')} — scaffold is >30 days old`)
}
const printInstallHealth = (projectRoot: string): void => {
  // oxlint-disable-next-line node/no-sync
  if (existsSync(join(projectRoot, 'node_modules'))) console.log(`  ${green('✓')} node_modules present`)
  else console.log(`  ${yellow('!')} node_modules missing — run ${dim('bun install')}`)
}
const printUpstreamStatus = (rc: Manifest): void => {
  if (rc.ejected || !rc.scaffoldedFrom) return
  // oxlint-disable-next-line node/no-sync -- CLI tool: synchronous spawn by design
  const r = spawnSync('git', ['ls-remote', 'https://github.com/1qh/noboil.git', 'HEAD'], { encoding: 'utf8' }) // eslint-disable-line sonarjs/no-os-command-from-path -- dev tooling, trusted PATH
  if (r.status !== 0) return
  const latest = (r.stdout.split('\n')[0] ?? '').split('\t')[0] ?? ''
  if (latest && latest !== rc.scaffoldedFrom) {
    console.log(`  ${yellow('!')} upstream ahead: ${rc.scaffoldedFrom.slice(0, 7)} → ${latest.slice(0, 7)}`)
    console.log(`    run ${dim('noboil sync')} to pull updates`)
  } else console.log(`  ${green('✓')} up to date with upstream`)
}
const printPkgMtime = (projectRoot: string): void => {
  const logPath = join(projectRoot, 'package.json')
  // oxlint-disable-next-line node/no-sync
  if (!existsSync(logPath)) return
  // oxlint-disable-next-line node/no-sync
  const { mtime } = statSync(logPath)
  console.log(`  ${dim('pkg mtime:')} ${humanizeAge(mtime.toISOString())}`)
}
const status = (args: string[]) => {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP)
    return
  }
  const cwd = process.cwd()
  console.log(`\n${bold('noboil status')}\n`)
  console.log(`  ${dim('cwd:')}      ${cwd}`)
  const found = readManifestFrom(cwd)
  if (!found) {
    console.log(`  ${red('✘')} no .noboilrc.json — not a noboil project`)
    console.log(`\nRun ${dim('noboil init')} to scaffold a new project.\n`)
    return
  }
  const { manifest: rc, path: rcPath } = found
  const projectRoot = dirname(rcPath)
  if (projectRoot !== cwd) console.log(`  ${dim('root:')}     ${projectRoot}`)
  console.log(`  ${dim('db:')}       ${rc.db ?? '?'}`)
  console.log(`  ${dim('demos:')}    ${rc.includeDemos ? 'included' : 'excluded'}`)
  if (rc.ejected) console.log(`  ${yellow('!')} ejected — sync disabled`)
  if (rc.scaffoldedFrom) console.log(`  ${dim('from:')}     ${rc.scaffoldedFrom.slice(0, 7)}`)
  printSyncAge(rc)
  printInstallHealth(projectRoot)
  printUpstreamStatus(rc)
  printPkgMtime(projectRoot)
  console.log('')
}
export { status }
