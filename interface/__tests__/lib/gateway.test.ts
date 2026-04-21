import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-gateway-test-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  vi.restoreAllMocks()
  vi.resetModules()
  delete process.env.GATEWAY_URL
  delete process.env.GATEWAY_API_KEY
  delete process.env.GATEWAY_AGENT_ID
})

describe('getGatewayConfig', () => {
  it('returns defaults when env vars not set', async () => {
    const { getGatewayConfig } = await import('@/lib/gateway')
    const cfg = getGatewayConfig()
    expect(cfg.url).toBe('http://localhost:3000')
    expect(cfg.apiKey).toBe('')
    expect(cfg.agentId).toBe('indian-programmer')
  })

  it('uses env vars when set', async () => {
    process.env.GATEWAY_URL = 'http://mygateway:4000'
    process.env.GATEWAY_API_KEY = 'secret-key'
    process.env.GATEWAY_AGENT_ID = 'my-agent'
    const { getGatewayConfig } = await import('@/lib/gateway')
    const cfg = getGatewayConfig()
    expect(cfg.url).toBe('http://mygateway:4000')
    expect(cfg.apiKey).toBe('secret-key')
    expect(cfg.agentId).toBe('my-agent')
  })
})

describe('getGatewayStatus', () => {
  it('returns parsed JSON on success', async () => {
    const { getGatewayStatus } = await import('@/lib/gateway')
    const mockData = { agents: [{ id: 'indian-programmer', sessions: [] }] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    }))
    const result = await getGatewayStatus()
    expect(result.agents).toHaveLength(1)
    expect(result.agents[0].id).toBe('indian-programmer')
  })

  it('throws on non-OK response', async () => {
    const { getGatewayStatus } = await import('@/lib/gateway')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    await expect(getGatewayStatus()).rejects.toThrow('Gateway error: 401')
  })

  it('passes X-Api-Key header', async () => {
    process.env.GATEWAY_API_KEY = 'my-test-key'
    const { getGatewayStatus } = await import('@/lib/gateway')
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ agents: [] }) })
    vi.stubGlobal('fetch', mockFetch)
    await getGatewayStatus()
    expect(mockFetch.mock.calls[0][1].headers['X-Api-Key']).toBe('my-test-key')
  })
})
