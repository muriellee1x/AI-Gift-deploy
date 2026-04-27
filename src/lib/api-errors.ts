import { NextRequest, NextResponse } from 'next/server'

const ERROR_MAP: Record<string, { status: number; message: string }> = {
  NOT_FOUND: { status: 404, message: 'Resource not found' },
  FORBIDDEN: { status: 403, message: 'Forbidden' },
  BAD_REQUEST: { status: 400, message: 'Bad request' },
  UNAUTHORIZED: { status: 401, message: 'Unauthorized' },
  INTERNAL: { status: 500, message: 'Internal server error' },
}

export class ApiError extends Error {
  code: string
  status: number

  constructor(code: string, message?: string) {
    const mapped = ERROR_MAP[code] ?? ERROR_MAP.INTERNAL
    super(message ?? mapped.message)
    this.code = code
    this.status = mapped.status
  }
}

export function apiHandler(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (req: NextRequest, ctx: any) => Promise<NextResponse>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: NextRequest, ctx: any) => {
    try {
      return await handler(req, ctx)
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.code, message: error.message },
          { status: error.status },
        )
      }
      console.error('[API Error]', error)
      return NextResponse.json(
        { error: 'INTERNAL', message: 'Internal server error' },
        { status: 500 },
      )
    }
  }
}
