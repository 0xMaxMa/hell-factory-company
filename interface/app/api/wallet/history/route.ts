import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const p = path.join(process.cwd(), 'wallet_history.json')
    if (!fs.existsSync(p)) return NextResponse.json({ history: [] })
    const history = JSON.parse(fs.readFileSync(p, 'utf-8'))
    return NextResponse.json({ history })
  } catch {
    return NextResponse.json({ history: [] })
  }
}
