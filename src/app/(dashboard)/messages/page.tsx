import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { Mail } from 'lucide-react'
import { verifyAuth } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/constants'
import { PageHero } from '@/components/dashboard/PageHero'
import { MessagesClient } from '@/components/messages/MessagesClient'

export default async function MessagesPage() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value
  const auth = token ? await verifyAuth(token) : null

  return (
    <div className="min-h-screen bg-background">
      <PageHero
        icon={<Mail className="w-7 h-7 text-primary" />}
        title="Messages"
        subtitle="Conversations with members, plus written and voice notes from your visitors."
      />
      {/* useSearchParams needs a Suspense boundary to avoid opting the whole
          route into client-side rendering at build time. */}
      <Suspense fallback={<p className="px-6 py-8 text-sm text-muted-foreground lg:px-8">Loading…</p>}>
        <MessagesClient myId={auth?.id ?? ''} />
      </Suspense>
    </div>
  )
}
