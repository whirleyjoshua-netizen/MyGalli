// src/lib/upload-validate.ts
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm']
const DOC_TYPES = ['application/pdf']
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
export const MAX_IMAGE = 10 * 1024 * 1024
const MAX_AUDIO = 25 * 1024 * 1024
const MAX_DOC = 25 * 1024 * 1024
export const MAX_VIDEO = 100 * 1024 * 1024

const EXT: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac',
  'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/webm': '.weba',
  'application/pdf': '.pdf',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
}

export function extensionForMime(mime: string): string {
  return EXT[mime] || ''
}

// Reverse of EXT, so the local-dev file server serves exactly what this module
// lets people upload. These two drifted before: uploads accepted PDF/audio/video
// while the reader only served images, which 403'd every non-image in dev (a
// Lead Gen PDF, a mailbox voice message). Derive it rather than hand-maintaining
// a second list.
const MIME_BY_EXT: Record<string, string> = Object.entries(EXT).reduce(
  (acc, [mime, ext]) => {
    // First mime wins: several map to .m4a, and image/jpeg must win .jpg.
    if (ext && !acc[ext]) acc[ext] = mime
    return acc
  },
  {} as Record<string, string>
)

export function mimeForExtension(ext: string): string | undefined {
  return MIME_BY_EXT[ext.toLowerCase()]
}

export function validateUpload(type: string, size: number): { ok: true } | { ok: false; error: string } {
  const isImage = IMAGE_TYPES.includes(type)
  const isAudio = AUDIO_TYPES.includes(type)
  const isDoc = DOC_TYPES.includes(type)
  const isVideo = VIDEO_TYPES.includes(type)
  if (!isImage && !isAudio && !isDoc && !isVideo) {
    return { ok: false, error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, audio (MP3, M4A, AAC, OGG, WAV), PDF, or video (MP4, WebM, MOV).' }
  }
  const max = isVideo ? MAX_VIDEO : isDoc ? MAX_DOC : isAudio ? MAX_AUDIO : MAX_IMAGE
  if (size > max) {
    return { ok: false, error: `File too large. Maximum size is ${Math.round(max / 1024 / 1024)}MB` }
  }
  return { ok: true }
}
