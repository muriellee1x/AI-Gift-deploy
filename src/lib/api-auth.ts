import { getServerSession } from 'next-auth/next'
import { NextResponse } from 'next/server'
import { authOptions } from './auth'

type AuthSession = {
  user: { id: string; name: string }
}

type AuthResult =
  | { session: AuthSession }
  | NextResponse

export function isErrorResponse(result: AuthResult): result is NextResponse {
  return result instanceof NextResponse
}

export async function requireUserAuth(): Promise<AuthResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return { session: session as unknown as AuthSession }
}
