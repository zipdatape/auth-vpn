import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSession, hashPassword, logAction } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const users = await query<{
      id: number
      username: string
      role: string
      created_at: string
      last_login: string | null
    }>("SELECT id, username, role, created_at, last_login FROM users ORDER BY username ASC")

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { username, password, role } = await request.json()

    // Validar datos
    if (!username || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verificar si el usuario ya existe
    const existing = await query<{ count: number }>("SELECT COUNT(*) as count FROM users WHERE username = ?", [
      username,
    ])

    if (existing[0].count > 0) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)

    // Asegurarse de que todos los valores estén definidos antes de la inserción
    if (!username || !hashedPassword || !role) {
      throw new Error("Invalid user data")
    }

    await query("INSERT INTO users (username, password, role, created_at) VALUES (?, ?, ?, NOW())", [
      username,
      hashedPassword,
      role,
    ])

    await logAction(session.id, "create_user", `Admin ${session.username} created user ${username}`)

    return NextResponse.json({ message: "User created successfully" })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}

