import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('GET /api/wallet', () => {
  it('returns Not configured when no wallet address found', async () => {
    vi.doMock('@/lib/walletScript', () => ({ getWalletAddressFromScript: () => '' }))
    const { GET } = await import('@/app/api/wallet/route')
    const res = await GET()
    const body = await res.json()
    expect(body.error).toBe('Not configured')
  })

  it('returns wallet balance when address found', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-rt-'))
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ bscscanApiKey: 'testkey' }))
    fs.writeFileSync(path.join(tmpDir, 'wallet_history.json'), '[]')
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    vi.doMock('@/lib/walletScript', () => ({ getWalletAddressFromScript: () => '0xabc123' }))
    vi.doMock('@/lib/walletBalance', () => ({
      getMultiTokenBalance: async () => ({
        address: '0xabc123',
        tokens: [{ symbol: 'BNB', balance: '1.000000', price: 600, usd: '600.00' }],
        venus: [],
        total_usd: '600.00',
      }),
      saveHistorySnapshotIfNeeded: () => false,
    }))
    const { GET } = await import('@/app/api/wallet/route')
    const res = await GET()
    const body = await res.json()
    expect(body.address).toBe('0xabc123')
    expect(body.tokens).toHaveLength(1)
    expect(body.tokens[0].symbol).toBe('BNB')
    expect(body.tokens[0].balance).toBe('1.000000')
    expect(body.total_usd).toBe('600.00')
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
