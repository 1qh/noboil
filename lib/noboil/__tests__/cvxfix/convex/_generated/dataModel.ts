import type { GenericDataModel } from 'convex/server'
type DataModel = GenericDataModel
type Doc<_T extends string = string> = Record<string, unknown>
type Id<_T extends string = string> = string
export type { DataModel, Doc, Id }
