'use client'

import { Folder, ChevronRight, ChevronDown, Lock } from 'lucide-react'
import { useState } from 'react'
import type { TreeNode } from '@/lib/hub-tree'

interface HubFolderTreeProps {
  tree: TreeNode[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

function FolderRow({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: TreeNode
  depth: number
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        className={`w-full flex items-center gap-1.5 py-1.5 pr-2 rounded-lg text-sm transition-colors ${
          isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/60 text-foreground'
        }`}
      >
        {hasChildren ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
            className="p-0.5 -ml-1 rounded hover:bg-muted"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
        ) : (
          <span className="w-4" />
        )}
        <Folder className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{node.name}</span>
        {node.visibility === 'private' && (
          <Lock className="w-3 h-3 shrink-0 ml-auto text-galli-violet" aria-label="Private" />
        )}
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <FolderRow key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

export function HubFolderTree({ tree, selectedId, onSelect }: HubFolderTreeProps) {
  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`w-full flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-sm transition-colors ${
          selectedId === null ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/60 text-foreground'
        }`}
      >
        <Folder className="w-3.5 h-3.5" />
        Root
      </button>
      {tree.map((node) => (
        <FolderRow key={node.id} node={node} depth={1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  )
}
