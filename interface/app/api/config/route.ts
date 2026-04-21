import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const CONFIG_PATH = path.join(process.cwd(), 'config.json')

export async function GET() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return NextResponse.json({ config: {} })
    }
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    return NextResponse.json({ config: JSON.parse(raw) })
  } catch {
    return NextResponse.json({ config: {} })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { config } = await req.json()
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
