'use client'

import { Megaphone } from 'lucide-react'
import { BulletinTab } from '@/components/bulletin/BulletinTab'

export default function BulletinPage() {
  return (
    <div className="px-6 lg:px-8 py-7">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          <Megaphone className="w-6 h-6 text-primary" /> Bulletin
        </h1>
        <p className="text-muted-foreground mt-1">Post updates for your followers, and see theirs.</p>
      </div>

      <div className="max-w-2xl">
        <BulletinTab />
      </div>
    </div>
  )
}
