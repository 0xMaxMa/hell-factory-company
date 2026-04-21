import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-config-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  vi.resetModules()
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('GET /api/config', () => {
  it('returns empty config when file does not exist', async () => {
    const { GET } = await import('@/app/api/config/route')
    const res = await GET()
    const body = await res.json()
    expect(body.config).toEqual({})
  })

  it('returns saved config when file exists', async () => {
    const saved = { gatewayUrl: 'http://test:4000', apiKey: 'abc' }
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(saved))
    const { GET } = await import('@/app/api/config/route')
    const res = await GET()
    const body = await res.json()
    expect(body.config.gatewayUrl).toBe('http://test:4000')
    expect(body.config.apiKey).toBe('abc')
  })
})

describe('POST /api/config', () => {
  it('saves config to config.json in cwd', async () => {
    const { POST } = await import('@/app/api/config/route')
    const config = { gatewayUrl: 'http://localhost:9000', agentId: 'test-agent' }
    const req = new Request('http://localhost/api/config', {
      method: 'POST',
      body: JSON.stringify({ config }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(body.success).toBe(true)
    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'))
    expect(written.gatewayUrl).toBe('http://localhost:9000')
    expect(written.agentId).toBe('test-agent')
  })

  it('overwrites existing config', async () => {
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ gatewayUrl: 'old' }))
    const { POST } = await import('@/app/api/config/route')
    const req = new Request('http://localhost/api/config', {
      method: 'POST',
      body: JSON.stringify({ config: { gatewayUrl: 'new' } }),
    })
    await POST(req)
    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'))
    expect(written.gatewayUrl).toBe('new')
  })
})
