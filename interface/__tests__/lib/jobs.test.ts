import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Must mock before importing so module uses mocked env
let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-test-'))
  process.env.WORKSPACE_PATH = tmpDir
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.WORKSPACE_PATH
  vi.resetModules()
})

async function freshJobs() {
  return await import('@/lib/jobs')
}

function makeJob(name: string, extra: Record<string, unknown> = {}) {
  const jobDir = path.join(tmpDir, name)
  fs.mkdirSync(jobDir)
  fs.writeFileSync(
    path.join(jobDir, 'job.json'),
    JSON.stringify({ job_id: name, description: `${name} desc`, category: 'test', status: 'ready', created_at: '2026-01-01', estimated_earnings: '$5/d', risk_level: 'low', ...extra })
  )
  return jobDir
}

describe('getWorkspacePath', () => {
  it('returns env var when set', async () => {
    const { getWorkspacePath } = await freshJobs()
    expect(getWorkspacePath()).toBe(tmpDir)
  })

  it('falls back to default path when env not set', async () => {
    delete process.env.WORKSPACE_PATH
    const { getWorkspacePath } = await freshJobs()
    expect(getWorkspacePath()).toBe('/home/dev/projects/hell-factory-company/job_workspaces')
  })
})

describe('listJobs', () => {
  it('returns empty array when workspace does not exist', async () => {
    const { listJobs } = await freshJobs()
    fs.rmSync(tmpDir, { recursive: true, force: true })
    expect(listJobs()).toEqual([])
  })

  it('returns all jobs when enabledOnly=false', async () => {
    makeJob('alpha')
    makeJob('beta', { enabled: false })
    const { listJobs } = await freshJobs()
    const jobs = listJobs(false)
    expect(jobs).toHaveLength(2)
  })

  it('returns only enabled jobs when enabledOnly=true', async () => {
    makeJob('alpha')
    makeJob('beta', { enabled: false })
    const { listJobs } = await freshJobs()
    const jobs = listJobs(true)
    expect(jobs).toHaveLength(1)
    expect(jobs[0].name).toBe('alpha')
  })

  it('defaults enabled=true when missing from job.json', async () => {
    makeJob('no-flag')
    const { listJobs } = await freshJobs()
    const jobs = listJobs(true)
    expect(jobs).toHaveLength(1)
    expect(jobs[0].enabled).toBe(true)
  })

  it('skips malformed job.json gracefully', async () => {
    const dir = path.join(tmpDir, 'bad-job')
    fs.mkdirSync(dir)
    fs.writeFileSync(path.join(dir, 'job.json'), 'NOT JSON')
    const { listJobs } = await freshJobs()
    expect(listJobs()).toHaveLength(0)
  })

  it('skips entries without job.json', async () => {
    fs.mkdirSync(path.join(tmpDir, 'empty-dir'))
    const { listJobs } = await freshJobs()
    expect(listJobs()).toHaveLength(0)
  })
})

describe('getJob', () => {
  it('returns job when it exists', async () => {
    makeJob('shopee-cs')
    const { getJob } = await freshJobs()
    const job = getJob('shopee-cs')
    expect(job).not.toBeNull()
    expect(job?.name).toBe('shopee-cs')
  })

  it('returns null when job does not exist', async () => {
    const { getJob } = await freshJobs()
    expect(getJob('nonexistent')).toBeNull()
  })

  it('uses directory name as fallback when name and job_id missing', async () => {
    const dir = path.join(tmpDir, 'fallback-name')
    fs.mkdirSync(dir)
    fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({ description: 'x', category: 'c', status: 's', created_at: '2026-01-01', estimated_earnings: '$1', risk_level: 'low' }))
    const { getJob } = await freshJobs()
    const job = getJob('fallback-name')
    expect(job?.name).toBe('fallback-name')
  })
})

describe('toggleJob', () => {
  it('enables a job', async () => {
    makeJob('binance-earn', { enabled: false })
    const { toggleJob, getJob } = await freshJobs()
    const ok = toggleJob('binance-earn', true)
    expect(ok).toBe(true)
    expect(getJob('binance-earn')?.enabled).toBe(true)
  })

  it('disables a job', async () => {
    makeJob('binance-earn', { enabled: true })
    const { toggleJob, getJob } = await freshJobs()
    const ok = toggleJob('binance-earn', false)
    expect(ok).toBe(true)
    expect(getJob('binance-earn')?.enabled).toBe(false)
  })

  it('returns false for nonexistent job', async () => {
    const { toggleJob } = await freshJobs()
    expect(toggleJob('ghost', true)).toBe(false)
  })
})

describe('getRunbook', () => {
  it('returns runbook content when file exists', async () => {
    makeJob('runbook-job')
    fs.writeFileSync(path.join(tmpDir, 'runbook-job', 'RUNBOOK.md'), '# Steps\n1. Do this')
    const { getRunbook } = await freshJobs()
    expect(getRunbook('runbook-job')).toContain('Steps')
  })

  it('returns null when RUNBOOK.md missing', async () => {
    makeJob('no-runbook')
    const { getRunbook } = await freshJobs()
    expect(getRunbook('no-runbook')).toBeNull()
  })
})

describe('getEarningsDisplay', () => {
  it('returns string earnings directly', async () => {
    const { getEarningsDisplay } = await freshJobs()
    const job = { name: 'x', description: '', category: '', status: '', created_at: '', estimated_earnings: '$5/day', risk_level: '' }
    expect(getEarningsDisplay(job)).toBe('$5/day')
  })

  it('formats per_project range earnings', async () => {
    const { getEarningsDisplay } = await freshJobs()
    const job = { name: 'x', description: '', category: '', status: '', created_at: '', estimated_earnings: { per_project_min: 10, per_project_max: 50 }, risk_level: '' }
    expect(getEarningsDisplay(job)).toBe('$10–$50/project')
  })

  it('returns N/A for unknown format', async () => {
    const { getEarningsDisplay } = await freshJobs()
    const job = { name: 'x', description: '', category: '', status: '', created_at: '', estimated_earnings: {}, risk_level: '' }
    expect(getEarningsDisplay(job)).toBe('N/A')
  })
})

describe('parseEarnings', () => {
  it('parses BNB value from string', async () => {
    const { parseEarnings } = await import('@/lib/jobs')
    expect(parseEarnings('0.05 BNB')).toBe(0.05)
    expect(parseEarnings('1.234 BNB')).toBe(1.234)
  })
  it('returns 0 for N/A or empty', async () => {
    const { parseEarnings } = await import('@/lib/jobs')
    expect(parseEarnings('N/A')).toBe(0)
    expect(parseEarnings('')).toBe(0)
    expect(parseEarnings(undefined)).toBe(0)
  })
})
