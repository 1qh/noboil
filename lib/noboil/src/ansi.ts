/* eslint-disable no-control-regex */
/* oxlint-disable no-control-regex */
/** biome-ignore-all lint/suspicious/noControlCharactersInRegex: ANSI escape */
import { styleText } from 'node:util'

const bold = (s: string) => styleText('bold', s)
const cyan = (s: string) => styleText('cyan', s)
const dim = (s: string) => styleText('dim', s)
const green = (s: string) => styleText('green', s)
const red = (s: string) => styleText('red', s)
const yellow = (s: string) => styleText('yellow', s)
const ANSI_RE = /\u001B\[[\d;]*m/gu
const stripAnsi = (s: string): string => s.replaceAll(ANSI_RE, '')
export { ANSI_RE, bold, cyan, dim, green, red, stripAnsi, yellow }
