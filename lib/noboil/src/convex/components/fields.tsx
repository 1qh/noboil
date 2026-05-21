// oxlint-disable promise/prefer-await-to-then
'use client'
import type { Api } from '../react/form'
import { createFieldsModule } from '../../shared/components/fields'
import { unwrapZod } from '../zod'
import FileFieldImpl from './file-field'

const { deriveLabel, fields, FormContext, ServerFieldError } = createFieldsModule({
  dynamicFileField: FileFieldImpl,
  errors: {
    chooseNoEnum: name => `Choose: field "${name}" has no enum options. Pass options prop.`,
    fieldOutsideForm: 'Field must be inside <Form>',
    unknownField: ({ name }) => `Unknown field: ${name}`,
    wrongKind: ({ expected, name }) => `Field ${name} is not ${expected}`
  },
  unwrapZod
})
export type { Api }
export { deriveLabel, fields, FormContext, ServerFieldError }
