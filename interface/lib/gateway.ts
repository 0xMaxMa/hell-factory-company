import fs from 'fs'
import path from 'path'

function readConfig() {
  try {
    const p = path.join(process.cwd(), 'config.json')
    const raw = fs.readFileSync(p, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function getGatewayConfig() {
  const cfg = readConfig()
  return {
    url: process.env.GATEWAY_URL || cfg.gatewayUrl || 'http://localhost:3000',
    apiKey: process.env.GATEWAY_API_KEY || cfg.apiKey || '',
    agentId: process.env.GATEWAY_AGENT_ID || cfg.agentId || 'indian-programmer',
  }
}

export async function getGatewayStatus() {
  const { url, apiKey } = getGatewayConfig()
  const res = await fetch(`${url}/api/v1/agents`, {
    headers: { 'X-Api-Key': apiKey },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Gateway error: ${res.status}`)
  return res.json()
}
