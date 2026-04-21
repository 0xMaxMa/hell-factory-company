'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/run', label: 'Run Job' },
  { href: '/config', label: 'Config' },
]

export default function Nav() {
  const path = usePathname()
  return (
    <nav style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 32,
      height: 56,
    }}>
      <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: 'var(--text)' }}>
        🏭 HELL FACTORY
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {links.map(l => (
          <Link key={l.href} href={l.href} style={{
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            textDecoration: 'none',
            background: path === l.href ? 'rgba(0,102,255,0.15)' : 'transparent',
            color: path === l.href ? 'var(--accent-alt)' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}>
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
