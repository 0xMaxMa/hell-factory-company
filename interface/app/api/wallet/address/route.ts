import { NextResponse } from 'next/server'
import { getWalletAddressFromScript } from '@/lib/walletScript'

export async function GET() {
  const address = getWalletAddressFromScript()
  if (address) return NextResponse.json({ address })
  return NextResponse.json({ error: 'No wallet configured' })
}
