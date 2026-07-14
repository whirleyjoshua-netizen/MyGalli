export type ProfileActionKey = 'mailbox' | 'message' | 'share' | 'follow' | 'edit'

export interface ProfileActionSpec {
  key: ProfileActionKey
  label: string
  sublabel: string
}

export function getProfileActionCards(isOwner: boolean): ProfileActionSpec[] {
  if (isOwner) {
    return [
      { key: 'mailbox', label: 'Mailbox', sublabel: 'View messages' },
      { key: 'share', label: 'Share Profile', sublabel: 'Share your Galli' },
      { key: 'edit', label: 'Edit', sublabel: 'Edit your profile' },
    ]
  }
  return [
    { key: 'message', label: 'Message', sublabel: 'Send a message' },
    { key: 'share', label: 'Share Profile', sublabel: 'Share your Galli' },
    { key: 'follow', label: 'Follow', sublabel: 'Follow this Galli' },
  ]
}
