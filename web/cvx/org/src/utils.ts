import { ConvexHttpClient } from 'convex/browser'

const getTestClient = () => {
  // biome-ignore lint/style/noProcessEnv: env validation
  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL or CONVEX_URL not set')
  return new ConvexHttpClient(url)
}
export { getTestClient }
