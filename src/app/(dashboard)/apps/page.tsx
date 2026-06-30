import { redirect } from 'next/navigation'

// The Apps storefront now lives inside the Library hub. Its previous standalone
// implementation (AppsClient) is preserved in git history.
export default function AppsPage() {
  redirect('/library?tab=apps')
}
