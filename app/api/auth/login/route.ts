import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { query } from "@/lib/db"
import { verifyPassword, createToken, logAction } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    const users = await query<{ 
      id: number; 
      password: string; 
      role: string; 
      is_blocked: boolean;
      blocked_reason: string | null;
    }>(
      "SELECT id, password, role, is_blocked, blocked_reason FROM users WHERE username = ?",
      [username],
    )

    if (users.length === 0) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const user = users[0]

    // Check if user is blocked
    if (user.is_blocked) {
      await logAction(user.id, "blocked_login_attempt", `Blocked user ${username} attempted to log in. Reason: ${user.blocked_reason || "No reason provided"}`)
      return NextResponse.json({ 
        error: "Account is blocked", 
        details: user.blocked_reason || "Your account has been blocked. Please contact an administrator." 
      }, { status: 403 })
    }

    const isValid = await verifyPassword(password, user.password)

    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const token = await createToken({
      id: user.id,
      username,
      role: user.role,
    })

    // Update last login
    await query("UPDATE users SET last_login = NOW() WHERE id = ?", [user.id])

    // Log the action
    await logAction(user.id, "login", `User ${username} logged in`)

    cookies().set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60, // 8 hours
    })

    return NextResponse.json({
      message: "Logged in successfully",
      user: { id: user.id, username, role: user.role },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "An error occurred during login" }, { status: 500 })
  }
}

