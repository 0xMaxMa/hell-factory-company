import { NextResponse } from 'next/server'
import { getMultiTokenBalance, saveHistorySnapshotIfNeeded } from '@/lib/walletBalance'
import { getWalletAddressFromScript } from '@/lib/walletScript'

export async function GET() {
  const address = getWalletAddressFromScript()
  const snapshot = await getMultiTokenBalance(address)
  saveHistorySnapshotIfNeeded(snapshot.total_usd)
  return NextResponse.json(snapshot)
}
