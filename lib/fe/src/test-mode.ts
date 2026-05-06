/** biome-ignore-all lint/style/noProcessEnv: env detection */
const isPlaywright: boolean = process.env.PLAYWRIGHT === '1' || process.env.NEXT_PUBLIC_PLAYWRIGHT === '1'
const isStdbTestMode: boolean = isPlaywright || process.env.SPACETIMEDB_TEST_MODE === 'true'
const isCvxTestMode: boolean = isPlaywright || process.env.CONVEX_TEST_MODE === 'true'
export { isCvxTestMode, isPlaywright, isStdbTestMode }
