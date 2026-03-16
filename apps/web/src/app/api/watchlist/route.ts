import { NextResponse } from 'next/server'
import { getWatchlistData } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = getWatchlistData()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 },
    )
  }
}
