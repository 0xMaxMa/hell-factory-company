import fs from 'fs'
import path from 'path'

interface JobRunEntry {
  name: string
  last_run: string | null
}

function loadJobRuns(workspacePath: string): JobRunEntry[] {
  try {
    const entries: JobRunEntry[] = []
    const dirs = fs.readdirSync(workspacePath)
    for (const dir of dirs) {
      const jobFile = path.join(workspacePath, dir, 'job.json')
      if (!fs.existsSync(jobFile)) continue
      const job = JSON.parse(fs.readFileSync(jobFile, 'utf-8'))
      if (job.last_run) entries.push({ name: dir, last_run: job.last_run })
    }
    return entries
  } catch {
    return []
  }
}

export function attributeJob(txTimestamp: number, workspacePath: string): string | null {
  const jobs = loadJobRuns(workspacePath)
  const TWO_HOURS = 2 * 60 * 60 * 1000
  let best: { name: string; diff: number } | null = null
  for (const job of jobs) {
    if (!job.last_run) continue
    const runTs = new Date(job.last_run).getTime()
    const diff = txTimestamp * 1000 - runTs
    if (diff >= 0 && diff <= TWO_HOURS) {
      if (!best || diff < best.diff) best = { name: job.name, diff }
    }
  }
  return best ? best.name : null
}
