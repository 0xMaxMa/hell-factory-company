import { execSync } from 'child_process'
import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession, deleteSession } from '@/lib/sessions'

function killBotProcess(jobSlug: string): void {
  try {
    execSync(`pkill -f "job_workspaces/${jobSlug}/scripts/"`, { stdio: 'ignore' })
  } catch {
    // process not running — ignore
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { status } = body
  const validStatuses = ['active', 'idle', 'completed', 'error']
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  const session = updateSession(id, { status })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  return NextResponse.json({ session })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = getSession(id)
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  killBotProcess(session.jobSlug)
  deleteSession(id)
  return NextResponse.json({ ok: true })
}
