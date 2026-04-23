import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const GATEWAY_SESSIONS = '/home/dev/.claude-gateway/agents/indian-programmer/sessions'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sinceParam = req.nextUrl.searchParams.get('since')
  const sinceTs = sinceParam ? parseInt(sinceParam, 10) : 0
  const jsonlPath = path.join(GATEWAY_SESSIONS, `${id}.jsonl`)

  try {
    const raw = fs.readFileSync(jsonlPath, 'utf-8').trim()
    const lines = raw.split('\n').filter(Boolean)
    // Return the first assistant message at or after sinceTs (the job-run response)
    // Falls back to last assistant message if no sinceTs provided
    // Always return the LAST assistant message (most complete response)
    // filter by sinceTs to only look at messages from this job run
    const candidates = lines
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(e => e && e.role === 'assistant' && e.content && (sinceTs === 0 || (e.ts || 0) >= sinceTs))
    if (candidates.length > 0) {
      const last = candidates[candidates.length - 1]
      return NextResponse.json({ content: last.content })
    }
    return NextResponse.json({ content: null })
  } catch {
    return NextResponse.json({ content: null })
  }
}
