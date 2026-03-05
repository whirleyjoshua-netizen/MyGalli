'use client'

import { useState } from 'react'
import { UserCircle, Trash2, ExternalLink, Mail, Phone } from 'lucide-react'
import { getKit } from '@/lib/kits/registry'
import type { KitProfileField } from '@/lib/kits/registry'
import '@/lib/kits/athlete-kit'
import '@/lib/kits/resume-kit'
import '@/lib/kits/academic-kit'

interface KitProfileElementProps {
  element: {
    id: string
    kitProfileKitId?: string
    kitProfileData?: Record<string, any>
    kitProfileLayout?: 'card' | 'full'
  }
  onChange: (updates: Record<string, any>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function KitProfileElement({ element, onChange, onDelete, isSelected, onSelect }: KitProfileElementProps) {
  const [editingField, setEditingField] = useState<string | null>(null)

  const kit = element.kitProfileKitId ? getKit(element.kitProfileKitId) : null
  const profileData = element.kitProfileData || {}

  if (!kit) {
    return (
      <div className="rounded-xl border border-border p-6 text-center text-muted-foreground text-sm" onClick={onSelect}>
        <UserCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
        No kit assigned to this profile card
      </div>
    )
  }

  // Group fields by section
  const sections: Record<string, KitProfileField[]> = {}
  for (const field of kit.profileFields) {
    if (!sections[field.section]) sections[field.section] = []
    sections[field.section].push(field)
  }

  const updateProfileField = (key: string, value: any) => {
    onChange({
      kitProfileData: { ...profileData, [key]: value },
    })
  }

  const renderField = (field: KitProfileField) => {
    const value = profileData[field.key] || ''
    const isEditing = editingField === field.key

    if (isEditing) {
      if (field.type === 'select') {
        return (
          <select
            autoFocus
            value={value}
            onChange={e => updateProfileField(field.key, e.target.value)}
            onBlur={() => setEditingField(null)}
            className="w-full px-2 py-1 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="">Select...</option>
            {(field.options || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )
      }
      if (field.type === 'textarea') {
        return (
          <textarea
            autoFocus
            value={value}
            onChange={e => updateProfileField(field.key, e.target.value)}
            onBlur={() => setEditingField(null)}
            placeholder={field.placeholder}
            rows={2}
            className="w-full px-2 py-1 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
          />
        )
      }
      return (
        <input
          autoFocus
          type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
          value={value}
          onChange={e => updateProfileField(field.key, e.target.value)}
          onBlur={() => setEditingField(null)}
          onKeyDown={e => e.key === 'Enter' && setEditingField(null)}
          placeholder={field.placeholder}
          className="w-full px-2 py-1 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
        />
      )
    }

    return (
      <div
        onClick={(e) => { e.stopPropagation(); setEditingField(field.key) }}
        className={`px-2 py-1 rounded-lg text-sm cursor-text hover:bg-muted/50 transition min-h-[28px] ${
          value ? 'text-foreground' : 'text-muted-foreground/50 italic'
        }`}
      >
        {value || field.placeholder || 'Click to edit...'}
      </div>
    )
  }

  return (
    <div
      className={`relative rounded-xl border transition-all ${
        isSelected ? 'border-primary shadow-md ring-2 ring-primary/20' : 'border-border hover:border-border/80'
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <UserCircle className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{kit.name} Profile</span>
      </div>

      {/* Sections */}
      <div className="p-4 space-y-5">
        {Object.entries(sections).map(([sectionName, fields]) => (
          <div key={sectionName}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{sectionName}</h4>
            <div className="space-y-1.5">
              {fields.map(field => (
                <div key={field.key} className="grid grid-cols-[120px_1fr] items-start gap-2">
                  <label className="text-xs font-medium text-muted-foreground pt-1.5">{field.label}</label>
                  {renderField(field)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Delete button */}
      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
