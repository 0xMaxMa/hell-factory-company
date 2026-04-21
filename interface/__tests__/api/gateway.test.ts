import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

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
  it('proxies non-stream request and returns JSON', async () => {
    const mockData = { response: 'hello from agent' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
      body: null,
    }))
    const { POST } = await import('@/app/api/gateway/messages/route')
    const req = new Request('http://localhost/api/gateway/messages', {
      method: 'POST',
      body: JSON.stringify({ message: 'hello', session_id: 'test-1', stream: false }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(body.response).toBe('hello from agent')
  })

  it('returns SSE response for stream=true requests', async () => {
    const streamBody = new ReadableStream()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamBody,
    }))
    const { POST } = await import('@/app/api/gateway/messages/route')
    const req = new Request('http://localhost/api/gateway/messages', {
      method: 'POST',
      body: JSON.stringify({ message: 'go', session_id: 'test-2', stream: true }),
    })
    const res = await POST(req)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
  })
})
