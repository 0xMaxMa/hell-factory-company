import fs from 'fs'
import path from 'path'
import { JobWorkspace } from './types'

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf-8'))
  } catch { return {} }
}

export function getWorkspacePath(): string {
  const cfg = readConfig()
  return process.env.WORKSPACE_PATH || cfg.workspacePath || '/home/dev/projects/hell-factory-company/job_workspaces'
}

function earningsByJob(): Record<string, number> {
  try {
    const p = path.join(process.cwd(), 'payments.json')
    const payments: Array<{ job: string; amount: string }> = JSON.parse(fs.readFileSync(p, 'utf-8')) || []
    const totals: Record<string, number> = {}
    for (const pay of payments) totals[pay.job] = (totals[pay.job] || 0) + parseFloat(pay.amount || '0')
    return totals
  } catch { return {} }
}

export function listJobs(enabledOnly = false): JobWorkspace[] {
  const dir = getWorkspacePath()
  if (!fs.existsSync(dir)) return []

  const totals = earningsByJob()
  const jobs: JobWorkspace[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const jsonPath = path.join(dir, entry.name, 'job.json')
    if (!fs.existsSync(jsonPath)) continue
    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
      const name = raw.name || raw.job_id || entry.name
      const job: JobWorkspace = {
        ...raw,
        name,
        slug: entry.name,
        enabled: raw.enabled !== false,
        total_earnings: totals[name] || 0,
      }
      if (enabledOnly && !job.enabled) continue
      jobs.push(job)
    } catch { /* skip malformed */ }
  }
  return jobs
}

export function getJob(name: string): JobWorkspace | null {
  const dir = getWorkspacePath()
  const jsonPath = path.join(dir, name, 'job.json')
  if (!fs.existsSync(jsonPath)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
    return { ...raw, name: raw.name || raw.job_id || name, enabled: raw.enabled !== false }
  } catch { return null }
}

export function toggleJob(name: string, enabled: boolean): boolean {
  const dir = getWorkspacePath()
  const jsonPath = path.join(dir, name, 'job.json')
  if (!fs.existsSync(jsonPath)) return false
  try {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
    raw.enabled = enabled
    fs.writeFileSync(jsonPath, JSON.stringify(raw, null, 2))
    return true
  } catch { return false }
}

export function getRunbook(name: string): string | null {
  const dir = getWorkspacePath()
  const p = path.join(dir, name, 'RUNBOOK.md')
  if (!fs.existsSync(p)) return null
  return fs.readFileSync(p, 'utf-8')
}

export { parseEarnings } from './utils'

export function getEarningsDisplay(job: JobWorkspace): string {
  if (typeof job.estimated_earnings === 'string') return job.estimated_earnings
  const e = job.estimated_earnings as Record<string, unknown>
  if (!e) return 'N/A'
  if (e.per_project_min !== undefined) {
    return `$${e.per_project_min}–$${e.per_project_max}/project`
  }
  return 'N/A'
}
