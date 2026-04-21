import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.BNB_ADDRESS
  delete process.env.BSCSCAN_API_KEY
  vi.resetModules()
})

describe('GET /api/wallet', () => {
  it('returns Not configured when env vars missing', async () => {
    const { GET } = await import('@/app/api/wallet/route')
    const res = await GET()
    const body = await res.json()
    expect(body.error).toBe('Not configured')
  })

  it('returns wallet balance when configured', async () => {
    process.env.BNB_ADDRESS = '0xabc'
    process.env.BSCSCAN_API_KEY = 'testkey'
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ result: '1000000000000000000' }) })
      .mockResolvedValueOnce({ json: async () => ({ result: { ethusd: '600' } }) })
    )
    const { GET } = await import('@/app/api/wallet/route')
    const res = await GET()
    const body = await res.json()
    expect(body.bnb).toBe('1.0000')
    expect(body.bnb_usd).toBe('600.00')
  })
})
