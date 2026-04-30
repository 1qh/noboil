import { boolean, number, object, string } from 'zod/v4'
const todoSchema = object({ done: boolean(), title: string() })
const voteSchema = object({ optionIdx: number(), voter: string() })
const profileSchema = object({ bio: string(), name: string() })
const kvSchema = object({ active: boolean(), message: string() })
const chatSchema = object({ title: string() })
const messageSchema = object({ chatId: string(), text: string() })
const projectSchema = object({ name: string() })
const orgZodSchema = object({ name: string(), slug: string() })
export { chatSchema, kvSchema, messageSchema, orgZodSchema, profileSchema, projectSchema, todoSchema, voteSchema }
