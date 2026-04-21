import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-api-jobs-'))
  process.env.WORKSPACE_PATH = tmpDir
  vi.resetModules()
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.WORKSPACE_PATH
})

function makeJob(name: string, extra: Record<string, unknown> = {}) {
  const dir = path.join(tmpDir, name)
  fs.mkdirSync(dir)
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({
    job_id: name, description: `${name}`, category: 'test', status: 'ready',
    created_at: '2026-01-01', estimated_earnings: '$5/d', risk_level: 'low', ...extra
  }))
}

// Minimal Next.js Request mock
function makeRequest(url: string): Request {
  return new Request(url)
}

describe('GET /api/jobs', () => {
  it('returns enabled jobs by default (?all not set)', async () => {
    makeJob('alpha')
    makeJob('beta', { enabled: false })
    const { GET } = await import('@/app/api/jobs/route')
    const req = { nextUrl: { searchParams: new URLSearchParams() } } as Parameters<typeof GET>[0]
    const res = await GET(req)
    const body = await res.json()
    expect(body.jobs).toHaveLength(1)
    expect(body.jobs[0].name).toBe('alpha')
  })

  it('returns all jobs when ?all=1', async () => {
    makeJob('alpha')
    makeJob('beta', { enabled: false })
    const { GET } = await import('@/app/api/jobs/route')
    const req = { nextUrl: { searchParams: new URLSearchParams('all=1') } } as Parameters<typeof GET>[0]
    const res = await GET(req)
    const body = await res.json()
    expect(body.jobs).toHaveLength(2)
  })
})

describe('GET /api/jobs/[name]', () => {
  it('returns job details for existing job', async () => {
    makeJob('shopee-cs')
    const { GET } = await import('@/app/api/jobs/[name]/route')
    const res = await GET({} as Request, { params: Promise.resolve({ name: 'shopee-cs' }) })
    const body = await res.json()
    expect(body.job.name).toBe('shopee-cs')
  })

  it('returns 404 for nonexistent job', async () => {
    const { GET } = await import('@/app/api/jobs/[name]/route')
    const res = await GET({} as Request, { params: Promise.resolve({ name: 'ghost' }) })
    expect(res.status).toBe(404)
  })
})

describe('GET /api/jobs/[name]/runbook', () => {
  it('returns runbook content', async () => {
    makeJob('with-runbook')
    fs.writeFileSync(path.join(tmpDir, 'with-runbook', 'RUNBOOK.md'), '# Steps')
    const { GET } = await import('@/app/api/jobs/[name]/runbook/route')
    const res = await GET({} as Request, { params: Promise.resolve({ name: 'with-runbook' }) })
    const body = await res.json()
    expect(body.content).toContain('Steps')
  })

  it('returns 404 when RUNBOOK missing', async () => {
    makeJob('no-runbook')
    const { GET } = await import('@/app/api/jobs/[name]/runbook/route')
    const res = await GET({} as Request, { params: Promise.resolve({ name: 'no-runbook' }) })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/jobs/[name]/toggle', () => {
  it('enables a disabled job', async () => {
    makeJob('togglable', { enabled: false })
    const { PATCH } = await import('@/app/api/jobs/[name]/toggle/route')
    const req = new Request('http://localhost/api/jobs/togglable/toggle', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: true }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ name: 'togglable' }) })
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.enabled).toBe(true)
    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'togglable', 'job.json'), 'utf-8'))
    expect(written.enabled).toBe(true)
  })

  it('disables an enabled job', async () => {
    makeJob('togglable', { enabled: true })
    const { PATCH } = await import('@/app/api/jobs/[name]/toggle/route')
    const req = new Request('http://localhost/api/jobs/togglable/toggle', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ name: 'togglable' }) })
    const body = await res.json()
    expect(body.enabled).toBe(false)
  })

  it('returns 404 for nonexistent job', async () => {
    const { PATCH } = await import('@/app/api/jobs/[name]/toggle/route')
    const req = new Request('http://localhost/', { method: 'PATCH', body: JSON.stringify({ enabled: true }) })
    const res = await PATCH(req, { params: Promise.resolve({ name: 'ghost' }) })
    expect(res.status).toBe(404)
  })
})
