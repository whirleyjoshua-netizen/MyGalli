import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { Users } from 'lucide-react'
import { db } from '@/lib/db'
import { getJwtSecret } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/constants'
import { ensureStages } from '@/lib/crm/stages'
import { PageHero } from '@/components/dashboard/PageHero'
import { CrmBoard } from '@/components/crm/CrmBoard'

export default async function CrmPage() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value
  let userId: string | null = null
  if (token) {
    try { userId = (verify(token, getJwtSecret()) as { userId: string }).userId } catch { userId = null }
  }
  if (!userId) redirect('/login')

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) redirect('/login')

  // CRM is free — no plan check here, ever.
  const stages = await ensureStages(user.id)
  const contacts = await db.crmContact.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 500,
    include: { activities: { orderBy: { occurredAt: 'desc' }, take: 1 } },
  })

  return (
    <div className="min-h-screen bg-background">
      <PageHero
        icon={<Users className="w-7 h-7 text-primary" />}
        title="CRM"
        subtitle="Every lead your page captures, organized into a pipeline."
      />
      <main className="w-full py-6">
        <CrmBoard stages={stages} contacts={contacts} />
      </main>
    </div>
  )
}
