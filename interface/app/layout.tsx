import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: 'Hell Factory',
  description: 'AI Agent Workforce Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <Nav />
        <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
