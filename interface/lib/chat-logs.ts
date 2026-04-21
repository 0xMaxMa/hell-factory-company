import fs from 'fs'
import path from 'path'

export interface ChatMessage {
  role: 'user' | 'agent'
  content: string
  timestamp: string
}

interface ChatLog {
  sessionId: string
  messages: ChatMessage[]
}

function getLogPath(sessionId: string) {
  return path.join(process.cwd(), 'chat-logs', `${sessionId}.json`)
}

function ensureDir() {
  const dir = path.join(process.cwd(), 'chat-logs')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function loadMessages(sessionId: string): ChatMessage[] {
  try {
    const raw = fs.readFileSync(getLogPath(sessionId), 'utf-8')
    const log: ChatLog = JSON.parse(raw)
    return log.messages
  } catch {
    return []
  }
}

export function appendMessage(sessionId: string, message: ChatMessage): void {
  ensureDir()
  const messages = loadMessages(sessionId)
  messages.push(message)
  const log: ChatLog = { sessionId, messages }
  fs.writeFileSync(getLogPath(sessionId), JSON.stringify(log, null, 2), 'utf-8')
}
