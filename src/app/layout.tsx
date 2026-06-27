import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://galli.page'

export const metadata: Metadata = {
  title: {
    default: 'Galli — A living gallery of you.',
    template: '%s | Galli',
  },
  description: 'Create, share, and track beautiful interactive displays. Build your personal page with kits for athletes, resumes, weddings, and more.',
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: 'website',
    siteName: 'Galli',
    title: 'Galli — A living gallery of you.',
    description: 'Create, share, and track beautiful interactive displays.',
    url: APP_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Galli — A living gallery of you.',
    description: 'Create, share, and track beautiful interactive displays.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
