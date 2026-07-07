import { redirect } from 'next/navigation'

export default function MessagesRedirect() {
  redirect('/data?tab=messages')
}
