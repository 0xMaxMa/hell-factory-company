import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

const mockTxs = [
  { hash: '0xaaa', from: '0xsender1', to: '0xf0189', value: '500000000000000000', timeStamp: '1713600000' },
  { hash: '0xbbb', from: '0xsender2', to: '0xother', value: '100000000000000000', timeStamp: '1713500000' },
]

describe('GET /api/wallet/transactions', () => {
  it('returns error when wallet not configured', async () => {
    vi.doMock('@/lib/walletScript', () => ({ getWalletAddressFromScript: () => '' }))
    vi.doMock('fs', () => ({
      default: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => '{}'), writeFileSync: vi.fn() },
      existsSync: vi.fn(() => false),
      readFileSync: vi.fn(() => '{}'),
      writeFileSync: vi.fn(),
    }))
    const { GET } = await import('@/app/api/wallet/transactions/route')
    const res = await GET()
    const body = await res.json()
    expect(body.transactions).toEqual([])
    expect(body.error).toBeTruthy()
  })

  it('returns incoming transactions with job attribution', async () => {
    vi.doMock('@/lib/walletScript', () => ({ getWalletAddressFromScript: () => '0xf0189' }))
    vi.doMock('@/lib/txAttribution', () => ({ attributeJob: () => null }))
    vi.doMock('@/lib/jobs', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/lib/jobs')>()
      return { ...actual, getWorkspacePath: () => '/tmp/jobs' }
    })
    vi.doMock('fs', () => ({
      default: {
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => JSON.stringify({ bscscanApiKey: 'testkey' })),
        writeFileSync: vi.fn(),
        readdirSync: vi.fn(() => []),
      },
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => JSON.stringify({ bscscanApiKey: 'testkey' })),
      writeFileSync: vi.fn(),
      readdirSync: vi.fn(() => []),
    }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ json: async () => ({ result: mockTxs }) }))
    const { GET } = await import('@/app/api/wallet/transactions/route')
    const res = await GET()
    const body = await res.json()
    expect(body.transactions).toHaveLength(1)
    expect(body.transactions[0].hash).toBe('0xaaa')
    expect(body.transactions[0].value_bnb).toBe('0.500000')
  })
})
