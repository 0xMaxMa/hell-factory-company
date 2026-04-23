import { NextRequest, NextResponse } from 'next/server'
import { loadPayments, recordPayment } from '@/lib/payments'

export async function GET() {
  return NextResponse.json({ payments: loadPayments() })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { agentId, job, token, amount } = body
  if (!agentId || !job || !token || !amount) {
    return NextResponse.json({ error: 'Missing required fields: agentId, job, token, amount' }, { status: 400 })
  }
  const payment = recordPayment({ agentId, job, token, amount: String(amount) })
  return NextResponse.json({ payment }, { status: 201 })
}
