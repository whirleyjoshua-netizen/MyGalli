'use client'

import { WorkspaceField, WorkspaceRecord } from '@prisma/client'

interface WorkspaceTableProps {
  fields: WorkspaceField[]
  records: (WorkspaceRecord & { data: Record<string, any> })[]
}

export function WorkspaceTable({ fields, records }: WorkspaceTableProps) {
  return (
    <div className="w-full overflow-x-auto border border-border rounded-xl bg-surface">
      <table className="w-full text-sm text-left">
        <thead className="text-xs uppercase bg-muted text-muted-foreground border-b border-border">
          <tr>
            {fields.map((field) => (
              <th key={field.id} className="px-6 py-3 font-semibold">
                {field.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {records.map((record) => (
            <tr key={record.id} className="hover:bg-muted/50">
              {fields.map((field) => (
                <td key={field.id} className="px-6 py-4">
                  {String(record.data[field.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
