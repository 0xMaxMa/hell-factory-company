import { describe, it, expect, vi, afterEach } from 'vitest'
import { getWalletBalance } from '@/lib/bscscan'

afterEach(() => vi.restoreAllMocks())

describe('getWalletBalance', () => {
  it('returns error response when address or apiKey is empty', async () => {
    const result = await getWalletBalance('', '')
    expect(result.error).toBe('Not configured')
    expect(result.bnb).toBe('0')
  })

  it('returns error response when only address is empty', async () => {
    const result = await getWalletBalance('', 'somekey')
    expect(result.error).toBe('Not configured')
  })

  it('returns error response when only apiKey is empty', async () => {
    const result = await getWalletBalance('0xabc', '')
    expect(result.error).toBe('Not configured')
  })

  it('fetches and calculates BNB balance correctly', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ result: '1000000000000000000' }) }) // 1 BNB
      .mockResolvedValueOnce({ json: async () => ({ result: { ethusd: '600' } }) }) // $600/BNB
    vi.stubGlobal('fetch', mockFetch)

    const result = await getWalletBalance('0xabc', 'key')
    expect(result.bnb).toBe('1.0000')
    expect(result.bnb_usd).toBe('600.00')
    expect(result.total_usd).toBe('600.00')
    expect(result.error).toBeUndefined()
  })

  it('handles fetch failure gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const result = await getWalletBalance('0xabc', 'key')
    expect(result.error).toContain('network error')
    expect(result.bnb).toBe('0')
  })

  it('handles missing price data gracefully', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ result: '2000000000000000000' }) }) // 2 BNB
      .mockResolvedValueOnce({ json: async () => ({ result: {} }) }) // no price
    vi.stubGlobal('fetch', mockFetch)

    const result = await getWalletBalance('0xabc', 'key')
    expect(result.bnb).toBe('2.0000')
    expect(result.bnb_usd).toBe('0.00')
  })
})
