'use client'
import { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import { JobWorkspace } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function ConfigPage() {
  const { data: jobsData, mutate: mutateJobs } = useSWR('/api/jobs?all=1', fetcher)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string>('')

  const [config, setConfig] = useState({
    gatewayUrl: '',
    apiKey: '',
    agentId: '',
    bscscanApiKey: '',
    workspacePath: '',
    maxConcurrent: 20,
    autoRun: false,
  })

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(d => { if (d.config && Object.keys(d.config).length) setConfig(prev => ({ ...prev, ...d.config })) })
      .catch(() => {
        const stored = localStorage.getItem('hf_config')
        if (stored) { try { setConfig(JSON.parse(stored)) } catch {} }
      })

    fetch('/api/wallet/address')
      .then(r => r.json())
      .then(d => { if (d.address) setWalletAddress(d.address) })
      .catch(() => {})
  }, [])

  const jobs: JobWorkspace[] = jobsData?.jobs || []

  function setField(key: string, value: string | number | boolean) {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  async function saveConfig() {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      localStorage.setItem('hf_config', JSON.stringify(config))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      alert(`Save failed: ${String(e)}`)
    }
  }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/gateway/status')
      const data = await res.json()
      if (data.error) setTestResult(`❌ ${data.error}`)
      else setTestResult(`✅ Connected — ${data.agents?.length || 0} agents accessible`)
    } catch (e) {
      setTestResult(`❌ ${String(e)}`)
    } finally {
      setTesting(false)
    }
  }

  async function toggleJob(name: string, enabled: boolean) {
    await fetch(`/api/jobs/${name}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    mutateJobs()
    mutate('/api/jobs?all=0')
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>⚙️ Configuration</div>

      {/* Gateway */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 16 }}>Gateway</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Gateway URL</div>
            <input className="input" value={config.gatewayUrl} onChange={e => setField('gatewayUrl', e.target.value)} placeholder="http://localhost:3000" />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>API Key</div>
            <input className="input" type="password" value={config.apiKey} onChange={e => setField('apiKey', e.target.value)} placeholder="••••••••" />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Agent ID</div>
            <input className="input" value={config.agentId} onChange={e => setField('agentId', e.target.value)} placeholder="indian-programmer" />
          </label>
          {walletAddress && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Wallet Address (from agent)</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, padding: '8px 12px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                {walletAddress}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analytics */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 16 }}>Analytics</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>BSCScan API Key</div>
            <input className="input" type="password" value={config.bscscanApiKey} onChange={e => setField('bscscanApiKey', e.target.value)} placeholder="••••••••" />
          </label>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Used for wallet balance, transaction history, and earnings charts on the dashboard.
          </div>
        </div>
      </div>

      {/* Job Settings */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 16 }}>Job Settings</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Workspace Path</div>
            <input className="input" value={config.workspacePath} onChange={e => setField('workspacePath', e.target.value)} placeholder="/home/dev/projects/hell-factory-company/job_workspaces" />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Max Concurrent Jobs</div>
            <input className="input" type="number" value={config.maxConcurrent} onChange={e => setField('maxConcurrent', Number(e.target.value))} min={1} max={50} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" checked={config.autoRun} onChange={e => setField('autoRun', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            <div>
              <div style={{ fontSize: 14 }}>Auto-run on start</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Launch all enabled jobs when the dashboard loads</div>
            </div>
          </label>
        </div>
      </div>

      {/* Job Workspaces */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 16 }}>Job Workspaces</div>
        {jobs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No job workspaces found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {jobs.map(job => (
              <div key={job.name} className="card-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    onClick={() => toggleJob(job.name, !job.enabled)}
                    style={{
                      width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                      background: job.enabled ? 'var(--accent)' : 'var(--surface)',
                      border: '1px solid var(--border)',
                      position: 'relative', transition: 'all 0.2s',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: job.enabled ? 18 : 2,
                      width: 14, height: 14, borderRadius: '50%',
                      background: job.enabled ? 'white' : 'var(--text-muted)',
                      transition: 'left 0.2s',
                    }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{job.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {job.category} · {job.status}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: job.enabled ? 'var(--success)' : 'var(--text-muted)' }}>
                  {job.enabled ? 'enabled' : 'disabled'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn btn-ghost" onClick={testConnection} disabled={testing}>
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button className="btn btn-primary" onClick={saveConfig}>
          {saved ? '✅ Saved' : '💾 Save'}
        </button>
        {testResult && (
          <span style={{ fontSize: 13, color: testResult.startsWith('✅') ? 'var(--success)' : 'var(--error)' }}>
            {testResult}
          </span>
        )}
      </div>
    </div>
  )
}
