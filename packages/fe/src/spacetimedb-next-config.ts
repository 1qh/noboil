/** biome-ignore-all lint/style/noProcessEnv: config env */
import type { NextConfig } from 'next'

interface CreateNextConfigOptions {
  experimental?: NextConfig['experimental']
  imageDomains?: string[]
  imgSrc?: string[]
}

const isDev = process.env.NODE_ENV === 'development',
  DEV_IMG_SRC = ' http://localhost:* http://127.0.0.1:*',
  BASE_IMG_SRC = `'self' data: blob:${isDev ? DEV_IMG_SRC : ''}`,
  isPlaywright = process.env.PLAYWRIGHT === '1',
  SPACETIMEDB_CONNECT_SRC = process.env.NEXT_PUBLIC_SPACETIMEDB_URI,
  DEV_CONNECT_SRC = [
    "'self'",
    'https://auth.spacetimedb.com',
    'http://localhost:*',
    'ws://localhost:*',
    'http://127.0.0.1:*',
    'ws://127.0.0.1:*'
  ],
  PROD_CONNECT_SRC = [
    "'self'",
    'https://auth.spacetimedb.com',
    ...(SPACETIMEDB_CONNECT_SRC ? [SPACETIMEDB_CONNECT_SRC] : [])
  ],
  createNextConfig = ({ experimental, imageDomains, imgSrc }: CreateNextConfigOptions = {}): NextConfig => ({
    ...(isPlaywright && { devIndicators: false }),
    experimental: { ...experimental },
    headers: () => [
      {
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              `img-src ${[BASE_IMG_SRC, ...(imgSrc ?? [])].join(' ')}`,
              `connect-src ${isDev ? DEV_CONNECT_SRC.join(' ') : PROD_CONNECT_SRC.join(' ')}`,
              "font-src 'self'",
              "frame-ancestors 'none'"
            ].join('; ')
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ],
        source: '/:path*'
      }
    ],
    images: imageDomains ? { remotePatterns: imageDomains.map(hostname => ({ hostname })) } : undefined,
    reactCompiler: true,
    serverExternalPackages: ['spacetimedb/server'],
    transpilePackages: ['@a/ui', '@a/be', '@a/fe']
  })

export { createNextConfig }
