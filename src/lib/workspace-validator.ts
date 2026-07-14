import { WorkspaceField } from '@prisma/client'

export type FieldError = Record<string, string>

export interface ValidationResult {
  success: boolean
  data?: Record<string, any>
  errors?: FieldError
}

/**
 * Shared service to validate and coerce incoming workspace record data
 * against a workspace's schema definitions.
 */
export function validateWorkspaceRecord(
  fields: WorkspaceField[],
  input: Record<string, any>,
  strict: boolean = true
): ValidationResult {
  const data: Record<string, any> = {}
  const errors: FieldError = {}

  for (const field of fields) {
    const rawValue = input[field.key]
    const isMissing = rawValue === undefined || rawValue === null

    // 1. Required field check
    if (field.required && isMissing) {
      errors[field.key] = `${field.label} is required`
      continue
    }

    // Skip coercion if missing and not required
    if (isMissing) {
      data[field.key] = null
      continue
    }

    // 2. Type Coercion & Validation
    try {
      switch (field.type) {
        case 'number':
          const num = Number(rawValue)
          if (isNaN(num)) throw new Error('Must be a number')
          data[field.key] = num
          break
        case 'text':
          data[field.key] = String(rawValue)
          break
        case 'date':
          const date = new Date(rawValue)
          if (isNaN(date.getTime())) throw new Error('Invalid date')
          data[field.key] = date.toISOString()
          break
        case 'choice':
          // Assume config contains 'options' array
          const config = field.config as { options?: string[] }
          if (config?.options && !config.options.includes(rawValue)) {
            throw new Error(`Must be one of: ${config.options.join(', ')}`)
          }
          data[field.key] = String(rawValue)
          break
        default:
          data[field.key] = rawValue
      }
    } catch (e) {
      errors[field.key] = e instanceof Error ? e.message : 'Invalid format'
    }
  }

  // 3. Strict mode: Reject unknown fields
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
