import { NextResponse } from 'next/server'
import { getMultiTokenBalance, saveHistorySnapshotIfNeeded, detectAndSaveIncomingPayments } from '@/lib/walletBalance'
import { getWalletAddressFromScript } from '@/lib/walletScript'

// Called by cron every hour — saves daily snapshot if not yet recorded, detects new incoming payments
export async function GET() {
  const address = getWalletAddressFromScript()
  const [snapshot, newTxs] = await Promise.all([
    getMultiTokenBalance(address),
    detectAndSaveIncomingPayments(address),
  ])
  const saved = saveHistorySnapshotIfNeeded(snapshot.total_usd)
  return NextResponse.json({ saved, total_usd: snapshot.total_usd, new_payments: newTxs.length })
}
