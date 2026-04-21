import { NextRequest, NextResponse } from 'next/server'
import { listJobs } from '@/lib/jobs'

export async function GET(req: NextRequest) {
  const enabledOnly = req.nextUrl.searchParams.get('all') !== '1'
  const jobs = listJobs(enabledOnly)
  return NextResponse.json({ jobs })
}
