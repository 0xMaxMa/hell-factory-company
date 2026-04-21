import { NextResponse } from 'next/server'
import { toggleJob } from '@/lib/jobs'

export async function PATCH(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const { enabled } = await req.json()
  const ok = toggleJob(name, Boolean(enabled))
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, enabled: Boolean(enabled) })
}
