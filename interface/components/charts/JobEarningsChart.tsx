'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Payment } from '@/lib/types'

export default function JobEarningsChart({ payments }: { payments: Payment[] }) {
  const byJob: Record<string, number> = {}
  for (const p of payments) {
    byJob[p.job] = (byJob[p.job] || 0) + parseFloat(p.amount || '0')
  }
  const data = Object.entries(byJob).map(([name, earnings]) => ({ name, earnings: parseFloat(earnings.toFixed(2)) }))

  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: 'var(--text-muted)', fontSize: 13 }}>
        No earnings recorded yet
      </div>
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function CustomTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 12, minWidth: 130 }}>
        <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>{d.name}</div>
        <div style={{ color: '#4ade80' }}>Earnings: <strong>${d.earnings.toFixed(2)}</strong></div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 32 }} tabIndex={-1}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} angle={-30} textAnchor="end" />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        <Bar dataKey="earnings" radius={[4, 4, 0, 0]} activeBar={false}>
          {data.map((_, i) => <Cell key={i} fill="#22c55e" />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
