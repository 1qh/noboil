import type { BuiltinErrorCode } from './error-messages'
/** Actionable hints attached to error codes — read by agents (and humans) to self-correct without consulting docs. */
const ERROR_SUGGESTIONS: Partial<Record<BuiltinErrorCode, string>> = {
  ALREADY_ORG_MEMBER: 'Skip the invite — query org members and proceed if userId already present.',
  CANNOT_MODIFY_ADMIN: 'Either log in as the org owner or have the owner perform the change.',
  CANNOT_MODIFY_OWNER: 'Use the transferOwnership flow first; the owner cannot be modified directly.',
  CONFLICT: 'Re-fetch the row, merge your local changes onto the latest updatedAt, and retry the mutation.',
  EDITOR_REQUIRED: 'Add the user to the doc.editors array (org owner/admin only) before retrying.',
  FILE_NOT_FOUND: 'Re-upload the file or refresh the parent record so the FID is current.',
  FILE_TOO_LARGE: 'Compress/resize before upload, or raise `maxFileSize` in the schema field options.',
  FORBIDDEN: 'Operation is owner-only — verify the row.userId matches the authenticated user.',
  INCOMPLETE_UPLOAD: 'Replay missing chunks: list received chunks then re-upload missing indices.',
  INSUFFICIENT_ORG_ROLE: 'Ask an admin to upgrade your role, or perform the action from an admin/owner account.',
  INVALID_FILE_TYPE: 'Check the schema field `accept` array; convert or pick a supported MIME type.',
  INVALID_INVITE: 'Request a fresh invite — token may be malformed, expired, or already accepted.',
  INVALID_KEY: 'Use one of the keys declared in the kv schema `keys` array; arbitrary keys are rejected.',
  INVALID_WHERE: 'Field names must match schema; comparison ops use `$gt`/`$gte`/`$lt`/`$lte`/`$between`.',
  INVITE_EXPIRED: 'Generate a new invite — invite tokens expire after the configured TTL.',
  JOIN_REQUEST_EXISTS: 'A pending join request already exists; wait for approval or have the user cancel and retry.',
  LIMIT_EXCEEDED: 'Wait for the rate-limit window to reset, or batch operations to fit under the cap.',
  MUST_TRANSFER_OWNERSHIP: 'Call transferOwnership to promote another admin first, then leave.',
  NOT_AUTHENTICATED: 'Ensure a valid session token is attached — call login or supply Bearer auth header.',
  NOT_AUTHORIZED: 'Confirm the session belongs to the expected user; re-login may be needed.',
  NOT_FOUND: 'Re-query by id; the row may have been deleted, soft-deleted, or never existed.',
  NOT_ORG_MEMBER: 'Add the user to the org via createInvite/addMember before performing org-scoped actions.',
  NO_FETCHER: 'Pass `fetcher` in the cache table options so cacheCrud can populate misses.',
  ORG_SLUG_TAKEN: 'Pick a different slug — slugs are globally unique within the org table.',
  RATE_LIMITED: 'Back off and retry after the rate-limit window; consider raising the limit if persistent.',
  SESSION_NOT_FOUND: 'Re-authenticate; the session id is unknown to the server (likely expired or rotated).',
  TARGET_MUST_BE_ADMIN: 'Promote the target user to admin first, then transfer ownership to them.',
  UNAUTHORIZED: 'Attach a valid session token before retrying.',
  USER_NOT_FOUND: 'The user account is gone — refresh upstream lists; do not retry this id.',
  VALIDATION_FAILED: 'Inspect `fieldErrors`; the input shape did not match the schema.'
}
/** Returns a one-line suggestion for a known error code, or undefined if the code has no registered hint. */
const getErrorSuggestion = (code: string): string | undefined => ERROR_SUGGESTIONS[code as BuiltinErrorCode]
export { ERROR_SUGGESTIONS, getErrorSuggestion }
