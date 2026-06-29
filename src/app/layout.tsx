import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://galli.page'

export const metadata: Metadata = {
  title: {
    default: 'My Galli — A living gallery of you.',
    template: '%s | My Galli',
  },
  description: 'Create, share, and track beautiful interactive displays. Build your personal page with kits for athletes, resumes, weddings, and more.',
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: 'website',
    siteName: 'My Galli',
    title: 'My Galli — A living gallery of you.',
    description: 'Create, share, and track beautiful interactive displays.',
    url: APP_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My Galli — A living gallery of you.',
    description: 'Create, share, and track beautiful interactive displays.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
