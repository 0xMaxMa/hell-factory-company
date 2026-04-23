import { NextResponse } from 'next/server'
import { getTransactions } from '@/lib/bscscan'
import { attributeJob } from '@/lib/txAttribution'
import { getWorkspacePath } from '@/lib/jobs'
import { getWalletAddressFromScript } from '@/lib/walletScript'
export async function GET() {
  const address = getWalletAddressFromScript()

  if (!address) {
    return NextResponse.json({ transactions: [], error: 'Wallet not configured' })
  }

  const raw = await getTransactions(address)
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
