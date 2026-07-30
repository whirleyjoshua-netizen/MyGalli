import { Calendar, FileText, ListPlus, Download, MessageSquare, StickyNote } from 'lucide-react'

/**
 * Canonical activity source → icon mapping, shared by every place that
 * renders a CrmActivity (contact card, list view, drawer timeline). Do not
 * fork a local copy — a prior drift meant the same source rendered a
 * different icon depending on which component you were looking at.
 */
export const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  booking: Calendar,
  form: FileText,
  waitlist: ListPlus,
  'lead-capture': Download,
  comment: MessageSquare,
  note: StickyNote,
}

export function SourceIcon({ source, className }: { source: string; className?: string }) {
  const Cmp = SOURCE_ICONS[source] || StickyNote
  return <Cmp className={className} />
}
