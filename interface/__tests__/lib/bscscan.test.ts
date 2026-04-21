import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

afterEach(() => vi.restoreAllMocks())

describe('getWalletBalance', () => {
  it('returns error response when address or apiKey is empty', async () => {
    vi.resetModules()
    const { getWalletBalance } = await import('@/lib/bscscan')
    const result = await getWalletBalance('', '')
    expect(result.error).toBe('Not configured')
    expect(result.bnb).toBe('0')
  })

  it('returns error response when only address is empty', async () => {
    vi.resetModules()
    const { getWalletBalance } = await import('@/lib/bscscan')
    const result = await getWalletBalance('', 'somekey')
    expect(result.error).toBe('Not configured')
  })

  it('returns error response when only apiKey is empty', async () => {
    vi.resetModules()
    const { getWalletBalance } = await import('@/lib/bscscan')
    const result = await getWalletBalance('0xabc', '')
    expect(result.error).toBe('Not configured')
  })

  it('fetches and calculates BNB balance correctly', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsc-test-'))
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    vi.resetModules()
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ result: '1000000000000000000' }) })
      .mockResolvedValueOnce({ json: async () => ({ result: { ethusd: '600' } }) })
    vi.stubGlobal('fetch', mockFetch)
    const { getWalletBalance } = await import('@/lib/bscscan')
    const result = await getWalletBalance('0xabc', 'key')
    expect(result.bnb).toBe('1.0000')
    expect(result.bnb_usd).toBe('600.00')
    expect(result.total_usd).toBe('600.00')
    expect(result.error).toBeUndefined()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('handles fetch failure gracefully', async () => {
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const { getWalletBalance } = await import('@/lib/bscscan')
    const result = await getWalletBalance('0xabc', 'key')
    expect(result.error).toContain('network error')
    expect(result.bnb).toBe('0')
  })

  it('handles missing price data gracefully', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsc-test-'))
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    vi.resetModules()
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ result: '2000000000000000000' }) })
      .mockResolvedValueOnce({ json: async () => ({ result: {} }) })
    vi.stubGlobal('fetch', mockFetch)
    const { getWalletBalance } = await import('@/lib/bscscan')
    const result = await getWalletBalance('0xabc', 'key')
    expect(result.bnb).toBe('2.0000')
    expect(result.bnb_usd).toBe('0.00')
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('saves daily snapshot to wallet_history.json', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsc-snap-'))
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ result: '1000000000000000000' }) })
      .mockResolvedValueOnce({ json: async () => ({ result: { ethusd: '300' } }) })
    )
    const { getWalletBalance } = await import('@/lib/bscscan')
    await getWalletBalance('0xabc', 'key')
    const historyPath = path.join(tmpDir, 'wallet_history.json')
    expect(fs.existsSync(historyPath)).toBe(true)
    const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'))
    expect(history).toHaveLength(1)
    expect(history[0].total_usd).toBe(300)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('deduplicates snapshot by date', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsc-dedup-'))
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValue({ json: async () => ({ result: '1000000000000000000' }) })
    )
    // Pre-seed today's entry
    const today = new Date().toISOString().slice(0, 10)
    fs.writeFileSync(path.join(tmpDir, 'wallet_history.json'), JSON.stringify([{ date: today, total_usd: 100 }]))
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ result: '2000000000000000000' }) })
      .mockResolvedValueOnce({ json: async () => ({ result: { ethusd: '300' } }) })
    )
    const { getWalletBalance } = await import('@/lib/bscscan')
    await getWalletBalance('0xabc', 'key')
    const history = JSON.parse(fs.readFileSync(path.join(tmpDir, 'wallet_history.json'), 'utf-8'))
    expect(history.filter((e: { date: string }) => e.date === today)).toHaveLength(1)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

describe('getTransactions', () => {
  it('returns empty array when not configured', async () => {
    vi.resetModules()
    const { getTransactions } = await import('@/lib/bscscan')
    const result = await getTransactions('', '')
    expect(result).toEqual([])
  })

  it('filters incoming transactions', async () => {
    vi.resetModules()
    const addr = '0xabc'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      json: async () => ({
        result: [
          { to: '0xabc', hash: '0x1', from: '0xsender', value: '1000', timeStamp: '1000' },
          { to: '0xother', hash: '0x2', from: '0xsender', value: '2000', timeStamp: '2000' },
        ],
      }),
    }))
    const { getTransactions } = await import('@/lib/bscscan')
    const result = await getTransactions(addr, 'key')
    expect(result).toHaveLength(1)
    expect(result[0].hash).toBe('0x1')
  })
})
