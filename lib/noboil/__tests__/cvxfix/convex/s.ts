import { boolean, object, string } from 'zod/v4'
const todoSchema = object({ done: boolean(), title: string() })
const profileSchema = object({ bio: string(), name: string() })
const kvSchema = object({ active: boolean(), message: string() })
export { kvSchema, profileSchema, todoSchema }
