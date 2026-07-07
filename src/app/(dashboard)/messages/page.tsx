import { MessagesInbox } from '@/components/dashboard/MessagesInbox'

export default function MessagesPage() {
  return (
    <div className="px-6 lg:px-8 py-7">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-1">Messages</h1>
      <p className="text-muted-foreground mb-6">Private messages people sent you through your pages.</p>
      <MessagesInbox />
    </div>
  )
}
