import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession, deleteSession } from '@/lib/sessions'

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
  if (session.status === 'active') {
    return NextResponse.json({ error: 'Cannot delete an active session' }, { status: 409 })
  }
  deleteSession(id)
  return NextResponse.json({ ok: true })
}
