import { NextResponse } from 'next/server'
import { getGatewayStatus } from '@/lib/gateway'

export async function GET() {
  try {
    const data = await getGatewayStatus()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e), agents: [] }, { status: 200 })
  }
}
