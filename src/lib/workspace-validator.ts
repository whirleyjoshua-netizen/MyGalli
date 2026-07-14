import { WorkspaceField } from '@prisma/client'

export type FieldError = Record<string, string>

export interface ValidationResult {
  success: boolean
  data?: Record<string, any>
  errors?: FieldError
}

export interface ValidateOptions {
  strict?: boolean // reject unknown keys (default true)
  partial?: boolean // only process keys present in input; never null-fill (default false)
}

export function validateWorkspaceRecord(
  fields: WorkspaceField[],
  input: Record<string, any>,
  opts: ValidateOptions = {}
): ValidationResult {
  const { strict = true, partial = false } = opts
  const data: Record<string, any> = {}
  const errors: FieldError = {}

  for (const field of fields) {
    const has = Object.prototype.hasOwnProperty.call(input, field.key)
    const rawValue = input[field.key]
    const isMissing = rawValue === undefined || rawValue === null

    // In partial mode, skip fields the caller didn't send.
    if (partial && !has) continue

    // Required is SOFT: missing -> null, no error.
    if (isMissing) {
      data[field.key] = null
      continue
    }

    try {
      switch (field.type) {
        case 'number': {
          const num = Number(rawValue)
          if (isNaN(num)) throw new Error('Must be a number')
          data[field.key] = num
          break
        }
        case 'text':
          data[field.key] = String(rawValue)
          break
        case 'date': {
          const date = new Date(rawValue)
          if (isNaN(date.getTime())) throw new Error('Invalid date')
          data[field.key] = date.toISOString()
          break
        }
        case 'checkbox':
          data[field.key] = Boolean(rawValue) && rawValue !== 'false'
          break
        case 'choice': {
          const config = field.config as { options?: string[] }
          if (config?.options && !config.options.includes(rawValue)) {
            throw new Error(`Must be one of: ${config.options.join(', ')}`)
          }
          data[field.key] = String(rawValue)
          break
        }
        default:
          data[field.key] = rawValue
      }
    } catch (e) {
      errors[field.key] = e instanceof Error ? e.message : 'Invalid format'
    }
  }

  if (strict) {
    for (const key in input) {
      if (!fields.find((f) => f.key === key)) {
        errors[key] = 'Unknown field'
      }
    }
  }

  return Object.keys(errors).length === 0
    ? { success: true, data }
    : { success: false, errors }
}
