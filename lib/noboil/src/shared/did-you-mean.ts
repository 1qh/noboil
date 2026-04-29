const dist = (a: string, b: string): number => {
  const w = b.length + 1
  const m = new Uint16Array((a.length + 1) * w)
  const get = (idx: number): number => m[idx] ?? 0
  for (let i = 0; i <= a.length; i += 1) m[i * w] = i
  for (let j = 0; j <= b.length; j += 1) m[j] = j
  for (let i = 1; i <= a.length; i += 1)
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      m[i * w + j] = Math.min(get((i - 1) * w + j) + 1, get(i * w + (j - 1)) + 1, get((i - 1) * w + (j - 1)) + cost)
    }
  return get(a.length * w + b.length)
}
const didYouMean = (target: string, options: string[]): null | string => {
  if (options.length === 0) return null
  const sorted = options.map(o => ({ d: dist(target, o), name: o })).toSorted((a, b) => a.d - b.d)
  return sorted[0] && sorted[0].d <= 2 ? sorted[0].name : null
}
export { didYouMean, dist }
