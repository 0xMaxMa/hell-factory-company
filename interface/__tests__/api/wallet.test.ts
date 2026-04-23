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

  it('returns wallet balance when address found and API key configured', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-rt-'))
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ bscscanApiKey: 'testkey' }))
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    vi.doMock('@/lib/walletScript', () => ({ getWalletAddressFromScript: () => '0xabc123' }))
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ result: '1000000000000000000' }) })
      .mockResolvedValueOnce({ json: async () => ({ result: { ethusd: '600' } }) })
    )
    const { GET } = await import('@/app/api/wallet/route')
    const res = await GET()
    const body = await res.json()
    expect(body.bnb).toBe('1.0000')
    expect(body.bnb_usd).toBe('600.00')
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
