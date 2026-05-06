import { isCvxTestMode } from '../../shared/test-mode'
/** Returns true when running in convex-test mode (CONVEX_TEST_MODE=true or PLAYWRIGHT=1). */
const isTestMode = isCvxTestMode
export { isTestMode }
