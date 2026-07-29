'use client'

import { useState, useRef } from 'react'
import { Trash2, FileCode } from 'lucide-react'
import { Highlight, themes } from 'prism-react-renderer'

export const CODE_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'markup', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'bash', label: 'Bash / Shell' },
  { value: 'sql', label: 'SQL' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
]

interface CodeElementProps {
  content: string
  language: string
  theme: 'dark' | 'light'
  showLineNumbers: boolean
  filename: string
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onChange: (updates: {
    content?: string
    language?: string
    theme?: 'dark' | 'light'
    showLineNumbers?: boolean
    filename?: string
  }) => void
}

export function CodeElement({
  content,
  language,
  theme,
  showLineNumbers,
  filename,
  isSelected,
  onSelect,
  onDelete,
  onChange,
}: CodeElementProps) {
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDark = theme === 'dark'
  const themeObject = isDark ? themes.vsDark : themes.github

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.target as HTMLTextAreaElement
      const start = target.selectionStart
      const end = target.selectionEnd
      const newContent = content.substring(0, start) + '  ' + content.substring(end)
      onChange({ content: newContent })
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2
      })
    }
  }

  const lineCount = Math.max(5, content.split('\n').length + 1)

  return (
    <div
      className={`relative group rounded-lg overflow-hidden transition-all ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {/* Filename header */}
      {filename && (
        <div className={`flex items-center gap-2 px-4 py-2 text-sm ${
          isDark ? 'bg-[#2d2d2d] text-gray-300' : 'bg-gray-100 text-gray-600'
        }`}>
          <FileCode className="w-4 h-4" />
          <span>{filename}</span>
        </div>
      )}

      {/* Code area */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange({ content: e.target.value })}
          onBlur={() => setIsEditing(false)}
          onKeyDown={handleKeyDown}
          autoFocus
          rows={lineCount}
          className={`w-full p-4 text-sm font-mono resize-none outline-none ${
            isDark
              ? 'bg-[#1e1e1e] text-gray-200'
              : 'bg-[#ffffff] text-gray-800'
          }`}
          style={{ tabSize: 2 }}
          spellCheck={false}
        />
      ) : (
        <div
          className="cursor-text"
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
            setIsEditing(true)
          }}
        >
          <Highlight theme={themeObject} code={content || ' '} language={language}>
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre
                className={`${className} overflow-x-auto text-sm`}
                style={{ ...style, margin: 0, padding: '1rem' }}
              >
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line })}>
                    {showLineNumbers && (
                      <span className="inline-block w-8 text-right mr-4 opacity-40 select-none text-xs">
                        {i + 1}
                      </span>
                    )}
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        </div>
      )}

      {/* Controls */}
      {isSelected && (
        <div className="absolute -top-3 right-2 flex items-center gap-1 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  )
}
