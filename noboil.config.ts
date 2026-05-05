const config = {
  containerPorts: {
    convexApi: 3210,
    convexDashboard: 6791,
    convexSite: 3211,
    minio: 9000,
    minioConsole: 9001,
    postgres: 5432,
    socatTarget: 3211,
    stdb: 3000
  },
  convex: { adminKeyPrefix: 'convex-self-hosted' },
  credentials: {
    minio: { password: 'minioadmin', user: 'sss' },
    postgres: 'postgres'
  },
  minio: {
    buckets: {
      exports: 'exports',
      files: 'files',
      imports: 'imports',
      modules: 'modules',
      primary: 'mybucket',
      search: 'search'
    }
  },
  module: 'noboil',
  paths: {
    backendConvex: 'backend/convex',
    backendStdb: 'backend/spacetimedb',
    doc: 'doc',
    stdbGenerated: 'lib/spacetimedb/src/generated',
    webCvx: 'web/cvx',
    webStdb: 'web/stdb'
  },
  ports: {
    apps: {
      'cvx-blog': 4110,
      'cvx-chat': 4111,
      'cvx-movie': 4112,
      'cvx-org': 4113,
      'cvx-poll': 4114,
      'stdb-blog': 4210,
      'stdb-chat': 4211,
      'stdb-movie': 4212,
      'stdb-org': 4213,
      'stdb-poll': 4214
    },
    convexApi: 4100,
    convexDashboard: 4102,
    convexSite: 4101,
    doc: 4300,
    minio: 4104,
    minioConsole: 4105,
    postgres: 4103,
    stdb: 4200
  },
  postgres: { db: 'convex_self_hosted' }
} as const
const allPorts = (): Record<string, number> => {
  const p = config.ports
  return {
    convexApi: p.convexApi,
    convexDashboard: p.convexDashboard,
    convexSite: p.convexSite,
    doc: p.doc,
    minio: p.minio,
    minioConsole: p.minioConsole,
    postgres: p.postgres,
    stdb: p.stdb,
    ...p.apps
  }
}
const validate = () => {
  const seen = new Map<number, string>()
  for (const [name, port] of Object.entries(allPorts())) {
    const existing = seen.get(port)
    if (existing) throw new Error(`Port collision: ${name} and ${existing} both claim ${port}`)
    seen.set(port, name)
  }
}
validate()
type AppId = 'doc' | keyof typeof config.ports.apps
const allAppPorts = (): Record<string, number> => ({ ...config.ports.apps, doc: config.ports.doc })
const appPort = (id: string): number => {
  const ports = allAppPorts()
  const port = ports[id]
  if (!port) throw new Error(`No port configured for app: ${id}. Valid: ${Object.keys(ports).join(', ')}`)
  return port
}
const portVars = (): Record<string, string> => {
  const vars: Record<string, string> = {
    PORT_CONVEX_API: String(config.ports.convexApi),
    PORT_CONVEX_DASHBOARD: String(config.ports.convexDashboard),
    PORT_CONVEX_SITE: String(config.ports.convexSite),
    PORT_DOC: String(config.ports.doc),
    PORT_MINIO: String(config.ports.minio),
    PORT_MINIO_CONSOLE: String(config.ports.minioConsole),
    PORT_POSTGRES: String(config.ports.postgres),
    PORT_STDB: String(config.ports.stdb)
  }
  for (const [k, v] of Object.entries(config.ports.apps)) vars[`PORT_${k.toUpperCase().replaceAll('-', '_')}`] = String(v)
  return vars
}
const infraVars = (): Record<string, string> => ({
  CONTAINER_PORT_CONVEX_API: String(config.containerPorts.convexApi),
  CONTAINER_PORT_CONVEX_DASHBOARD: String(config.containerPorts.convexDashboard),
  CONTAINER_PORT_CONVEX_SITE: String(config.containerPorts.convexSite),
  CONTAINER_PORT_MINIO: String(config.containerPorts.minio),
  CONTAINER_PORT_MINIO_CONSOLE: String(config.containerPorts.minioConsole),
  CONTAINER_PORT_POSTGRES: String(config.containerPorts.postgres),
  CONTAINER_PORT_STDB: String(config.containerPorts.stdb),
  POSTGRES_DB: config.postgres.db,
  S3_BUCKET_EXPORTS: config.minio.buckets.exports,
  S3_BUCKET_FILES: config.minio.buckets.files,
  S3_BUCKET_IMPORTS: config.minio.buckets.imports,
  S3_BUCKET_MODULES: config.minio.buckets.modules,
  S3_BUCKET_PRIMARY: config.minio.buckets.primary,
  S3_BUCKET_SEARCH: config.minio.buckets.search
})
const urls = () => ({
  convexApi: `http://127.0.0.1:${config.ports.convexApi}`,
  convexDashboard: `http://127.0.0.1:${config.ports.convexDashboard}`,
  convexSite: `http://127.0.0.1:${config.ports.convexSite}`,
  doc: `http://localhost:${config.ports.doc}`,
  minio: `http://127.0.0.1:${config.ports.minio}`,
  minioConsole: `http://127.0.0.1:${config.ports.minioConsole}`,
  siteCvx: `http://localhost:${config.ports.apps['cvx-blog']}`,
  siteStdb: `http://localhost:${config.ports.apps['stdb-blog']}`,
  stdbWs: `ws://localhost:${config.ports.stdb}`
})
const urlVars = (): Record<string, string> => {
  const u = urls()
  return {
    CONVEX_SELF_HOSTED_URL: u.convexApi,
    CONVEX_SITE_URL: u.convexSite,
    CONVEX_URL: u.convexApi,
    NEXT_PUBLIC_CONVEX_URL: u.convexApi,
    NEXT_PUBLIC_SPACETIMEDB_URI: u.stdbWs,
    SITE_URL: u.siteCvx,
    SPACETIMEDB_URI: u.stdbWs
  }
}
export { allAppPorts, type AppId, appPort, config, infraVars, portVars, urls, urlVars }
