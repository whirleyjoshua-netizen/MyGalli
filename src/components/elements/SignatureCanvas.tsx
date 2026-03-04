'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { X, RotateCcw, Send } from 'lucide-react'

interface Props {
  onSubmit: (data: { name: string; pathData: string; color: string }) => void
  onClose: () => void
}

const COLORS = ['#000000', '#1a1a2e', '#39D98A', '#1FB6FF', '#6C63FF', '#E74C3C', '#F59E0B', '#EC4899']

export function SignatureCanvas({ onSubmit, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#000000')
  const [paths, setPaths] = useState<{ x: number; y: number }[][]>([])
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([])

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    }
  }, [])

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDrawing(true)
    const pos = getPos(e)
    setCurrentPath([pos])
  }, [getPos])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    const pos = getPos(e)
    setCurrentPath(prev => [...prev, pos])
  }, [isDrawing, getPos])

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return
    setIsDrawing(false)
    if (currentPath.length > 1) {
      setPaths(prev => [...prev, currentPath])
    }
    setCurrentPath([])
  }, [isDrawing, currentPath])

  // Redraw canvas whenever paths change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const drawPath = (points: { x: number; y: number }[]) => {
      if (points.length < 2) return
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y)
      }
      ctx.stroke()
    }

    paths.forEach(drawPath)
    if (currentPath.length > 1) drawPath(currentPath)
  }, [paths, currentPath, color])

  const clear = () => {
    setPaths([])
    setCurrentPath([])
  }

  const toSVGPath = (): string => {
    const allPaths = paths.map(points => {
      if (points.length < 2) return ''
      let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
      for (let i = 1; i < points.length; i++) {
        d += ` L${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`
      }
      return d
    })
    return allPaths.filter(Boolean).join(' ')
  }

  const handleSubmit = () => {
    if (!name.trim() || paths.length === 0) return
    onSubmit({
      name: name.trim(),
      pathData: toSVGPath(),
      color,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl shadow-2xl border border-border max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-lg">Sign the Jersey</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name input */}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary bg-muted/30"
            maxLength={30}
          />

          {/* Drawing canvas */}
          <div className="border border-border rounded-xl overflow-hidden bg-white relative">
            <canvas
              ref={canvasRef}
              width={400}
              height={200}
              className="w-full cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            {paths.length === 0 && !isDrawing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-sm text-muted-foreground/40">Draw your signature here</span>
              </div>
            )}
          </div>

          {/* Color picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Color:</span>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition ${
                  color === c ? 'border-foreground scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={clear}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-full hover:bg-muted transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || paths.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-full hover:opacity-90 transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              Sign Jersey
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
