/** Primitive field type for codegen / form widgets. */
type FieldType = 'boolean' | 'number' | 'string'
/** Mutation kind for optimistic-store / hooks. */
type MutationType = 'create' | 'delete' | 'update'
/** Org member role. Authoritative for both convex + spacetimedb backends. */
type OrgRole = 'admin' | 'member' | 'owner'
/** Table factory kind. */
type TableType = 'cache' | 'child' | 'kv' | 'log' | 'org' | 'owned' | 'quota' | 'singleton'
export type { FieldType, MutationType, OrgRole, TableType }
