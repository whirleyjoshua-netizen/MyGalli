import { redirect } from 'next/navigation'

// The kit gallery now lives in the Library. Its previous standalone
// implementation is preserved in git history.
export default function NewKitPage() {
  redirect('/library?tab=kits')
}
