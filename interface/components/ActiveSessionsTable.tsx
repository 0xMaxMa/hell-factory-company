'use client'
import useSWR from 'swr'
import { Session } from '@/lib/sessions'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--success)',
  idle: 'var(--text-muted)',
  completed: '#4da6ff',
  error: 'var(--danger)',
}

const STATUS_ICONS: Record<string, string> = {
  active: '●',
  idle: '○',
  completed: '✓',
  error: '✗',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface Props {
  onResume: (session: Session) => void
  onDelete?: (id: string) => void
}

export default function ActiveSessionsTable({ onResume, onDelete }: Props) {
  const { data, mutate } = useSWR<{ sessions: Session[] }>('/api/sessions', fetcher, {
    refreshInterval: 5000,
  })

  const sessions = data?.sessions ?? []

  async function handleDelete(id: string) {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    mutate()
    onDelete?.(id)
  }

  async function handleStop(id: string) {
    await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'idle' }),
    })
    mutate()
  }

  if (sessions.length === 0) return null

  return (
    <div className="card" style={{ marginBottom: 8 }}>
      <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Active Sessions</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 500 }}>Job</th>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 500 }}>Status</th>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 500 }}>Started</th>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 500 }}>Last Activity</th>
              <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 500 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr
                key={s.id}
                data-testid={`session-row-${s.id}`}
                style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
              >
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12 }}>{s.jobName}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ color: STATUS_COLORS[s.status] ?? 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>{STATUS_ICONS[s.status] ?? '?'}</span>
                    <span style={{ textTransform: 'capitalize' }}>{s.status}</span>
                  </span>
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12 }}>{timeAgo(s.createdAt)}</td>
                <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12 }}>{timeAgo(s.lastActivity)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      className="btn"
                      style={{ fontSize: 12, padding: '4px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                      onClick={() => onResume(s)}
                      data-testid={`resume-${s.id}`}
                    >
                      Resume
                    </button>
                    {s.status === 'active' && (
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => handleStop(s.id)}
                        data-testid={`stop-${s.id}`}
                      >
                        Stop
                      </button>
                    )}
                    {s.status !== 'active' && (
                      <button
                        className="btn"
                        style={{ fontSize: 12, padding: '4px 10px', background: 'rgba(255,60,60,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)' }}
                        onClick={() => handleDelete(s.id)}
                        data-testid={`delete-${s.id}`}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
