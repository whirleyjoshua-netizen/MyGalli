export function formatFieldValue(type: string, value: any, config?: any): string {
  if (value === null || value === undefined || value === '') return ''
  switch (type) {
    case 'currency': {
      const symbol = config?.symbol ?? '$'
      const n = Number(value)
      return isNaN(n) ? String(value) : `${symbol}${n.toLocaleString('en-US')}`
    }
    case 'percent':
      return `${value}%`
    case 'date':
      return new Date(value).toLocaleDateString()
    default:
      return String(value)
  }
}
