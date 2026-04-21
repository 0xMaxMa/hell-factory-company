'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import useSWR from 'swr'
import ReactMarkdown, { Components } from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import { Session } from '@/lib/sessions'
import { JobWorkspace } from '@/lib/types'
import ActiveSessionsTable from '@/components/ActiveSessionsTable'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function nl2md(text: string) {
  return text.replace(/\n/g, '<br/>')
}

function earningsDisplay(j: JobWorkspace): string {
  if (typeof j.estimated_earnings === 'string') return j.estimated_earnings
  const e = j.estimated_earnings as Record<string, unknown>
  if (e.per_project_min !== undefined) return `$${e.per_project_min}–$${e.per_project_max}/project`
  return 'N/A'
}

// ── Step 1: Job Selector ─────────────────────────────────────────────────────

function JobSelector({ jobs, selected, onSelect }: {
  jobs: JobWorkspace[]
  selected: string
  onSelect: (name: string) => void
}) {
  return (
    <div className="card" data-testid="step-job-selector">
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Step 1</div>
      <div style={{ fontWeight: 600, marginBottom: 14 }}>Select Job Workspace</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {jobs.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No enabled job workspaces found.</div>
        )}
        {jobs.map(j => (
          <div
            key={j.name}
            onClick={() => onSelect(j.name)}
            data-testid={`job-card-${j.name}`}
            style={{
              padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${selected === j.name ? 'var(--accent)' : 'var(--border)'}`,
              background: selected === j.name ? 'rgba(0,102,255,0.09)' : 'var(--surface-2)',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{j.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{j.category}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{earningsDisplay(j)}</span>
              <span style={{ fontSize: 11, color: j.status === 'ready' ? 'var(--success)' : 'var(--warning)', fontWeight: 500 }}>
                {j.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Step 2: Session Picker ───────────────────────────────────────────────────

function SessionPicker({ jobName, onStart }: {
  jobName: string
  onStart: (session: Session) => void
}) {
  const [mode, setMode] = useState<'new' | 'resume'>('new')
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [loading, setLoading] = useState(false)

  const { data } = useSWR<{ sessions: Session[] }>('/api/sessions', fetcher)
  const existing = (data?.sessions ?? []).filter(s => s.jobName === jobName && s.status !== 'completed')

  useEffect(() => {
    setMode(existing.length > 0 ? 'resume' : 'new')
    setSelectedSessionId(existing[0]?.id ?? '')
  }, [jobName, existing.length])

  async function handleStart() {
    setLoading(true)
    try {
      if (mode === 'new') {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobName }),
        })
        const data = await res.json()
        onStart(data.session)
      } else {
        const session = existing.find(s => s.id === selectedSessionId)
        if (session) onStart(session)
      }
    } finally {
      setLoading(false)
    }
  }

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    return `${Math.floor(m / 60)}h ago`
  }

  return (
    <div className="card" data-testid="step-session-picker">
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Step 2</div>
      <div style={{ fontWeight: 600, marginBottom: 14 }}>Session</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="radio"
            name="session-mode"
            value="new"
            checked={mode === 'new'}
            onChange={() => setMode('new')}
            style={{ accentColor: 'var(--accent)' }}
          />
          <span style={{ fontSize: 14 }}>New Session</span>
        </label>

        {existing.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input
              type="radio"
              name="session-mode"
              value="resume"
              checked={mode === 'resume'}
              onChange={() => setMode('resume')}
              style={{ accentColor: 'var(--accent)', marginTop: 2 }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, marginBottom: 6 }}>Resume existing session</div>
              <select
                value={selectedSessionId}
                onChange={e => setSelectedSessionId(e.target.value)}
                disabled={mode !== 'resume'}
                className="input"
                style={{ width: '100%', fontSize: 12, fontFamily: 'monospace' }}
                data-testid="session-select"
              >
                {existing.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.status}, {timeAgo(s.lastActivity)}
                  </option>
                ))}
              </select>
            </div>
          </label>
        )}
      </div>

      <button
        className="btn btn-primary"
        onClick={handleStart}
        disabled={loading || (mode === 'resume' && !selectedSessionId)}
        data-testid="start-session-btn"
        style={{ width: '100%' }}
      >
        {loading ? 'Starting...' : '▶ Start'}
      </button>
    </div>
  )
}

// ── Step 3: Agent Terminal ───────────────────────────────────────────────────

interface Msg { role: 'user' | 'agent'; content: string }

const mdComponents: Components = {
  p: ({ children }) => <p style={{ margin: '4px 0' }}>{children}</p>,
  table: ({ children }) => <table style={{ borderCollapse: 'collapse', margin: '8px 0', width: '100%' }}>{children}</table>,
  th: ({ children }) => <th style={{ border: '1px solid #444', padding: '4px 8px', textAlign: 'left', background: '#1a1a1a' }}>{children}</th>,
  td: ({ children }) => <td style={{ border: '1px solid #444', padding: '4px 8px' }}>{children}</td>,
  code: ({ children }) => <code style={{ background: '#1a1a1a', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace' }}>{children}</code>,
  pre: ({ children }) => <pre style={{ background: '#1a1a1a', padding: '8px', borderRadius: 6, overflow: 'auto', margin: '6px 0' }}>{children}</pre>,
}

function AgentTerminal({ session, jobName, onBack }: {
  session: Session
  jobName: string
  onBack: () => void
}) {
  const [running, setRunning] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [streaming, setStreaming] = useState('')
  const [chatInput, setChatInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetch(`/api/sessions/${session.id}/messages`)
      .then(r => r.json())
      .then(({ messages: hist }) => {
        if (hist?.length) setMessages(hist.map((m: Msg) => ({ role: m.role, content: m.content })))
      })
  }, [session.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  async function saveMessage(role: 'user' | 'agent', content: string) {
    await fetch(`/api/sessions/${session.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content, timestamp: new Date().toISOString() }),
    })
  }

  async function runJob(message?: string) {
    const msg = message ?? `/job-run ${jobName}`
    setRunning(true)
    setStreaming('')
    await fetch(`/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })

    abortRef.current = new AbortController()
    let agentReply = ''
    try {
      const res = await fetch('/api/gateway/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, session_id: session.id, stream: true }),
        signal: abortRef.current.signal,
      })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return

      const flushTurn = async () => {
        if (!agentReply.trim()) return
        const turn = agentReply
        agentReply = ''
        setMessages(prev => [...prev, { role: 'agent', content: turn }])
        await saveMessage('agent', turn)
        setStreaming('')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data:'))
        for (const line of lines) {
          const data = line.slice(5).trim()
          if (!data || data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'tool_use' || parsed.type === 'result') {
              await flushTurn()
              continue
            }
            const content = parsed.text || parsed.delta?.text || parsed.content || ''
            if (content) {
              agentReply += content
              setStreaming(prev => prev + content)
            }
          } catch { /* ignore non-JSON */ }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        agentReply += `\nError: ${String(e)}`
        setStreaming(prev => prev + `\nError: ${String(e)}`)
      }
    } finally {
      if (agentReply.trim()) {
        setMessages(prev => [...prev, { role: 'agent', content: agentReply }])
        await saveMessage('agent', agentReply)
      }
      setStreaming('')
      setRunning(false)
      await fetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'idle' }),
      })
    }
  }

  function stopJob() {
    abortRef.current?.abort()
    setRunning(false)
    setStreaming('')
  }

  async function sendChat() {
    if (!chatInput.trim()) return
    const msg = chatInput
    setChatInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    await saveMessage('user', msg)
    await runJob(msg)
  }

  return (
    <div data-testid="step-terminal">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button
          className="btn"
          onClick={onBack}
          style={{ fontSize: 12, padding: '5px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          data-testid="back-to-wizard"
        >
          ← Back
        </button>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          {session.id}
        </div>
        {running ? (
          <button className="btn btn-danger" style={{ fontSize: 12, padding: '5px 12px', marginLeft: 'auto' }} onClick={stopJob}>
            ■ Stop
          </button>
        ) : (
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px', marginLeft: 'auto' }} onClick={() => runJob()}>
            ▶ Run Job
          </button>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          background: 'var(--surface-2)', padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          fontSize: 13, color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          💬 Agent Chat
          {running
            ? <span className="animate-pulse-glow" style={{ color: 'var(--success)' }}>● running</span>
            : <span style={{ color: 'var(--text-muted)' }}>○ idle</span>
          }
        </div>
        <div
          data-testid="agent-terminal"
          style={{
            minHeight: 320, maxHeight: 520, overflowY: 'auto',
            padding: '16px', background: '#080808', display: 'flex', flexDirection: 'column', gap: 12,
          }}
        >
          {messages.length === 0 && !streaming && (
            <span style={{ opacity: 0.4, fontSize: 13, margin: 'auto' }}>Click ▶ Run Job to start, or send a message below...</span>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.role === 'user' ? 'var(--accent)' : '#1a1a1a',
                color: m.role === 'user' ? '#fff' : 'var(--text)',
                fontSize: 13, lineHeight: 1.6,
                border: m.role === 'agent' ? '1px solid #333' : 'none',
              }}>
                {m.role === 'agent'
                  ? <ReactMarkdown components={mdComponents} rehypePlugins={[rehypeRaw]}>{nl2md(m.content)}</ReactMarkdown>
                  : m.content
                }
              </div>
            </div>
          ))}
          {streaming && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '10px 14px',
                borderRadius: '16px 16px 16px 4px',
                background: '#1a1a1a', color: 'var(--text)',
                fontSize: 13, lineHeight: 1.6,
                border: '1px solid #333',
              }}>
                <ReactMarkdown components={mdComponents} rehypePlugins={[rehypeRaw]}>{nl2md(streaming)}</ReactMarkdown>
                <span className="animate-pulse-glow" style={{ color: 'var(--success)' }}>▋</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', gap: 8, padding: '12px' }}>
            <input
              className="input"
              placeholder="Send message to agent..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
              data-testid="chat-input"
            />
            <button
              className="btn btn-primary"
              onClick={sendChat}
              disabled={!chatInput.trim()}
              data-testid="chat-send"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Root Wizard Page ─────────────────────────────────────────────────────────

function RunPageContent() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedJob, setSelectedJob] = useState('')
  const [activeSession, setActiveSession] = useState<Session | null>(null)

  const { data: jobsData } = useSWR('/api/jobs?all=0', fetcher)
  const jobs: JobWorkspace[] = jobsData?.jobs || []

  function selectJob(name: string) {
    setSelectedJob(name)
    setStep(2)
    setActiveSession(null)
  }

  function handleStart(session: Session) {
    setActiveSession(session)
    setStep(3)
  }

  function handleResume(session: Session) {
    setSelectedJob(session.jobName)
    setActiveSession(session)
    setStep(3)
  }

  function backToWizard() {
    setActiveSession(null)
    setStep(selectedJob ? 2 : 1)
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>Run Job</div>

      <ActiveSessionsTable onResume={handleResume} />

      {step === 3 && activeSession ? (
        <AgentTerminal session={activeSession} jobName={selectedJob} onBack={backToWizard} />
      ) : (
        <>
          <JobSelector jobs={jobs} selected={selectedJob} onSelect={selectJob} />
          {step === 2 && selectedJob && (
            <SessionPicker jobName={selectedJob} onStart={handleStart} />
          )}
        </>
      )}
    </div>
  )
}

export default function RunPage() {
  return (
    <Suspense>
      <RunPageContent />
    </Suspense>
  )
}
