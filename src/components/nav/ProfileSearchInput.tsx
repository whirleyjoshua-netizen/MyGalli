'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchBox } from './SearchBox'

export function ProfileSearchInput() {
  const router = useRouter()
  const [value, setValue] = useState('')

  return (
    <SearchBox
      value={value}
      onChange={setValue}
      onSubmit={() => {
        const q = value.trim()
        if (!q) return
        router.push(`/explore?search=${encodeURIComponent(q)}`)
      }}
    />
  )
}
