import { NextResponse } from 'next/server'
import { getDb } from '@equitylens/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Simple connectivity check via the underlying SQLite client
    getDb().$client.prepare('SELECT 1').get()
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 503 },
    )
  }
}
