'use client'
import { Transaction } from '@/lib/types'

function shortAddr(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}` }
function shortHash(hash: string) { return `${hash.slice(0, 8)}…` }

export default function TransactionList({ txs, loading, error }: { txs: Transaction[]; loading?: boolean; error?: string }) {
  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>Loading transactions…</div>
  if (error) return <div style={{ color: 'var(--error)', fontSize: 13 }}>{error}</div>
  if (!txs || txs.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>No incoming transactions found</div>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Time', 'From', 'Amount (BNB)', 'Job', 'TxHash'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, letterSpacing: '0.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {txs.map(tx => (
            <tr key={tx.hash} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                {new Date(tx.timestamp * 1000).toLocaleString()}
              </td>
              <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{shortAddr(tx.from)}</td>
              <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{tx.value_bnb}</td>
              <td style={{ padding: '8px 10px' }}>
                {tx.job_name
                  ? <span className="badge badge-green">{tx.job_name}</span>
                  : <span style={{ color: 'var(--text-muted)' }}>—</span>
                }
              </td>
              <td style={{ padding: '8px 10px' }}>
                <a href={`https://bscscan.com/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--accent)', fontFamily: 'monospace', textDecoration: 'none' }}>
                  {shortHash(tx.hash)}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
