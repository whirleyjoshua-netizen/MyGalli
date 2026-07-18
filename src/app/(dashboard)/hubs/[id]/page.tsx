'use client'

import { use, useEffect, useState } from 'react'
import { HubEditor } from '@/components/hub/HubEditor'
import { HubBuilder } from '@/components/hub/builder/HubBuilder'

export default function HubEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [community, setCommunity] = useState<boolean | null>(null)
  useEffect(() => { fetch(`/api/hubs/${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => setCommunity(!!d?.hub?.community)) }, [id])
  if (community === null) return null
  return community ? <HubBuilder hubId={id} /> : <HubEditor hubId={id} />
}
