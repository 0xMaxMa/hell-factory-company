import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('POST /api/dispatch', () => {
  it('returns 400 when jobs array is missing', async () => {
    const { POST } = await import('@/app/api/dispatch/route')
    const req = new Request('http://localhost/api/dispatch', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('returns 400 when jobs array is empty', async () => {
    const { POST } = await import('@/app/api/dispatch/route')
    const req = new Request('http://localhost/api/dispatch', {
      method: 'POST',
      body: JSON.stringify({ jobs: [] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('launches multiple jobs and returns results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ response: 'started' }),
    }))
    const { POST } = await import('@/app/api/dispatch/route')
    const req = new Request('http://localhost/api/dispatch', {
      method: 'POST',
      body: JSON.stringify({ jobs: ['binance-earn', 'shopee-cs'] }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(body.launched).toHaveLength(2)
    expect(body.launched[0].job).toBe('binance-earn')
    expect(body.launched[0].status).toBe('fulfilled')
    expect(body.launched[1].job).toBe('shopee-cs')
  })

  it('records rejected status when gateway fetch fails for a job', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ json: async () => ({ response: 'ok' }) })
    )
    const { POST } = await import('@/app/api/dispatch/route')
    const req = new Request('http://localhost/api/dispatch', {
      method: 'POST',
      body: JSON.stringify({ jobs: ['fail-job', 'ok-job'] }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(body.launched[0].status).toBe('rejected')
    expect(body.launched[0].error).toContain('timeout')
    expect(body.launched[1].status).toBe('fulfilled')
  })

  it('uses custom initial_message when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ json: async () => ({}) })
    vi.stubGlobal('fetch', mockFetch)
    const { POST } = await import('@/app/api/dispatch/route')
    const req = new Request('http://localhost/api/dispatch', {
      method: 'POST',
      body: JSON.stringify({ jobs: ['my-job'], initial_message: 'Custom start message' }),
    })
    await POST(req)
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.message).toBe('Custom start message')
  })
})
