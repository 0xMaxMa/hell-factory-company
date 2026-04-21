import fs from 'fs'
import path from 'path'

export interface Session {
  id: string
  jobName: string
  status: 'active' | 'idle' | 'completed' | 'error'
  createdAt: string
  lastActivity: string
  messageCount: number
}

interface SessionStore {
  sessions: Session[]
}

function getStorePath() {
  return path.join(process.cwd(), 'sessions.json')
}

function readStore(): SessionStore {
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { sessions: [] }
  }
}

function writeStore(store: SessionStore): void {
  fs.writeFileSync(getStorePath(), JSON.stringify(store, null, 2), 'utf-8')
}

export function listSessions(): Session[] {
  return readStore().sessions
}

export function getSession(id: string): Session | undefined {
  return readStore().sessions.find(s => s.id === id)
}

export function createSession(jobName: string): Session {
  const store = readStore()
  const session: Session = {
    id: `job-${jobName}-${Date.now()}`,
    jobName,
    status: 'idle',
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    messageCount: 0,
  }
  store.sessions.push(session)
  writeStore(store)
  return session
}

export function updateSession(id: string, patch: Partial<Pick<Session, 'status' | 'messageCount' | 'lastActivity'>>): Session | null {
  const store = readStore()
  const idx = store.sessions.findIndex(s => s.id === id)
  if (idx === -1) return null
  store.sessions[idx] = { ...store.sessions[idx], ...patch, lastActivity: new Date().toISOString() }
  writeStore(store)
  return store.sessions[idx]
}

export function deleteSession(id: string): boolean {
  const store = readStore()
  const idx = store.sessions.findIndex(s => s.id === id)
  if (idx === -1) return false
  store.sessions.splice(idx, 1)
  writeStore(store)
  return true
}
