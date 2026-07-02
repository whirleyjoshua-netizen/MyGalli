'use client'

import { X, Plus, Trash2, Download, Mail, Link, Phone, Github, Linkedin } from 'lucide-react'
import type { HeaderCardConfig, PhotoPosition, HeaderAction } from '@/lib/types/header-card'
import { createHeaderAction } from '@/lib/types/header-card'
import { HeaderCard } from './HeaderCard'
import { ImageUploadField } from '@/components/ui/ImageUploadField'

interface HeaderCardEditorProps {
  isOpen: boolean
  onClose: () => void
  config: HeaderCardConfig
  onChange: (config: HeaderCardConfig) => void
}

const photoPositions: { id: PhotoPosition; label: string; description: string }[] = [
  { id: 'left-offset', label: 'Left', description: 'Photo left of the text' },
  { id: 'center-overlap', label: 'Center', description: 'Photo centered on top' },
  { id: 'right-inline', label: 'Right', description: 'Photo right of the text' },
  { id: 'hidden', label: 'Hidden', description: 'No profile photo' },
]

const iconOptions: { id: NonNullable<HeaderAction['icon']>; icon: typeof Download; label: string }[] = [
  { id: 'download', icon: Download, label: 'Download' },
  { id: 'mail', icon: Mail, label: 'Email' },
  { id: 'link', icon: Link, label: 'Link' },
  { id: 'phone', icon: Phone, label: 'Phone' },
  { id: 'github', icon: Github, label: 'GitHub' },
  { id: 'linkedin', icon: Linkedin, label: 'LinkedIn' },
]

const colorOptions = ['blue', 'green', 'purple', 'orange', 'slate'] as const

