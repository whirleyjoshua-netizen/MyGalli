import { Suspense } from 'react'
import { LibraryClient } from '@/components/library/LibraryClient'

export const metadata = { title: 'Library' }

export default function LibraryPage() {
  return (
    <Suspense fallback={<div />}>
      <LibraryClient />
    </Suspense>
  )
}
