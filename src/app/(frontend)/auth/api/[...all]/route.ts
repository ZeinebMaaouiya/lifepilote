import { toNextJsHandler } from 'better-auth/next-js'
import { getAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    return toNextJsHandler(getAuth()).GET(request)
  } catch (error) {
    console.error('[auth] authentication API is unavailable:', error)
    return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    return toNextJsHandler(getAuth()).POST(request)
  } catch (error) {
    console.error('[auth] authentication API is unavailable:', error)
    return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 })
  }
}
