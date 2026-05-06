const PUBLIC_PATHS = ['/login', '/public']
const isPublicPath = (pathname: string): boolean => {
  for (const p of PUBLIC_PATHS) if (pathname === p || pathname.startsWith(`${p}/`)) return true
  return false
}
export { isPublicPath, PUBLIC_PATHS }
