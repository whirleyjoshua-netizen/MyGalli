import { redirect } from 'next/navigation'

// Card Studio is DORMANT for now. It is a separate, dedicated build planned for
// after release. Its previous full implementation is preserved in git history
// (restore that file when resuming the build). Until then, /card-studio sends
// users to the Library Apps tab, which is the current way to add cards.
export default function CardStudioPage() {
  redirect('/library?tab=apps')
}
