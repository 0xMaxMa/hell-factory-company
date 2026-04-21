import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { attributeJob } from '@/lib/txAttribution'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-attr-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function makeJob(name: string, lastRun: string | null) {
  const dir = path.join(tmpDir, name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({ last_run: lastRun }))
}

describe('attributeJob', () => {
  it('returns null when no jobs match', () => {
    expect(attributeJob(1713600000, tmpDir)).toBeNull()
  })

  it('matches tx timestamp within 2 hours of job last_run', () => {
    const runTime = new Date('2024-04-20T10:00:00Z')
    const txTimestamp = Math.floor(runTime.getTime() / 1000) + 3600 // 1h after
    makeJob('teach-eng', runTime.toISOString())
    expect(attributeJob(txTimestamp, tmpDir)).toBe('teach-eng')
  })

  it('does not match tx timestamp more than 2 hours after job run', () => {
    const runTime = new Date('2024-04-20T10:00:00Z')
    const txTimestamp = Math.floor(runTime.getTime() / 1000) + 7201 // 2h+1s after
    makeJob('teach-eng', runTime.toISOString())
    expect(attributeJob(txTimestamp, tmpDir)).toBeNull()
  })

  it('does not match tx before job run', () => {
    const runTime = new Date('2024-04-20T10:00:00Z')
    const txTimestamp = Math.floor(runTime.getTime() / 1000) - 1
    makeJob('teach-eng', runTime.toISOString())
    expect(attributeJob(txTimestamp, tmpDir)).toBeNull()
  })

  it('picks the closest matching job', () => {
    const base = new Date('2024-04-20T10:00:00Z').getTime()
    const txTimestamp = Math.floor(base / 1000) + 1800 // 30min after base
    makeJob('job-a', new Date(base).toISOString())           // 30min before tx
    makeJob('job-b', new Date(base - 3600000).toISOString()) // 90min before tx
    expect(attributeJob(txTimestamp, tmpDir)).toBe('job-a')
  })

  it('skips jobs with null last_run', () => {
    makeJob('no-run', null)
    expect(attributeJob(1713600000, tmpDir)).toBeNull()
  })
})
