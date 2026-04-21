'use client'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { JobWorkspace } from '@/lib/types'

export default function JobRunsChart({ jobs }: { jobs: JobWorkspace[] }) {
  const router = useRouter()
  const data = jobs.map(j => ({ name: j.name.replace(/-/g, ' '), rawName: j.name, runs: j.run_count || 0 }))
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

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 32 }} onClick={handleClick}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} angle={-30} textAnchor="end" />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(v: unknown) => [Number(v), 'Runs']}
        />
        <Bar dataKey="runs" radius={[4, 4, 0, 0]} cursor="pointer">
          {data.map((_, i) => <Cell key={i} fill="var(--accent)" />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
