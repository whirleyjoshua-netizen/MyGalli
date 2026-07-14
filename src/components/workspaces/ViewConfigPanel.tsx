'use client'

import { WorkspaceField, WorkspaceView } from '@prisma/client'
import { useState } from 'react'

interface ViewConfigPanelProps {
  workspaceId: string
  view: WorkspaceView
  fields: WorkspaceField[]
  onUpdate: () => void
}

export function ViewConfigPanel({ workspaceId, view, fields, onUpdate }: ViewConfigPanelProps) {
  const config = view.config as { visibleFields?: string[] }
  const [visibleFields, setVisibleFields] = useState(config.visibleFields || fields.map(f => f.key))

  const toggleField = async (key: string) => {
    const nextFields = visibleFields.includes(key)
      ? visibleFields.filter(f => f !== key)
      : [...visibleFields, key]
    
    setVisibleFields(nextFields)
    
    // Call API to update view config
    await fetch(`/api/workspaces/${workspaceId}/views/${view.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { ...config, visibleFields: nextFields } })
    })
    onUpdate()
  }

  return (
    <div className="p-4 border-l border-border bg-surface h-full">
      <h2 className="font-semibold mb-4">View Configuration</h2>
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase text-muted-foreground">Visible Fields</h3>
        {fields.map(field => (
          <label key={field.id} className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={visibleFields.includes(field.key)}
              onChange={() => toggleField(field.key)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm">{field.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
