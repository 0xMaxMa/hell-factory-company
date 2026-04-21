import { NextRequest, NextResponse } from 'next/server'
import { getGatewayConfig } from '@/lib/gateway'

export async function POST(req: NextRequest) {
  const { url, apiKey, agentId } = getGatewayConfig()
  const body = await req.json()

  const gwRes = await fetch(`${url}/api/v1/agents/${agentId}/messages`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (body.stream) {
    return new NextResponse(gwRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  const data = await gwRes.json()
  return NextResponse.json(data, { status: gwRes.status })
}
