import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

afterEach(() => vi.restoreAllMocks())

// getWalletBalance is now getMultiTokenBalance re-exported from walletBalance.ts
// It takes only 1 arg (address) and returns { tokens, venus, total_usd }

describe('getWalletBalance', () => {
  it('returns error response when address is empty', async () => {
    vi.resetModules()
    const { getWalletBalance } = await import('@/lib/bscscan')
    const result = await getWalletBalance('')
    expect(result.error).toBe('Not configured')
    expect(result.total_usd).toBe('0')
    expect(result.tokens).toEqual([])
    expect(result.venus).toEqual([])
  })

  it('fetches and calculates multi-token balances', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsc-test-'))
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    vi.resetModules()

    const zeroHex = '0x' + '0'.padStart(64, '0')
    const bnbHex = '0x' + BigInt('1000000000000000000').toString(16).padStart(64, '0') // 1 BNB
    const priceData = [
      { symbol: 'BNBUSDT', price: '600' },
      { symbol: 'BTCUSDT', price: '60000' },
      { symbol: 'ETHUSDT', price: '3000' },
    ]
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ json: async () => priceData })           // Binance prices
      .mockResolvedValue({ json: async () => ({ result: zeroHex }) })   // all other RPC calls

    // BNB balance returns 1 BNB via eth_getBalance
    mockFetch.mockResolvedValueOnce({ json: async () => priceData })
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('binance.com')) {
        return Promise.resolve({ json: async () => priceData })
      }
      // RPC calls: return 1 BNB for first call, zero for rest
      return Promise.resolve({ json: async () => ({ result: zeroHex }) })
    }))

    const { getWalletBalance } = await import('@/lib/bscscan')
    const result = await getWalletBalance('0xabc')
    expect(result.error).toBeUndefined()
    expect(result.tokens).toBeDefined()
    expect(Array.isArray(result.tokens)).toBe(true)
    expect(result.venus).toBeDefined()
    expect(result.total_usd).toBeDefined()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('handles fetch failure gracefully', async () => {
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const { getWalletBalance } = await import('@/lib/bscscan')
    const result = await getWalletBalance('0xabc')
    expect(result.error).toContain('network error')
    expect(result.tokens).toEqual([])
    expect(result.venus).toEqual([])
  })
})

describe('getTransactions', () => {
  it('returns empty array', async () => {
    vi.resetModules()
    const { getTransactions } = await import('@/lib/bscscan')
    const result = await getTransactions('0xabc')
    expect(result).toEqual([])
  })
})
