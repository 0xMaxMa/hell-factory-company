'use client'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { JobWorkspace, Payment } from '@/lib/types'

export default function JobRunsChart({ jobs, payments = [] }: { jobs: JobWorkspace[]; payments?: Payment[] }) {
  const router = useRouter()
  const earningsByJob: Record<string, number> = {}
  for (const p of payments) earningsByJob[p.job] = (earningsByJob[p.job] || 0) + parseFloat(p.amount || '0')
  const data = jobs.map(j => ({ name: j.name.replace(/-/g, ' '), rawName: j.name, runs: j.run_count || 0, earned: earningsByJob[j.name] || 0 }))
  if (data.every(d => d.runs === 0)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: 'var(--text-muted)', fontSize: 13 }}>
        No runs yet
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleClick(chartData: any) {
    if (chartData?.activePayload?.[0]) {
      router.push(`/run?job=${chartData.activePayload[0].payload.rawName}`)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function CustomTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, minWidth: 140 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.name}</div>
        <div>Runs: <strong>{d.runs}</strong></div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 32 }} onClick={handleClick} tabIndex={-1}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} angle={-30} textAnchor="end" />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        <Bar dataKey="runs" radius={[4, 4, 0, 0]} cursor="pointer" activeBar={false}>
          {data.map((_, i) => <Cell key={i} fill="var(--accent)" />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
