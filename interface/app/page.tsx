'use client'
import useSWR from 'swr'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import TransactionList from '@/components/TransactionList'
import { JobWorkspace, Transaction } from '@/lib/types'

const WalletHistoryChart = dynamic(() => import('@/components/charts/WalletHistoryChart'), { ssr: false })
const JobRunsChart = dynamic(() => import('@/components/charts/JobRunsChart'), { ssr: false })
const JobEarningsChart = dynamic(() => import('@/components/charts/JobEarningsChart'), { ssr: false })

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
  const { data: walletData } = useSWR('/api/wallet', fetcher, { refreshInterval: 60000 })
  const { data: historyData } = useSWR('/api/wallet/history', fetcher, { refreshInterval: 60000 })
  const { data: txData } = useSWR('/api/wallet/transactions', fetcher, { refreshInterval: 120000 })
  const { data: sessionsData } = useSWR('/api/sessions', fetcher, { refreshInterval: 5000 })

  const jobs: JobWorkspace[] = jobsData?.jobs || []
  const wallet = walletData
  const walletHistory = historyData?.history || []
  const transactions: Transaction[] = txData?.transactions || []
  const sessions = sessionsData?.sessions || []
  const activeSessions = sessions.filter((s: { status: string }) => s.status === 'active')

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
            {sessions.length} total · {activeSessions.length} active
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
            {activeSessions.map((s: { id: string; jobName: string; createdAt: string }) => (
              <div key={s.id} className="card-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--success)' }} className="animate-pulse-glow">●</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{s.id}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {s.createdAt ? new Date(s.createdAt).toLocaleTimeString() : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Charts */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 16 }}>📊 Portfolio Value (Daily)</div>
        <WalletHistoryChart data={walletHistory} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 12 }}>🔁 Job Runs</div>
          <JobRunsChart jobs={jobs} />
        </div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 12 }}>💵 Earnings per Job (BNB)</div>
          <JobEarningsChart jobs={jobs} bnbPrice={wallet?.bnb_price ? parseFloat(wallet.bnb_price) : undefined} />
        </div>
      </div>

      {/* Transaction list */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 16 }}>💳 Recent Incoming Transactions</div>
        <TransactionList
          txs={transactions}
          loading={!txData && !txData?.error}
          error={txData?.error}
        />
      </div>

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
