#!/usr/bin/env bun
/* eslint-disable no-console */
import { config } from '@a/config'
import { resolve } from 'node:path'
import { replaceLineBetween } from './lib'
const REPO = resolve(import.meta.dir, '../..')
const main = () => {
  const p = config.ports
  const rows = [
    [p.convexApi, 'Convex API'],
    [p.convexSite, 'Convex site'],
    [p.convexDashboard, 'Convex dashboard'],
    [p.postgres, 'Postgres (Convex backing store)'],
    [p.minio, 'MinIO (S3-compatible)'],
    [p.minioConsole, 'MinIO console'],
    [p.apps['cvx-blog'], 'cvx/blog'],
    [p.apps['cvx-chat'], 'cvx/chat'],
    [p.apps['cvx-movie'], 'cvx/movie'],
    [p.apps['cvx-org'], 'cvx/org'],
    [p.apps['cvx-poll'], 'cvx/poll'],
    [p.stdb, 'SpacetimeDB daemon'],
    [p.apps['stdb-blog'], 'stdb/blog'],
    [p.apps['stdb-chat'], 'stdb/chat'],
    [p.apps['stdb-movie'], 'stdb/movie'],
    [p.apps['stdb-org'], 'stdb/org'],
    [p.apps['stdb-poll'], 'stdb/poll'],
    [p.doc, 'Doc site']
  ] as const
  const lines = ['| Port | Service |', '| ---- | ------- |', ...rows.map(([port, name]) => `| ${port} | ${name} |`)]
  const dirty = replaceLineBetween(`${REPO}/RULES.md`, 'PORT-TABLE', lines.join('\n'))
  console.log(dirty ? 'Updated port table' : 'Port table up to date')
}
main()
