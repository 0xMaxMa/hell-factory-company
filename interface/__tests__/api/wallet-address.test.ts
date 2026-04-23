import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('GET /api/wallet/address', () => {
  it('returns wallet address when script succeeds', async () => {
    vi.doMock('@/lib/walletScript', () => ({
      getWalletAddressFromScript: () => '0xf0189A9b34239DC69B9294Fe681115d342962295',
    }))
    const { GET } = await import('@/app/api/wallet/address/route')
    const res = await GET()
    const body = await res.json()
    expect(body.address).toBe('0xf0189A9b34239DC69B9294Fe681115d342962295')
  })

  it('returns error when no wallet configured', async () => {
    vi.doMock('@/lib/walletScript', () => ({
      getWalletAddressFromScript: () => '',
    }))
    const { GET } = await import('@/app/api/wallet/address/route')
    const res = await GET()
    const body = await res.json()
    expect(body.error).toBe('No wallet configured')
  })
})
