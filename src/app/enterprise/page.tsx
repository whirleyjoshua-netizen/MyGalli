import EnterpriseNav from '@/components/enterprise/EnterpriseNav'
import HeroSection from '@/components/enterprise/HeroSection'
import ProblemSection from '@/components/enterprise/ProblemSection'
import SolutionSection from '@/components/enterprise/SolutionSection'
import AthleticSection from '@/components/enterprise/AthleticSection'
import SchoolSection from '@/components/enterprise/SchoolSection'
import { HowItWorks } from '@/components/enterprise/HowItWorks'
import { PricingTeaser } from '@/components/enterprise/PricingTeaser'
import { WaitlistForm } from '@/components/enterprise/WaitlistForm'
import { EnterpriseFooter } from '@/components/enterprise/EnterpriseFooter'

export const metadata = {
  title: 'Galli Enterprise — The Operating System for Student Identity',
  description:
    'Galli Enterprise gives schools, athletic programs, and districts a structured platform to track student growth, showcase achievements, and build digital identities.',
}

export default function EnterprisePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <EnterpriseNav />
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <AthleticSection />
      <SchoolSection />
      <HowItWorks />
      <PricingTeaser />
      <WaitlistForm />
      <EnterpriseFooter />
    </main>
  )
}
