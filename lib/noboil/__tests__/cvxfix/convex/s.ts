import { boolean, number, object, string } from 'zod/v4'
const todoSchema = object({ done: boolean(), title: string() })
const voteSchema = object({ optionIdx: number(), voter: string() })
const profileSchema = object({ bio: string(), name: string() })
const kvSchema = object({ active: boolean(), message: string() })
export { kvSchema, profileSchema, todoSchema, voteSchema }
