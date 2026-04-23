import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { getGatewayConfig } from '@/lib/gateway'
import { appendMessage } from '@/lib/chat-logs'

export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as {
    message?: unknown
    session_id?: unknown
    agent_id?: unknown
    timeout_ms?: unknown
  }

  const { message, session_id, agent_id, timeout_ms } = body

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }
  if (!session_id || typeof session_id !== 'string') {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }

  const { url, apiKey, agentId: defaultAgentId } = getGatewayConfig()
  const targetAgent = typeof agent_id === 'string' ? agent_id : defaultAgentId

  const now = new Date().toISOString()
  appendMessage(session_id, { role: 'user', content: message.trim(), timestamp: now })

  const gwRes = await fetch(`${url}/api/v1/agents/${targetAgent}/messages`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: message.trim(),
      session_id,
      timeout_ms: typeof timeout_ms === 'number' ? timeout_ms : 60000,
    }),
  })

  if (!gwRes.ok) {
    const err = await gwRes.text()
    return NextResponse.json({ error: `Gateway error: ${err}` }, { status: gwRes.status })
  }

  const data = await gwRes.json() as { response?: string; session_id?: string }
  const response = data.response ?? ''

  if (response) {
    appendMessage(session_id, { role: 'agent', content: response, timestamp: new Date().toISOString() })
  }

  return NextResponse.json({
    response,
    session_id: data.session_id ?? session_id,
  })
}
