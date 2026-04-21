import { NextRequest, NextResponse } from 'next/server'
import { loadMessages, appendMessage, ChatMessage } from '@/lib/chat-logs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const messages = loadMessages(id)
  return NextResponse.json({ messages })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const message: ChatMessage = await req.json()
  appendMessage(id, message)
  return NextResponse.json({ ok: true })
}
