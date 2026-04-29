const DOUBLE_DASH_NUMBER_RE = /^--?\d/u
const parseFlags = (tokens: string[]): { args: Record<string, string>; positional: string[] } => {
  const args: Record<string, string> = {}
  const positional: string[] = []
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i]
    if (tok?.startsWith('--')) {
      const eqIdx = tok.indexOf('=')
      if (eqIdx === -1) {
        const next = tokens[i + 1]
        const isFlag = (next?.startsWith('--') ?? false) && !DOUBLE_DASH_NUMBER_RE.test(next ?? '')
        if (next === undefined || isFlag) args[tok.slice(2)] = 'true'
        else {
          args[tok.slice(2)] = next
          i += 1
        }
      } else args[tok.slice(2, eqIdx)] = tok.slice(eqIdx + 1)
    } else if (tok !== undefined) positional.push(tok)
  }
  return { args, positional }
}
export { didYouMean, dist } from '../../shared/did-you-mean'
export { parseFlags }
