'use client'
import useSWR from 'swr'
import Link from 'next/link'
import { JobWorkspace } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function statusBadge(status: string) {
  if (status === 'ready') return <span className="badge badge-green">● ready</span>
  if (status === 'draft') return <span className="badge badge-yellow">● draft</span>
  return <span className="badge badge-gray">● {status}</span>
}

function categoryBadge(cat: string) {
  return <span className="badge badge-blue">{cat}</span>
}

function earningsDisplay(job: JobWorkspace): string {
  if (typeof job.estimated_earnings === 'string') return job.estimated_earnings
  const e = job.estimated_earnings as Record<string, unknown>
  if (e.per_project_min !== undefined) return `$${e.per_project_min}–$${e.per_project_max}/project`
  if (e.typical_apy_range_usdt) return String(e.typical_apy_range_usdt) + ' APY'
  return 'N/A'
}

export default function Dashboard() {
  const { data: jobsData } = useSWR('/api/jobs?all=0', fetcher, { refreshInterval: 10000 })
  const { data: walletData } = useSWR('/api/wallet', fetcher, { refreshInterval: 30000 })
  const { data: gwData } = useSWR('/api/gateway/status', fetcher, { refreshInterval: 5000 })

  const jobs: JobWorkspace[] = jobsData?.jobs || []
  const wallet = walletData
  const activeSessions = gwData?.agents?.flatMap((a: { sessions?: unknown[] }) => a.sessions || []) || []

  const readyJobs = jobs.filter(j => j.status === 'ready')
  const draftJobs = jobs.filter(j => j.status === 'draft')
  const totalRuns = jobs.reduce((sum, j) => sum + (j.run_count || 0), 0)

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Metric row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            💰 Wallet
          </div>
          {wallet?.error ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{wallet.error}</div>
          ) : (
            <>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                ${wallet?.total_usd || '—'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                BNB: {wallet?.bnb || '—'} (${wallet?.bnb_usd || '—'})
              </div>
            </>
          )}
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            🤖 Agent Sessions
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
            {activeSessions.length}
            {activeSessions.length > 0 && <span className="animate-pulse-glow" style={{ marginLeft: 8, color: 'var(--success)', fontSize: 16 }}>●</span>}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            active sessions running
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            📈 Jobs
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
            {jobs.length}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {readyJobs.length} ready · {draftJobs.length} draft · {totalRuns} total runs
          </div>
        </div>
      </div>

      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontWeight: 600 }}>Active Sessions</span>
            <span className="badge badge-green">{activeSessions.length} running</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeSessions.map((s: { session_id: string; started_at: string }) => (
              <div key={s.session_id} className="card-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--success)' }} className="animate-pulse-glow">●</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{s.session_id}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {s.started_at ? new Date(s.started_at).toLocaleTimeString() : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job list */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontWeight: 600 }}>Job Workspaces</span>
          <Link href="/run" className="btn btn-primary" style={{ textDecoration: 'none', fontSize: 13 }}>
            ▶ Run Job
          </Link>
        </div>
        {jobs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '20px 0', textAlign: 'center' }}>
            No job workspaces found. Add jobs to <code style={{ fontSize: 12 }}>job_workspaces/</code>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {jobs.map(job => (
              <div key={job.name} className="card-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{job.name}</span>
                    {statusBadge(job.status)}
                    {categoryBadge(job.category)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {earningsDisplay(job)} · Runs: {job.run_count || 0} · Earned: {job.total_earnings || '0'}
                  </div>
                </div>
                <Link href={`/run?job=${job.name}`} className="btn btn-ghost" style={{ textDecoration: 'none', fontSize: 12 }}>
                  ▶ Run
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
