/* oxlint-disable promise/param-names, promise/prefer-await-to-then */
/* eslint-disable @typescript-eslint/strict-void-return, no-promise-executor-return, no-await-in-loop, @eslint-react/web-api-no-leaked-timeout, @eslint-react/no-array-index-key, react/no-array-index-key, @typescript-eslint/no-unnecessary-condition */
import { Box, render, Text, useApp, useInput } from 'ink'
import Spinner from 'ink-spinner'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { useEffect, useState } from 'react'
import { readJson, readJsonSafe, writeJson } from './shared/env-file'

interface CheckResult {
  detail?: string
  status: CheckStatus
  title: string
}
type CheckStatus = 'fail' | 'pass' | 'running' | 'warn'
const check = (title: string, fn: () => Omit<CheckResult, 'title'>): CheckResult => ({ ...fn(), title })
const checkPackageJson = (cwd: string): CheckResult =>
  check('package.json', () => {
    // oxlint-disable-next-line node/no-sync
    if (!existsSync(join(cwd, 'package.json'))) return { detail: 'not found in cwd', status: 'fail' }
    return { status: 'pass' }
  })
const checkNoboilDep = (cwd: string): CheckResult =>
  check('noboil dep', () => {
    const pkg = readJsonSafe(join(cwd, 'package.json')) as null | {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    if (!pkg) return { detail: 'no package.json', status: 'fail' }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    if ('noboil' in deps) return { detail: deps.noboil ?? 'unknown', status: 'pass' }
    return { detail: 'not in dependencies', status: 'fail' }
  })
const checkBun = (): CheckResult =>
  check('bun', () => {
    // oxlint-disable-next-line node/no-sync -- CLI tool: synchronous spawn by design
    const r = spawnSync('bun', ['--version'], { encoding: 'utf8' }) // eslint-disable-line sonarjs/no-os-command-from-path -- dev tooling, trusted PATH
    if (r.status === 0) return { detail: r.stdout.trim(), status: 'pass' }
    return { detail: 'not on PATH', status: 'fail' }
  })
const checkNodeModules = (cwd: string): CheckResult =>
  check('node_modules', () => {
    // oxlint-disable-next-line node/no-sync
    if (existsSync(join(cwd, 'node_modules'))) return { status: 'pass' }
    return { detail: "missing — run 'bun install'", status: 'warn' }
  })
const checkTsconfig = (cwd: string): CheckResult =>
  check('tsconfig.json', () => {
    // oxlint-disable-next-line node/no-sync
    if (existsSync(join(cwd, 'tsconfig.json'))) return { status: 'pass' }
    return { detail: 'missing', status: 'warn' }
  })
const readRc = (cwd: string) => {
  let dir = cwd
  for (let i = 0; i < 10; i += 1) {
    const rcPath = join(dir, '.noboilrc.json')
    // oxlint-disable-next-line node/no-sync
    if (existsSync(rcPath))
      return readJsonSafe(rcPath) as null | { db?: 'convex' | 'spacetimedb'; scaffoldedFrom?: string }
    const parent = join(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return null
}
const checkManifest = (cwd: string): CheckResult =>
  check('noboil manifest', () => {
    const rc = readRc(cwd)
    if (!rc) return { detail: '.noboilrc.json missing — sync disabled', status: 'warn' }
    if (!rc.scaffoldedFrom) return { detail: 'invalid — run noboil sync --force', status: 'warn' }
    return { detail: `scaffolded from ${rc.scaffoldedFrom.slice(0, 7)}`, status: 'pass' }
  })
const checkSyncStatus = (cwd: string): CheckResult =>
  check('upstream sync', () => {
    const rc = readRc(cwd)
    if (!rc?.scaffoldedFrom) return { detail: 'skipped — no manifest', status: 'warn' }
    // oxlint-disable-next-line node/no-sync -- CLI tool: synchronous spawn by design
    const r = spawnSync('git', ['ls-remote', 'https://github.com/1qh/noboil.git', 'HEAD'], { encoding: 'utf8' }) // eslint-disable-line sonarjs/no-os-command-from-path -- dev tooling, trusted PATH
    if (r.status !== 0) return { detail: 'remote unreachable', status: 'warn' }
    const latestHash = (r.stdout.split('\n')[0] ?? '').split('\t')[0] ?? ''
    if (latestHash && latestHash !== rc.scaffoldedFrom) return { detail: "outdated — run 'noboil sync'", status: 'warn' }
    return { detail: 'up to date', status: 'pass' }
  })
const checkConvexDir = (cwd: string): CheckResult =>
  check('convex/', () => {
    // oxlint-disable-next-line node/no-sync
    if (existsSync(join(cwd, 'convex'))) return { status: 'pass' }
    return { detail: 'missing', status: 'warn' }
  })
const checkDocker = (cwd: string): CheckResult =>
  check('docker-compose', () => {
    // oxlint-disable-next-line node/no-sync
    if (existsSync(join(cwd, 'docker-compose.yml')) || existsSync(join(cwd, 'compose.yml'))) return { status: 'pass' }
    return { detail: 'missing — needed for SpacetimeDB', status: 'warn' }
  })
const checkStdbConditions = (cwd: string): CheckResult =>
  check('tsconfig customConditions', () => {
    const cfg = readJsonSafe(join(cwd, 'tsconfig.json')) as null | {
      compilerOptions?: { customConditions?: string[] }
    }
    if (!cfg) return { detail: 'no tsconfig.json', status: 'warn' }
    const conds = cfg.compilerOptions?.customConditions ?? []
    if (conds.includes('noboil-spacetimedb')) return { detail: "includes 'noboil-spacetimedb'", status: 'pass' }
    return { detail: 'imports will resolve to Convex bindings', status: 'warn' }
  })
const buildCheckList = (cwd: string): (() => CheckResult)[] => {
  const rc = readRc(cwd)
  const base = [
    () => checkPackageJson(cwd),
    () => checkNoboilDep(cwd),
    checkBun,
    () => checkNodeModules(cwd),
    () => checkTsconfig(cwd),
    () => checkManifest(cwd),
    () => checkSyncStatus(cwd)
  ]
  if (rc?.db === 'convex') return [...base, () => checkConvexDir(cwd)]
  if (rc?.db === 'spacetimedb') return [...base, () => checkDocker(cwd), () => checkStdbConditions(cwd)]
  return base
}
const Icon = ({ status }: { status: CheckStatus }) => {
  if (status === 'running')
    return (
      <Text color='cyan'>
        <Spinner type='dots' />
      </Text>
    )
  if (status === 'pass') return <Text color='green'>✔</Text>
  if (status === 'warn') return <Text color='yellow'>!</Text>
  return <Text color='red'>✘</Text>
}
const statusColor = (status: CheckStatus): string => {
  if (status === 'pass') return 'green'
  if (status === 'warn') return 'yellow'
  if (status === 'fail') return 'red'
  return 'cyan'
}
const summaryLine = (failCount: number, warnCount: number): string => {
  if (failCount === 0 && warnCount === 0) return 'All good.'
  if (failCount > 0) return 'Fix failures before proceeding.'
  return 'Warnings are non-blocking.'
}
const Row = ({ result }: { result: CheckResult }) => (
  <Box>
    <Box marginRight={1} width={2}>
      <Icon status={result.status} />
    </Box>
    <Text bold={result.status === 'running'} color={statusColor(result.status)}>
      {result.title.padEnd(26)}
    </Text>
    {result.detail ? <Text dimColor>{result.detail}</Text> : null}
  </Box>
)
const applyNodeModulesFix = (cwd: string): string => {
  // oxlint-disable-next-line node/no-sync -- CLI tool: synchronous spawn by design
  const install = spawnSync('bun', ['install'], { cwd, stdio: 'pipe' }) // eslint-disable-line sonarjs/no-os-command-from-path -- dev tooling, trusted PATH
  return install.status === 0 ? '✔ bun install' : '✘ bun install failed'
}
const applyTsconfigFix = (cwd: string): string => {
  try {
    const p = join(cwd, 'tsconfig.json')
    const cfg = readJson(p) as { compilerOptions?: { customConditions?: string[] } }
    cfg.compilerOptions ??= {}
    const existing = cfg.compilerOptions.customConditions ?? []
    cfg.compilerOptions.customConditions = existing.includes('noboil-spacetimedb')
      ? existing
      : [...existing, 'noboil-spacetimedb']
    writeJson(p, cfg)
    return "✔ tsconfig: added 'noboil-spacetimedb'"
  } catch {
    return '✘ tsconfig patch failed'
  }
}
const applyFixes = (cwd: string, results: CheckResult[]): string[] => {
  const actions: string[] = []
  for (const r of results) {
    if (r.title === 'node_modules' && r.status === 'warn') actions.push(applyNodeModulesFix(cwd))
    if (r.title === 'tsconfig customConditions' && r.status === 'warn') actions.push(applyTsconfigFix(cwd))
  }
  return actions
}
const DoctorApp = ({ fix, onExit }: { fix: boolean; onExit: (code: number) => void }) => {
  const app = useApp()
  const [results, setResults] = useState<CheckResult[]>([])
  const [current, setCurrent] = useState<null | string>(null)
  const [done, setDone] = useState(false)
  const [fixActions, setFixActions] = useState<string[]>([])
  useEffect(() => {
    const runChecks = async () => {
      const cwd = process.cwd()
      const checkFns = buildCheckList(cwd)
      const accumulator: CheckResult[] = []
      for (const fn of checkFns) {
        const placeholder = { status: 'running' as const, title: '…' }
        setCurrent(placeholder.title)
        setResults([...accumulator, placeholder])
        /** biome-ignore lint/performance/noAwaitInLoops: sequential by design */
        await new Promise(r => setTimeout(r, 40))
        const res = fn()
        accumulator.push(res)
        setResults([...accumulator])
      }
      setCurrent(null)
      if (fix) {
        setCurrent('applying fixes...')
        const actions = applyFixes(cwd, accumulator)
        setFixActions(actions)
        setCurrent(null)
      }
      setDone(true)
      const issues = accumulator.filter(r => r.status === 'fail').length
      setTimeout(() => {
        app.exit()
        onExit(issues > 0 ? 1 : 0)
      }, 200)
    }
    runChecks().catch(() => null)
  }, [app, onExit, fix])
  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      app.exit()
      onExit(1)
    }
  })
  const passCount = results.filter(r => r.status === 'pass').length
  const warnCount = results.filter(r => r.status === 'warn').length
  const failCount = results.filter(r => r.status === 'fail').length
  return (
    <Box flexDirection='column' padding={1}>
      <Box flexDirection='column' marginBottom={1}>
        <Text bold color='cyan'>
          noboil doctor
        </Text>
        <Text dimColor>project health check</Text>
      </Box>
      <Box flexDirection='column'>
        {results.map((r, i) => (
          /** biome-ignore lint/suspicious/noArrayIndexKey: static list, index stable */
          <Row key={`${r.title}-${i}`} result={r} />
        ))}
      </Box>
      {done ? (
        <Box flexDirection='column' marginTop={1}>
          <Box gap={2}>
            <Text color='green'>{passCount} pass</Text>
            {warnCount > 0 ? <Text color='yellow'>{warnCount} warn</Text> : null}
            {failCount > 0 ? <Text color='red'>{failCount} fail</Text> : null}
          </Box>
          <Text dimColor>{summaryLine(failCount, warnCount)}</Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text dimColor>running {current ?? ''}</Text>
        </Box>
      )}
      {fixActions.length > 0 ? (
        <Box flexDirection='column' marginTop={1}>
          <Text bold>Fixes applied</Text>
          {fixActions.map(a => (
            <Text dimColor key={a}>
              {a}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  )
}
const runDoctorTui = async ({ fix }: { fix: boolean }): Promise<number> =>
  new Promise(resolve => {
    const { unmount } = render(<DoctorApp fix={fix} onExit={resolve} />)
    process.on('SIGINT', () => {
      unmount()
      resolve(1)
    })
  })
export { runDoctorTui }
