import { NextResponse } from 'next/server'
import { getRunbook } from '@/lib/jobs'

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const content = getRunbook(name)
  if (content === null) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ content })
}
