import { NextResponse } from 'next/server'
import { getWalletBalance } from '@/lib/bscscan'
import fs from 'fs'
import path from 'path'

function readConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf-8')) } catch { return {} }
}

export async function GET() {
  const cfg = readConfig()
  const address = process.env.BNB_ADDRESS || cfg.bnbAddress || ''
  const apiKey = process.env.BSCSCAN_API_KEY || cfg.bscscanApiKey || ''
  const balance = await getWalletBalance(address, apiKey)
  return NextResponse.json(balance)
}
