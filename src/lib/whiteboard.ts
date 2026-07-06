// Pure helpers for the whiteboard element. No fabric / no DOM — unit-testable.

export interface ArtboardPreset {
  label: string
  width: number
  height: number
}

export const ARTBOARD_PRESETS: ArtboardPreset[] = [
  { label: '16:9', width: 800, height: 450 },
  { label: '4:3', width: 800, height: 600 },
  { label: '1:1', width: 600, height: 600 },
]

// Append a scene snapshot to a bounded history stack (immutable).
export function pushHistory(stack: string[], scene: string, cap = 50): string[] {
  const next = [...stack, scene]
  return next.length > cap ? next.slice(next.length - cap) : next
}

// Stable Blob filename for an element's rendered PNG preview.
export function previewFilename(elementId: string): string {
  return `whiteboard-${elementId}.png`
}

// True when the scene has no drawable content (used to skip preview / render).
export function isBlankScene(scene?: string): boolean {
  if (!scene || !scene.trim()) return true
  try {
    const parsed = JSON.parse(scene) as { objects?: unknown[] }
    return !Array.isArray(parsed.objects) || parsed.objects.length === 0
  } catch {
    return true
  }
}
