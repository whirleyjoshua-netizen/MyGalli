import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gallio.app'

export const metadata: Metadata = {
  title: {
    default: 'Gallio — A living gallery of you.',
    template: '%s | Gallio',
  },
  description: 'Create, share, and track beautiful interactive displays. Build your personal page with kits for athletes, resumes, weddings, and more.',
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: 'website',
    siteName: 'Gallio',
    title: 'Gallio — A living gallery of you.',
    description: 'Create, share, and track beautiful interactive displays.',
    url: APP_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gallio — A living gallery of you.',
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
