import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-sessions-api-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  vi.resetModules()
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

// ── GET /api/sessions ────────────────────────────────────────────────────────

describe('GET /api/sessions', () => {
  it('returns empty sessions list when none exist', async () => {
    const { GET } = await import('@/app/api/sessions/route')
    const res = await GET()
    const body = await res.json()
    expect(body.sessions).toEqual([])
  })

  it('returns existing sessions', async () => {
    const store = {
      sessions: [
        { id: 'job-test-echo-1000', jobName: 'test-echo', status: 'idle', createdAt: '2026-01-01T00:00:00.000Z', lastActivity: '2026-01-01T00:01:00.000Z', messageCount: 0 },
      ],
    }
    fs.writeFileSync(path.join(tmpDir, 'sessions.json'), JSON.stringify(store))
    const { GET } = await import('@/app/api/sessions/route')
    const res = await GET()
    const body = await res.json()
    expect(body.sessions).toHaveLength(1)
    expect(body.sessions[0].id).toBe('job-test-echo-1000')
  })
})

// ── POST /api/sessions ───────────────────────────────────────────────────────

describe('POST /api/sessions', () => {
  it('creates a new session and returns 201', async () => {
    const { POST } = await import('@/app/api/sessions/route')
    const req = new Request('http://localhost/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ jobName: 'test-echo' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.session.jobName).toBe('test-echo')
    expect(body.session.status).toBe('idle')
    expect(body.session.id).toMatch(/^job-test-echo-\d+$/)
  })

  it('returns 400 when jobName is missing', async () => {
    const { POST } = await import('@/app/api/sessions/route')
    const req = new Request('http://localhost/api/sessions', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('persists session to sessions.json', async () => {
    const { POST } = await import('@/app/api/sessions/route')
    const req = new Request('http://localhost/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ jobName: 'teach-eng' }),
    })
    await POST(req)
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, 'sessions.json'), 'utf-8'))
    expect(raw.sessions).toHaveLength(1)
    expect(raw.sessions[0].jobName).toBe('teach-eng')
  })
})

// ── PATCH /api/sessions/[id] ─────────────────────────────────────────────────

describe('PATCH /api/sessions/[id]', () => {
  async function createSession(jobName: string) {
    const { POST } = await import('@/app/api/sessions/route')
    const req = new Request('http://localhost/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ jobName }),
    })
    const res = await POST(req)
    const body = await res.json()
    return body.session
  }

  it('updates session status to active', async () => {
    const session = await createSession('test-echo')
    vi.resetModules()
    const { PATCH } = await import('@/app/api/sessions/[id]/route')
    const req = new Request(`http://localhost/api/sessions/${session.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: session.id }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.session.status).toBe('active')
  })

  it('returns 400 for invalid status', async () => {
    const session = await createSession('test-echo')
    vi.resetModules()
    const { PATCH } = await import('@/app/api/sessions/[id]/route')
    const req = new Request(`http://localhost/api/sessions/${session.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'unknown' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: session.id }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown session', async () => {
    const { PATCH } = await import('@/app/api/sessions/[id]/route')
    const req = new Request('http://localhost/api/sessions/nonexistent', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'idle' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })
})

// ── DELETE /api/sessions/[id] ────────────────────────────────────────────────

describe('DELETE /api/sessions/[id]', () => {
  async function createSession(jobName: string, status = 'idle') {
    const store = {
      sessions: [
        { id: `job-${jobName}-1000`, jobName, status, createdAt: new Date().toISOString(), lastActivity: new Date().toISOString(), messageCount: 0 },
      ],
    }
    fs.writeFileSync(path.join(tmpDir, 'sessions.json'), JSON.stringify(store))
    return store.sessions[0]
  }

  it('deletes idle session successfully', async () => {
    const session = await createSession('test-echo', 'idle')
    const { DELETE } = await import('@/app/api/sessions/[id]/route')
    const req = new Request(`http://localhost/api/sessions/${session.id}`, { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: session.id }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('refuses to delete active session (409)', async () => {
    const session = await createSession('test-echo', 'active')
    const { DELETE } = await import('@/app/api/sessions/[id]/route')
    const req = new Request(`http://localhost/api/sessions/${session.id}`, { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: session.id }) })
    expect(res.status).toBe(409)
  })

  it('returns 404 for unknown session', async () => {
    const { DELETE } = await import('@/app/api/sessions/[id]/route')
    const req = new Request('http://localhost/api/sessions/nonexistent', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })
})
