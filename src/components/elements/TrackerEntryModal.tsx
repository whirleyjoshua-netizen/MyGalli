'use client'

import { useState } from 'react'
import { X, Plus, Check } from 'lucide-react'
import type { TrackerFieldDef } from '@/lib/kits/registry'

interface TrackerEntryModalProps {
  isOpen: boolean
  onClose: () => void
  trackerLabel: string
  fields: TrackerFieldDef[]
  displayId: string
  trackerId: string
  category: string
  onEntryAdded: () => void
}

export function TrackerEntryModal({
  isOpen,
  onClose,
  trackerLabel,
  fields,
  displayId,
  trackerId,
  category,
  onEntryAdded,
}: TrackerEntryModalProps) {
  const [values, setValues] = useState<Record<string, any>>({})
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const updateField = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const reset = () => {
    setValues({})
    setRecordedAt(new Date().toISOString().split('T')[0])
    setNote('')
    setSuccess(false)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/tracker-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayId,
          trackerId,
          category,
          value: values,
          recordedAt: new Date(recordedAt).toISOString(),
          note: note || undefined,
        }),
      })
      if (res.ok) {
        setSuccess(true)
        onEntryAdded()
      }
    } catch (err) {
      console.error('Failed to add entry:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddAnother = () => {
    reset()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold">Add {trackerLabel} Entry</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-lg font-medium mb-1">Entry Added!</p>
            <p className="text-sm text-muted-foreground mb-4">Your {trackerLabel.toLowerCase()} entry has been saved.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleAddAnother}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
              >
                <Plus className="w-4 h-4" />
                Add Another
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Fields */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {fields.map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    {field.unit && <span className="text-muted-foreground ml-1">({field.unit})</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={values[field.key] || ''}
                      onChange={e => updateField(field.key, e.target.value)}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="">Select...</option>
                      {(field.options || []).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === 'boolean' ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={values[field.key] || false}
                        onChange={e => updateField(field.key, e.target.checked)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-muted-foreground">Yes</span>
                    </label>
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      step={field.type === 'number' ? 'any' : undefined}
                      value={values[field.key] || ''}
                      onChange={e => updateField(field.key, field.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                  )}
                </div>
              ))}

              {/* Date */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Date</label>
                <input
                  type="date"
                  value={recordedAt}
                  onChange={e => setRecordedAt(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Note <span className="text-muted-foreground font-normal">(optional)</span></label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Any notes about this entry..."
                  rows={2}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm hover:bg-muted rounded-lg transition">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
