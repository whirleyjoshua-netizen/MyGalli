import { Mail } from 'lucide-react'
import { PageHero } from '@/components/dashboard/PageHero'
import { MessagesInbox } from '@/components/dashboard/MessagesInbox'

export default function MessagesPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageHero
        icon={<Mail className="w-7 h-7 text-primary" />}
        title="Messages"
        subtitle="Written and voice messages from your visitors, all in one inbox."
      />

      <main className="w-full px-4 py-8 sm:px-6">
        <MessagesInbox />
      </main>
    </div>
  )
}
