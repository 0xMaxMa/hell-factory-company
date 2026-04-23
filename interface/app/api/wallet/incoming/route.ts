import { NextResponse } from 'next/server'
import { getIncomingHistory } from '@/lib/walletBalance'

export async function GET() {
  return NextResponse.json({ transactions: getIncomingHistory() })
}
