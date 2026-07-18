import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'
import { config, urls } from '../../noboil.config'

const portMap = (): Record<string, number> => ({
  ...config.ports.apps,
  convexApi: config.ports.convexApi,
  convexDashboard: config.ports.convexDashboard,
  convexSite: config.ports.convexSite,
  doc: config.ports.doc,
  minio: config.ports.minio,
  minioConsole: config.ports.minioConsole,
  postgres: config.ports.postgres,
  stdb: config.ports.stdb
})
const lookupToken = (kind: string, key: string | undefined, map: Record<string, number | string>): string => {
  const v = key ? map[key] : undefined
  if (!v) throw new Error(`Unknown ${kind} token: {{${kind}:${key}}}. Valid: ${Object.keys(map).join(', ')}`)
  return String(v)
}
const resolve = (token: string): string => {
  const [kind, key] = token.split(':')
  if (kind === 'port') return lookupToken('port', key, portMap())
  if (kind === 'url') return lookupToken('url', key, urls())
  if (kind === 'path') return lookupToken('path', key, config.paths)
  if (kind === 'module' && !key) return config.module
  throw new Error(`Unknown token: {{${token}}}`)
}
const TOKEN_RE = /%%(?<t>[a-z]+(?::[a-zA-Z-]+)?)%%/gu
const sub = (s: string): string => s.replaceAll(TOKEN_RE, (_, t: string) => resolve(t))
const remarkNoboil = () => (tree: Root) => {
  visit(tree, node => {
    if ('value' in node && typeof node.value === 'string') node.value = sub(node.value)
  })
}
export default remarkNoboil
