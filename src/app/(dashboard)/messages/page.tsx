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

      <main className="max-w-7xl mx-auto px-6 py-8">
        <MessagesInbox />
      </main>
    </div>
  )
}
