import { NextResponse } from 'next/server'
import { getTransactions } from '@/lib/bscscan'
import { attributeJob } from '@/lib/txAttribution'
import { getWorkspacePath } from '@/lib/jobs'
import { getWalletAddressFromScript } from '@/lib/walletScript'
import fs from 'fs'
import path from 'path'

function readConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf-8')) } catch { return {} }
}

export async function GET() {
  const cfg = readConfig()
  const apiKey = cfg.bscscanApiKey || ''
  const address = getWalletAddressFromScript()

  if (!address || !apiKey) {
    return NextResponse.json({ transactions: [], error: 'Wallet or BSCScan API key not configured' })
  }

  const raw = await getTransactions(address, apiKey)
  const workspacePath = getWorkspacePath()

  const transactions = raw.map((tx: { hash: string; from: string; value: string; timeStamp: string }) => ({
    hash: tx.hash,
    from: tx.from,
    value_bnb: (Number(tx.value) / 1e18).toFixed(6),
    timestamp: Number(tx.timeStamp),
    job_name: attributeJob(Number(tx.timeStamp), workspacePath),
  }))

  return NextResponse.json({ transactions })
}
