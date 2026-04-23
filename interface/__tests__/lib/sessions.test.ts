import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-sessions-test-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  vi.resetModules()
  vi.restoreAllMocks()
})

async function freshSessions() {
  return await import('@/lib/sessions')
}

describe('listSessions', () => {
  it('returns empty array when no file exists', async () => {
    const { listSessions } = await freshSessions()
    expect(listSessions()).toEqual([])
  })

  it('returns sessions from file', async () => {
    const { createSession, listSessions } = await freshSessions()
    createSession('test-echo', 'test-echo')
    createSession('teach-eng', 'teach-eng')
    expect(listSessions()).toHaveLength(2)
  })
})

describe('createSession', () => {
  it('creates session with correct structure', async () => {
    const { createSession } = await freshSessions()
    const s = createSession('test-echo', 'test-echo')
    expect(s.jobName).toBe('test-echo')
    expect(s.status).toBe('idle')
    expect(s.id).toMatch(/^job-test-echo-\d+$/)
    expect(s.messageCount).toBe(0)
    expect(s.createdAt).toBeTruthy()
    expect(s.lastActivity).toBeTruthy()
  })

  it('persists to sessions.json', async () => {
    const { createSession } = await freshSessions()
    createSession('test-echo', 'test-echo')
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, 'sessions.json'), 'utf-8'))
    expect(raw.sessions).toHaveLength(1)
  })

  it('appends multiple sessions', async () => {
    const { createSession, listSessions } = await freshSessions()
    createSession('job-a', 'job-a')
    createSession('job-b', 'job-b')
    expect(listSessions()).toHaveLength(2)
  })
})

describe('getSession', () => {
  it('returns session by id', async () => {
    const { createSession, getSession } = await freshSessions()
    const s = createSession('test-echo', 'test-echo')
    expect(getSession(s.id)).toMatchObject({ id: s.id })
  })

  it('returns undefined for unknown id', async () => {
    const { getSession } = await freshSessions()
    expect(getSession('nonexistent')).toBeUndefined()
  })
})

describe('updateSession', () => {
  it('updates status', async () => {
    const { createSession, updateSession } = await freshSessions()
    const s = createSession('test-echo', 'test-echo')
    const updated = updateSession(s.id, { status: 'active' })
    expect(updated?.status).toBe('active')
  })

  it('updates messageCount', async () => {
    const { createSession, updateSession } = await freshSessions()
    const s = createSession('test-echo', 'test-echo')
    const updated = updateSession(s.id, { messageCount: 5 })
    expect(updated?.messageCount).toBe(5)
  })

  it('returns null for unknown id', async () => {
    const { updateSession } = await freshSessions()
    expect(updateSession('bad-id', { status: 'idle' })).toBeNull()
  })

  it('updates lastActivity timestamp', async () => {
    const { createSession, updateSession } = await freshSessions()
    const s = createSession('test-echo', 'test-echo')
    const before = s.lastActivity
    await new Promise(r => setTimeout(r, 5))
    const updated = updateSession(s.id, { status: 'active' })
    expect(updated?.lastActivity).not.toBe(before)
  })
})

describe('deleteSession', () => {
  it('deletes existing session', async () => {
    const { createSession, deleteSession, listSessions } = await freshSessions()
    const s = createSession('test-echo', 'test-echo')
    const ok = deleteSession(s.id)
    expect(ok).toBe(true)
    expect(listSessions()).toHaveLength(0)
  })

  it('returns false for unknown id', async () => {
    const { deleteSession } = await freshSessions()
    expect(deleteSession('nonexistent')).toBe(false)
  })
})