export function HeaderCardEditor({ isOpen, onClose, config, onChange }: HeaderCardEditorProps) {
  if (!isOpen) return null

  const update = (partial: Partial<HeaderCardConfig>) => {
    onChange({ ...config, ...partial })
  }

  const updateAction = (actionId: string, updates: Partial<HeaderAction>) => {
    onChange({
      ...config,
      actions: config.actions.map(a => a.id === actionId ? { ...a, ...updates } : a),
    })
  }

  const addAction = () => {
    onChange({
      ...config,
      actions: [...config.actions, createHeaderAction()],
    })
  }

  const removeAction = (actionId: string) => {
    onChange({
      ...config,
      actions: config.actions.filter(a => a.id !== actionId),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold">Header Card</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Enable Header Card</div>
              <div className="text-sm text-muted-foreground">Show a hero section at the top of your page</div>
            </div>
            <button
              onClick={() => update({ enabled: !config.enabled })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                config.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  config.enabled ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          {config.enabled && (
            <>
              {/* Cover Image */}
              <div>
                <ImageUploadField
                  label="Cover Image"
                  value={config.coverImageUrl}
                  onChange={(url) => update({ coverImageUrl: url })}
                  placeholder="https://example.com/cover.jpg"
                  previewAspect="banner"
                />
                <div className="mt-2">
                  <label className="text-sm text-muted-foreground">
                    Cover Height: {config.coverHeight || 240}px
                  </label>
                  <input
                    type="range"
                    min="120"
                    max="400"
                    value={config.coverHeight || 240}
                    onChange={(e) => update({ coverHeight: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Profile Photo */}
              <ImageUploadField
                label="Profile Photo"
                value={config.photoUrl}
                onChange={(url) => update({ photoUrl: url })}
                placeholder="https://example.com/photo.jpg"
                previewAspect="square"
              />

              {/* Photo Size */}
              <div>
                <label className="text-sm font-medium">
                  Photo Size: {config.photoSize || 160}px
                </label>
                <input
                  type="range"
                  min="48"
                  max="240"
                  value={config.photoSize || 160}
                  onChange={(e) => update({ photoSize: Number(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                  <span>Small</span>
                  <span>Large</span>
                </div>
              </div>

              {/* Photo Position */}
              <div>
                <label className="block text-sm font-medium mb-2">Photo Position</label>
                <div className="grid grid-cols-4 gap-2">
                  {photoPositions.map((pos) => (
                    <button
                      key={pos.id}
                      onClick={() => update({ photoPosition: pos.id })}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        config.photoPosition === pos.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="text-sm font-medium">{pos.label}</div>
                      <div className="text-xs text-muted-foreground">{pos.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={config.name}
                    onChange={(e) => update({ name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Title</label>
                    <input
                      type="text"
                      placeholder="Software Engineer"
                      value={config.title || ''}
                      onChange={(e) => update({ title: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Subtitle</label>
                    <input
                      type="text"
                      placeholder="San Francisco, CA"
                      value={config.subtitle || ''}
                      onChange={(e) => update({ subtitle: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Bio</label>
                  <textarea
                    placeholder="A short bio..."
                    value={config.bio || ''}
                    onChange={(e) => update({ bio: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Action Buttons</label>
                  {config.actions.length < 3 && (
                    <button
                      onClick={addAction}
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {config.actions.map((action) => (
                    <div key={action.id} className="p-3 rounded-lg border border-border space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Label"
                          value={action.label}
                          onChange={(e) => updateAction(action.id, { label: e.target.value })}
                          className="flex-1 px-2 py-1.5 border border-border rounded text-sm bg-background"
                        />
                        <input
                          type="url"
                          placeholder="URL"
                          value={action.url}
                          onChange={(e) => updateAction(action.id, { url: e.target.value })}
                          className="flex-1 px-2 py-1.5 border border-border rounded text-sm bg-background"
                        />
                        <button
                          onClick={() => removeAction(action.id)}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2 items-center">
                        {/* Icon Picker */}
                        <select
                          value={action.icon || ''}
                          onChange={(e) => updateAction(action.id, { icon: (e.target.value || undefined) as HeaderAction['icon'] })}
                          className="px-2 py-1 border border-border rounded text-xs bg-background"
                        >
                          <option value="">No icon</option>
                          {iconOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                        {/* Variant */}
                        <select
                          value={action.variant}
                          onChange={(e) => updateAction(action.id, { variant: e.target.value as HeaderAction['variant'] })}
                          className="px-2 py-1 border border-border rounded text-xs bg-background"
                        >
                          <option value="solid">Solid</option>
                          <option value="outline">Outline</option>
                          <option value="ghost">Ghost</option>
                        </select>
                        {/* Color */}
                        <div className="flex gap-1">
                          {colorOptions.map((c) => (
                            <button
                              key={c}
                              onClick={() => updateAction(action.id, { color: c })}
                              className={`w-5 h-5 rounded-full border-2 transition-all ${
                                action.color === c ? 'border-foreground scale-110' : 'border-transparent'
                              }`}
                              style={{
                                backgroundColor:
                                  c === 'blue' ? '#2563eb' :
                                  c === 'green' ? '#16a34a' :
                                  c === 'purple' ? '#9333ea' :
                                  c === 'orange' ? '#ea580c' :
                                  '#334155',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {config.actions.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-3 border border-dashed border-border rounded-lg">
                      No action buttons yet
                    </div>
                  )}
                </div>
              </div>

              {/* Style Options */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Text Alignment</label>
                  <div className="flex gap-2">
                    {(['left', 'center'] as const).map((align) => (
                      <button
                        key={align}
                        onClick={() => update({ textAlignment: align })}
                        className={`flex-1 px-3 py-2 rounded-lg border text-sm capitalize ${
                          (config.textAlignment || 'center') === align
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover:border-primary/50'
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">
                    Cover Overlay: {config.overlayOpacity || 0}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    value={config.overlayOpacity || 0}
                    onChange={(e) => update({ overlayOpacity: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium mb-2">Preview</label>
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="transform scale-50 origin-top-left w-[200%]">
                    <HeaderCard config={config} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
