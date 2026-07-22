import { allowedCmps, type FilterField } from './filter'

const ALL_CMPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'is_empty', 'is_not_empty']

/**
 * The JSON Schema handed to output_config.format. Flat by necessity —
 * structured outputs do not support recursive schemas, so there is exactly one
 * top-level and/or over a list of conditions.
 */
export function buildFilterJsonSchema(fields: FilterField[]): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['op', 'conditions'],
    properties: {
      op: { type: 'string', enum: ['and', 'or'] },
      conditions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['field', 'cmp', 'value'],
          properties: {
            field: { type: 'string', enum: fields.map((f) => f.key) },
            cmp: { type: 'string', enum: ALL_CMPS },
            value: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
          },
        },
      },
    },
  }
}

/** The field list the model sees. Schema only — never any record values. */
export function describeSchemaForPrompt(fields: FilterField[]): string {
  return fields
    .map((f) => {
      const opts =
        f.type === 'choice' && f.config?.options?.length
          ? `; options: ${f.config.options.join(', ')}`
          : ''
      return `- ${f.key} (${f.label}) — ${f.type}${opts}; may use: ${allowedCmps(f.type).join(', ')}`
    })
    .join('\n')
}
