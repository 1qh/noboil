#!/usr/bin/env bun
/* eslint-disable no-console */
import { config } from '../../noboil.config'
import { DOC_REPO, replaceLineBetween } from './lib'

const main = () => {
  const p = config.ports
  const cvxApps = Object.entries(p.apps)
    .filter(([k]) => k.startsWith('cvx-'))
    .toSorted(([, a], [, b]) => a - b)
  const stdbApps = Object.entries(p.apps)
    .filter(([k]) => k.startsWith('stdb-'))
    .toSorted(([, a], [, b]) => a - b)
  const rows: [number, string][] = [
    [p.convexApi, 'Convex API'],
    [p.convexSite, 'Convex site'],
    [p.convexDashboard, 'Convex dashboard'],
    [p.postgres, 'Postgres (Convex backing store)'],
    [p.minio, 'MinIO (S3-compatible)'],
    [p.minioConsole, 'MinIO console'],
    ...cvxApps.map(([k, v]) => [v, k.replace('cvx-', 'cvx/')] as [number, string]),
    [p.stdb, 'SpacetimeDB daemon'],
    ...stdbApps.map(([k, v]) => [v, k.replace('stdb-', 'stdb/')] as [number, string]),
    [p.doc, 'Doc site']
  ]
  const lines = ['| Port | Service |', '| ---- | ------- |', ...rows.map(([port, name]) => `| ${port} | ${name} |`)]
  const dirty = replaceLineBetween(`${DOC_REPO}/architecture.md`, 'PORT-TABLE', lines.join('\n'))
  console.log(dirty ? 'Updated port table' : 'Port table up to date')
}
main()
