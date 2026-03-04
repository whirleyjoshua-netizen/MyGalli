import { Users } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface PartyMember {
  name: string
  role: string
  group: 'bride' | 'groom' | 'shared'
  photo?: string
}

interface Props {
  element: CanvasElement
}

export function PublicWeddingPartyElement({ element }: Props) {
  const title = element.weddingPartyTitle || 'Wedding Party'
  const members: PartyMember[] = element.weddingPartyMembers || []

  const brideMembers = members.filter(m => m.group === 'bride')
  const groomMembers = members.filter(m => m.group === 'groom')
  const sharedMembers = members.filter(m => m.group === 'shared')

  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-white/50 p-8 text-center">
        <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No wedding party members yet</p>
      </div>
    )
  }

  const MemberCard = ({ member }: { member: PartyMember }) => (
    <div className="flex flex-col items-center text-center p-4 rounded-xl bg-white/70 border border-[#E8B4B8]/30 shadow-sm">
      {/* Photo circle */}
      <div
        className="w-20 h-20 rounded-full mb-3 overflow-hidden flex items-center justify-center"
        style={{
          border: '3px solid #E8B4B8',
          backgroundColor: member.photo ? 'transparent' : '#FDF2F3',
        }}
      >
        {member.photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
        ) : (
          <Users className="w-8 h-8" style={{ color: '#E8B4B8' }} />
        )}
      </div>

      {/* Name */}
      <h4 className="font-semibold text-sm text-foreground">{member.name || 'Guest'}</h4>

      {/* Role */}
      {member.role && (
        <span
          className="mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full"
          style={{ backgroundColor: '#FDF2F3', color: '#C9888D' }}
        >
          {member.role}
        </span>
      )}
    </div>
  )

  const GroupSection = ({ label, groupMembers }: { label: string; groupMembers: PartyMember[] }) => {
    if (groupMembers.length === 0) return null

    return (
      <div className="mb-6 last:mb-0">
        <h3
          className="text-sm font-semibold uppercase tracking-wider mb-3 px-1"
          style={{ color: '#C9888D' }}
        >
          {label}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {groupMembers.map((member, i) => (
            <MemberCard key={i} member={member} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[#E8B4B8]/30 bg-white/50 overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-2 border-b"
        style={{ borderColor: '#E8B4B8', backgroundColor: '#FDF2F3' }}
      >
        <Users className="w-5 h-5" style={{ color: '#C9888D' }} />
        <h3 className="font-semibold text-lg" style={{ color: '#7A4F52' }}>{title}</h3>
        <span
          className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: '#E8B4B8', color: '#fff' }}
        >
          {members.length} member{members.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Body */}
      <div className="p-5">
        <GroupSection label="Bride's Side" groupMembers={brideMembers} />
        <GroupSection label="Groom's Side" groupMembers={groomMembers} />
        <GroupSection label="Shared" groupMembers={sharedMembers} />
      </div>
    </div>
  )
}
