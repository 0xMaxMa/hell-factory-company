'use client'
import { Payment } from '@/lib/types'

export default function PaymentList({ payments, loading }: { payments: Payment[]; loading?: boolean }) {
  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>Loading payments…</div>
  if (!payments || payments.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>No payments recorded yet</div>

  const sorted = [...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Date', 'Agent', 'Job', 'Token', 'Amount'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, letterSpacing: '0.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                {new Date(p.date).toLocaleString()}
              </td>
              <td style={{ padding: '8px 10px' }}><span className="badge badge-blue">{p.agentId}</span></td>
              <td style={{ padding: '8px 10px' }}><span className="badge badge-green">{p.job}</span></td>
              <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{p.token}</td>
              <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--success)', fontWeight: 600 }}>{p.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
