'use client'

import type { ElementSummary } from '@/lib/element-os'

// The distinctive middle of a card, per element family. Kept deliberately thin:
// the full roster and distribution live in the drawer, this is the glance.
export function CardBody({ element }: { element: ElementSummary }) {
  if (element.responseCount === 0) {
    return <p className="text-sm text-muted-foreground">No responses yet</p>
  }

  switch (element.type) {
    case 'mailbox':
      return (
        <p className="text-sm">
          {element.unreadCount > 0 ? (
            <span className="font-semibold text-amber-600">{element.unreadCount} unread</span>
          ) : (
            <span className="text-muted-foreground">All caught up</span>
          )}
        </p>
      )
    case 'waitlist':
      return <p className="text-sm font-medium">{element.responseCount.toLocaleString('en-US')} joined</p>
    case 'lead-gen':
      return (
        <p className="text-sm font-medium">
          {element.responseCount.toLocaleString('en-US')} lead
          {element.responseCount === 1 ? '' : 's'}
        </p>
      )
    case 'appointments':
      return <p className="text-sm font-medium">{element.responseCount.toLocaleString('en-US')} booked</p>
    case 'rsvp':
    case 'wedding-rsvp':
      return <p className="text-sm font-medium">{element.responseCount.toLocaleString('en-US')} RSVPs</p>
    case 'jersey':
      return <p className="text-sm font-medium">{element.responseCount.toLocaleString('en-US')} signatures</p>
    default:
      return (
        <p className="text-sm text-muted-foreground">
          {element.responseCount.toLocaleString('en-US')} response
          {element.responseCount === 1 ? '' : 's'} collected
        </p>
      )
  }
}
