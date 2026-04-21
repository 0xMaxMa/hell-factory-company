import { NextRequest, NextResponse } from 'next/server'
import { listSessions, createSession } from '@/lib/sessions'

export async function GET() {
  const sessions = listSessions()
  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { jobName } = body
  if (!jobName || typeof jobName !== 'string') {
    return NextResponse.json({ error: 'jobName is required' }, { status: 400 })
  }
  const session = createSession(jobName)
  return NextResponse.json({ session }, { status: 201 })
}
