import { Sidebar } from '@/components/dashboard/Sidebar'
import { MobileNav } from '@/components/dashboard/MobileNav'
import { VerifyBanner } from '@/components/auth/VerifyBanner'
import { PageBackBar } from '@/components/dashboard/PageBackBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <MobileNav />
        <VerifyBanner />
        <PageBackBar />
        {children}
      </main>
    </div>
  )
}
