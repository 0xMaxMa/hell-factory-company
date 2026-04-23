'use client'
import useSWR from 'swr'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import PaymentList from '@/components/PaymentList'
import { JobWorkspace, Payment } from '@/lib/types'

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
  if (!e) return 'N/A'
  if (e.per_project_min !== undefined) return `$${e.per_project_min}–$${e.per_project_max}/project`
  if (e.typical_apy_range_usdt) return String(e.typical_apy_range_usdt) + ' APY'
  return 'N/A'
}

export default function Dashboard() {
  const { data: jobsData } = useSWR('/api/jobs?all=0', fetcher, { refreshInterval: 10000 })
  const { data: walletData } = useSWR('/api/wallet', fetcher, { refreshInterval: 60000 })
  const { data: historyData } = useSWR('/api/wallet/history', fetcher, { refreshInterval: 60000 })
  const { data: paymentsData } = useSWR('/api/payments', fetcher, { refreshInterval: 30000 })
  const { data: sessionsData } = useSWR('/api/sessions', fetcher, { refreshInterval: 5000 })

  const jobs: JobWorkspace[] = jobsData?.jobs || []
  const wallet = walletData
  const today = new Date().toISOString().slice(0, 10)
  const baseHistory: Array<{ date: string; total_usd: number }> = historyData?.history || []
  const walletHistory = wallet?.total_usd
    ? [...baseHistory.filter((e: { date: string }) => e.date !== today), { date: today, total_usd: parseFloat(wallet.total_usd) }]
    : baseHistory
  const payments: Payment[] = paymentsData?.payments || []
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6 }}>
                {(wallet?.tokens || []).filter((t: { balance: string }) => parseFloat(t.balance) > 0).map((t: { symbol: string; balance: string; usd: string }) => (
                  <span key={t.symbol} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {t.symbol}: <span style={{ color: 'var(--text)' }}>${t.usd}</span>
                  </span>
                ))}
              </div>
              {(wallet?.venus || []).length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.06em' }}>
                    🏦 Venus Protocol
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                    {(wallet.venus as Array<{ symbol: string; underlyingSymbol: string; underlyingAmount: string; usd: string }>).map(v => (
                      <span key={v.symbol} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {v.underlyingSymbol}: <span style={{ color: '#4ade80' }}>{v.underlyingAmount}</span>
                        <span style={{ color: 'var(--text-muted)' }}> (${v.usd})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
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

      {/* Token Holdings */}
      {wallet && !wallet.error && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>🪙 Token Holdings</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, padding: '4px 8px', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
              <span>Token</span>
              <span style={{ textAlign: 'right' }}>Balance</span>
              <span style={{ textAlign: 'right' }}>Price</span>
              <span style={{ textAlign: 'right' }}>Value</span>
            </div>
            {/* Wallet tokens */}
            {(wallet.tokens as Array<{ symbol: string; balance: string; price: number; usd: string }>)
              .filter(t => parseFloat(t.balance) > 0)
              .map(t => (
                <div key={t.symbol} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, padding: '6px 8px', fontSize: 13, borderRadius: 4 }}>
                  <span style={{ fontWeight: 600 }}>{t.symbol}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>{parseFloat(t.balance).toFixed(4)}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>${t.price >= 1 ? t.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : t.price.toFixed(4)}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>${t.usd}</span>
                </div>
              ))
            }
            {/* Venus deposits */}
            {(wallet.venus as Array<{ symbol: string; underlyingSymbol: string; underlyingAmount: string; price: number; usd: string }>).length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px 8px 4px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  🏦 Venus Protocol
                </div>
                {(wallet.venus as Array<{ symbol: string; underlyingSymbol: string; underlyingAmount: string; price: number; usd: string }>).map(v => (
                  <div key={v.symbol} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, padding: '6px 8px', fontSize: 13, borderRadius: 4 }}>
                    <span style={{ fontWeight: 600 }}>{v.underlyingSymbol} <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>(v)</span></span>
                    <span style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>{parseFloat(v.underlyingAmount).toFixed(4)}</span>
                    <span style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>${v.price >= 1 ? v.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v.price.toFixed(4)}</span>
                    <span style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#4ade80' }}>${v.usd}</span>
                  </div>
                ))}
              </>
            )}
            {/* Total */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, padding: '8px 8px 4px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Total</span>
              <span />
              <span />
              <span style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 14 }}>${wallet.total_usd}</span>
            </div>
          </div>
        </div>
      )}

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
          <JobRunsChart jobs={jobs} payments={payments} />
        </div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 12 }}>💵 Earnings per Job</div>
          <JobEarningsChart payments={payments} />
        </div>
      </div>

      {/* Payment list */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 16 }}>💳 Recent Incoming Payments</div>
        <PaymentList payments={payments} loading={!paymentsData} />
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
