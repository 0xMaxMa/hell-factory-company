import { NextResponse } from 'next/server'
import { getJob } from '@/lib/jobs'

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const job = getJob(name)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ job })
}
