import { NextRequest, NextResponse } from 'next/server'
import { getGatewayConfig } from '@/lib/gateway'

export const maxDuration = 600

export async function POST(req: NextRequest) {
  const { url, apiKey, agentId } = getGatewayConfig()
  const body = await req.json()

  // Always use SSE to gateway for multi-turn agent support.
  // Read the complete stream server-side and return a single JSON response to the browser.
  // This eliminates browser SSE connection drops that caused partial/silent results.
  const gwRes = await fetch(`${url}/api/v1/agents/${agentId}/messages`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...body, stream: true, timeout_ms: 300_000 }),
  })

  if (!gwRes.ok || !gwRes.body) {
    return new NextResponse(null, { status: gwRes.status || 502 })
  }

  const reader = gwRes.body.getReader()
  const decoder = new TextDecoder()
  let sseBuffer = ''
  let response = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      sseBuffer += decoder.decode(value, { stream: true })
      const events = sseBuffer.split('\n\n')
      sseBuffer = events.pop() ?? ''
      for (const eventBlock of events) {
        const dataLine = eventBlock.split('\n').find(l => l.startsWith('data:'))
        if (!dataLine) continue
        const data = dataLine.slice(5).trim()
        if (!data || data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'result' && parsed.text) {
            response = parsed.text // result event = complete final text
          } else {
            const content = parsed.text || parsed.delta?.text || parsed.content || ''
            if (content) response += content
          }
        } catch { /* ignore non-JSON */ }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return NextResponse.json({ response })
}
