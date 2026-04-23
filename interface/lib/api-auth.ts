import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

function getHellFactoryApiKey(): string {
  if (process.env.HELL_FACTORY_API_KEY) return process.env.HELL_FACTORY_API_KEY
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf-8'))
    return cfg.apiKey || ''
  } catch {
    return ''
  }
}

export function validateApiKey(req: NextRequest): boolean {
  const key = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '')
  if (!key) return false
  const validKey = getHellFactoryApiKey()
  return key === validKey
}
