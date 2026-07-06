'use client'

import { use } from 'react'
import { HubEditor } from '@/components/hub/HubEditor'

export default function HubEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <HubEditor hubId={id} />
}
