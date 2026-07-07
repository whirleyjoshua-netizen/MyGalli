'use client'

import { useState, useEffect } from 'react'
import { Clock, MapPin, Phone, Mail, Globe, ExternalLink } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { isOpenNow } from '@/lib/business-hours'

interface Props {
  element: CanvasElement
}

export function PublicBusinessHoursElement({ element }: Props) {
  const schedule = element.bizHoursSchedule ?? []
  const [status, setStatus] = useState<{ open: boolean; label: string } | null>(null)
  useEffect(() => {
    setStatus(schedule.length > 0 ? isOpenNow(schedule, new Date()) : null)
  }, [schedule])
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  const hasContact = element.bizHoursAddress || element.bizHoursPhone || element.bizHoursEmail || element.bizHoursWebsite

  return (
    <div className="space-y-5">
      {(element.bizHoursTitle || status) && (
        <div className="flex items-center gap-3 flex-wrap">
          {element.bizHoursTitle && (
            <div className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Clock className="w-5 h-5 text-amber-500" />
              {element.bizHoursTitle}
            </div>
          )}
          {status && (
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
              status.open ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.open ? 'bg-green-500' : 'bg-gray-400'}`} />
              {status.label}
            </span>
          )}
        </div>
      )}

      {/* Hours table */}
      {schedule.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          {schedule.map((day, index) => {
            const isToday = day.day === today
            return (
              <div
                key={index}
                className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                  index > 0 ? 'border-t border-border' : ''
                } ${isToday ? 'bg-amber-50 font-semibold' : ''}`}
              >
                <span className={isToday ? 'text-amber-700' : 'text-foreground'}>
                  {day.day}
                  {isToday && <span className="ml-2 text-[10px] font-medium bg-amber-500 text-white px-1.5 py-0.5 rounded-full">Today</span>}
                </span>
                <span className={`${day.closed ? 'text-red-500' : isToday ? 'text-amber-700' : 'text-muted-foreground'}`}>
                  {day.closed ? 'Closed' : `${day.open} – ${day.close}`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Special note */}
      {element.bizHoursSpecialNote && (
        <p className="text-xs text-muted-foreground italic bg-muted/30 rounded-lg px-3 py-2">
          {element.bizHoursSpecialNote}
        </p>
      )}

      {/* Contact info */}
      {hasContact && (
        <div className="space-y-2.5">
          {element.bizHoursAddress && (
            <div className="flex items-start gap-2.5 text-sm">
              <MapPin className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              {element.bizHoursMapsUrl ? (
                <a href={element.bizHoursMapsUrl} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-amber-600 underline underline-offset-2">
                  {element.bizHoursAddress}
                </a>
              ) : (
                <span className="text-foreground">{element.bizHoursAddress}</span>
              )}
            </div>
          )}
          {element.bizHoursPhone && (
            <div className="flex items-center gap-2.5 text-sm">
              <Phone className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <a href={`tel:${element.bizHoursPhone}`} className="text-foreground hover:text-amber-600 underline underline-offset-2">
                {element.bizHoursPhone}
              </a>
            </div>
          )}
          {element.bizHoursEmail && (
            <div className="flex items-center gap-2.5 text-sm">
              <Mail className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <a href={`mailto:${element.bizHoursEmail}`} className="text-foreground hover:text-amber-600 underline underline-offset-2">
                {element.bizHoursEmail}
              </a>
            </div>
          )}
          {element.bizHoursWebsite && (
            <div className="flex items-center gap-2.5 text-sm">
              <Globe className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <a href={element.bizHoursWebsite} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-amber-600 underline underline-offset-2">
                {element.bizHoursWebsite}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
