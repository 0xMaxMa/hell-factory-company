import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('GET /api/gateway/status', () => {
  it('returns agent list on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ agents: [{ id: 'indian-programmer', sessions: [] }] }),
    }))
    const { GET } = await import('@/app/api/gateway/status/route')
    const res = await GET()
    const body = await res.json()
    expect(body.agents).toHaveLength(1)
  })

  it('returns error field (not 5xx) when gateway fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')))
    const { GET } = await import('@/app/api/gateway/status/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.error).toContain('Connection refused')
    expect(body.agents).toEqual([])
  })
})

describe('POST /api/gateway/messages', () => {
  it('proxies request and returns JSON response', async () => {
    const encoder = new TextEncoder()
    const sseData = [
      'data: {"type":"text_delta","text":"hello"}\n\n',
      'data: {"type":"result","text":"hello from agent"}\n\n',
      'data: [DONE]\n\n',
    ]
    let pushIndex = 0
    const stream = new ReadableStream({
      pull(controller) {
        if (pushIndex < sseData.length) {
          controller.enqueue(encoder.encode(sseData[pushIndex++]))
        } else {
          controller.close()
        }
      }
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    }))
    const { POST } = await import('@/app/api/gateway/messages/route')
    const req = new Request('http://localhost/api/gateway/messages', {
      method: 'POST',
      body: JSON.stringify({ message: 'hello', session_id: 'test-1' }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(body.response).toBe('hello from agent')
  })

  it('returns 502 when gateway is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      body: null,
    }))
    const { POST } = await import('@/app/api/gateway/messages/route')
    const req = new Request('http://localhost/api/gateway/messages', {
      method: 'POST',
      body: JSON.stringify({ message: 'go', session_id: 'test-2' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(502)
  })
})
