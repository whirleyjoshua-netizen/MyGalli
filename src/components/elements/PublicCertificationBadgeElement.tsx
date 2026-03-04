'use client'

import { Award, ExternalLink } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

export function PublicCertificationBadgeElement({ element }: Props) {
  const name = element.certName
  const issuer = element.certIssuer
  const dateObtained = element.certDateObtained
  const expirationDate = element.certExpirationDate
  const credentialId = element.certCredentialId
  const credentialUrl = element.certCredentialUrl

  if (!name && !issuer) return null

  return (
    <div className="rounded-xl border border-border/50 bg-white overflow-hidden">
      <div className="flex">
        <div className="w-1 bg-[#6C63FF] flex-shrink-0" />

        <div className="p-4 flex-1">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#6C63FF]/10 text-[#6C63FF] mt-0.5 flex-shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              {name && <div className="font-semibold text-foreground text-lg">{name}</div>}
              {issuer && <div className="text-foreground/70">{issuer}</div>}

              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {dateObtained && (
                  <span className="text-sm text-muted-foreground">
                    Issued {dateObtained}
                  </span>
                )}
                {expirationDate && (
                  <span className="text-sm text-muted-foreground">
                    · Expires {expirationDate}
                  </span>
                )}
                {!expirationDate && dateObtained && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    No Expiration
                  </span>
                )}
              </div>

              {credentialId && (
                <div className="mt-1.5 text-xs text-muted-foreground">
                  Credential ID: {credentialId}
                </div>
              )}

              {credentialUrl && (
                <a
                  href={credentialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-[#6C63FF]/10 text-[#6C63FF] rounded-lg text-sm font-medium hover:bg-[#6C63FF]/20 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Verify Credential
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
