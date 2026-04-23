import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

const mockTxs = [
  { hash: '0xaaa', from: '0xsender1', value: '500000000000000000', timeStamp: '1713600000' },
  { hash: '0xbbb', from: '0xsender2', value: '100000000000000000', timeStamp: '1713500000' },
]

describe('GET /api/wallet/transactions', () => {
  it('returns error when wallet not configured', async () => {
    vi.doMock('@/lib/walletScript', () => ({ getWalletAddressFromScript: () => '' }))
    const { GET } = await import('@/app/api/wallet/transactions/route')
    const res = await GET()
    const body = await res.json()
    expect(body.transactions).toEqual([])
    expect(body.error).toBeTruthy()
  })

  it('returns incoming transactions with job attribution', async () => {
    vi.doMock('@/lib/walletScript', () => ({ getWalletAddressFromScript: () => '0xf0189' }))
    vi.doMock('@/lib/bscscan', () => ({
      getTransactions: async () => mockTxs,
    }))
    vi.doMock('@/lib/txAttribution', () => ({ attributeJob: () => null }))
    vi.doMock('@/lib/jobs', () => ({ getWorkspacePath: () => '/tmp/jobs' }))
    const { GET } = await import('@/app/api/wallet/transactions/route')
    const res = await GET()
    const body = await res.json()
    expect(body.transactions).toHaveLength(2)
    expect(body.transactions[0].hash).toBe('0xaaa')
    expect(body.transactions[0].value_bnb).toBe('0.500000')
  })
})
