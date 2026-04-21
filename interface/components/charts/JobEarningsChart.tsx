'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { JobWorkspace } from '@/lib/types'
import { parseEarnings } from '@/lib/utils'

export default function JobEarningsChart({ jobs, bnbPrice }: { jobs: JobWorkspace[]; bnbPrice?: number }) {
  const data = jobs.map(j => ({
    name: j.name.replace(/-/g, ' '),
    earnings: parseEarnings(j.total_earnings),
  }))
  if (data.every(d => d.earnings === 0)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: 'var(--text-muted)', fontSize: 13 }}>
        No earnings recorded yet
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 32 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} angle={-30} textAnchor="end" />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(v: unknown) => {
            const n = Number(v)
            return [bnbPrice ? `${n} BNB (~$${(n * bnbPrice).toFixed(2)})` : `${n} BNB`, 'Earnings']
          }}
        />
        <Bar dataKey="earnings" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill="#22c55e" />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
