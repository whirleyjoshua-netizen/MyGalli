import type { Section } from '@/lib/types/canvas'
import type { BackgroundConfig } from '@/lib/types/background'
import { getBackgroundStyles, DEFAULT_BACKGROUND_CONFIG } from '@/lib/types/background'
import { renderElement, getGridClass, getColumnStyles } from '@/lib/render-elements'

export function ProfileCanvas({
  sections,
  background,
  displayId,
}: {
  sections: Section[]
  background?: BackgroundConfig | null
  displayId: string
}) {
  if (!sections || sections.length === 0) return null
  const bg = background || DEFAULT_BACKGROUND_CONFIG
  return (
    <div className="mt-6 rounded-2xl border border-border overflow-hidden" style={getBackgroundStyles(bg)}>
      <div className="p-5 space-y-8">
        {sections.map((section) => (
          <div key={section.id} className={`grid gap-6 ${getGridClass(section.layout)}`}>
            {section.columns.map((column) => (
              <div key={column.id} style={getColumnStyles(column)}>
                {column.elements.map((element) => (
                  <div key={element.id}>{renderElement(element, displayId)}</div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
