import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { apiHandler, ApiError } from '@/lib/api-errors'
import { prisma } from '@/lib/prisma'

export const POST = apiHandler(async (request: NextRequest) => {
  const body = await request.json()
  const { name, password } = body

  if (!name || !password) {
    throw new ApiError('BAD_REQUEST', 'Missing name or password')
  }

  if (password.length < 6) {
    throw new ApiError('BAD_REQUEST', 'Password must be at least 6 characters')
  }

  const existingUser = await prisma.user.findUnique({
    where: { name }
  })

  if (existingUser) {
    throw new ApiError('BAD_REQUEST', 'Username already exists')
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      name,
      password: hashedPassword,
    }
  })

  return NextResponse.json(
    {
      message: "注册成功",
      user: { id: user.id, name: user.name }
    },
    { status: 201 }
  )
})
