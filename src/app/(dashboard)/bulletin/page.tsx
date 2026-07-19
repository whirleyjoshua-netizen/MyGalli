'use client'

import { Megaphone } from 'lucide-react'
import { BulletinTab } from '@/components/bulletin/BulletinTab'
import { PageHero } from '@/components/dashboard/PageHero'

export default function BulletinPage() {
  return (
    <div className="pb-7">
      <PageHero
        icon={<Megaphone className="w-7 h-7 text-primary" />}
        title="Bulletin"
        subtitle="Post updates for your followers, and see theirs."
      />
      <div className="px-6 lg:px-8">
        <div className="max-w-2xl">
          <BulletinTab />
        </div>
      </div>
    </div>
  )
}
