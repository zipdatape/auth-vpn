import { jwtVerify, SignJWT } from "jose"
import { hash, compare } from "bcryptjs"
import { cookies } from "next/headers"
import { query } from "./db"

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "r0m4n0s")

export interface UserSession {
  id: number
  username: string
  role: string
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword)
}

export async function createToken(user: UserSession): Promise<string> {
  return new SignJWT({
    id: user.id,
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<UserSession> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET)
    const payload = verified.payload as any
    return {
      id: payload.id,
      username: payload.username,
      role: payload.role,
    }
  } catch (err) {
    throw new Error("Invalid token")
  }
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = cookies()
  const token = cookieStore.get("token")

  if (!token) {
    return null
  }

  try {
    return await verifyToken(token.value)
  } catch {
    return null
  }
}

export async function logAction(userId: number, action: string, details: string) {
  await query("INSERT INTO audit_logs (user_id, action, details, timestamp) VALUES (?, ?, ?, NOW())", [
    userId,
    action,
    details,
  ])
}

export async function initializeAdmin() {
  const adminExists = await query<{ count: number }>("SELECT COUNT(*) as count FROM users WHERE username = ?", [
    "admin",
  ])

  if (adminExists[0].count === 0) {
    const hashedPassword = await hashPassword("r0m4n0s")
    await query("INSERT INTO users (username, password, role, created_at) VALUES (?, ?, ?, NOW())", [
      "admin",
      hashedPassword,
      "admin",
    ])
  }
}

