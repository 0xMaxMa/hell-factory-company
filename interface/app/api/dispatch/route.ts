import { NextRequest, NextResponse } from 'next/server'
import { getGatewayConfig } from '@/lib/gateway'

export async function POST(req: NextRequest) {
  const { jobs, initial_message } = await req.json()
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return NextResponse.json({ error: 'jobs array required' }, { status: 400 })
  }

  const { url, apiKey, agentId } = getGatewayConfig()
  const results = await Promise.allSettled(
    jobs.map(async (jobName: string) => {
      const sessionId = `job-${jobName}-${Date.now()}`
      const message = initial_message || `Start working on job workspace: ${jobName}. Read the RUNBOOK.md and begin.`
      const res = await fetch(`${url}/api/v1/agents/${agentId}/messages`, {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, session_id: sessionId }),
      })
      const data = await res.json()
      return { job: jobName, session_id: sessionId, ...data }
    })
  )

  return NextResponse.json({
    launched: results.map((r, i) => ({
      job: jobs[i],
      status: r.status,
      ...(r.status === 'fulfilled' ? r.value : { error: String((r as PromiseRejectedResult).reason) }),
    })),
  })
}
