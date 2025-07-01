import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSession, hashPassword, verifyPassword } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()

    // Validaciones básicas
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current password and new password are required" }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters long" }, { status: 400 })
    }

    // Obtener el usuario actual con su contraseña
    const users = await query<{ id: number; username: string; password: string }>(
      "SELECT id, username, password FROM users WHERE id = ?",
      [session.id]
    )

    if (users.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const user = users[0]

    // Verificar la contraseña actual
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
    }

    // Hash de la nueva contraseña
    const hashedNewPassword = await hashPassword(newPassword)

    // Actualizar la contraseña en la base de datos
    await query("UPDATE users SET password = ? WHERE id = ?", [hashedNewPassword, session.id])

    // Log de la acción
    await query(
      "INSERT INTO audit_logs (user_id, action, details, timestamp) VALUES (?, ?, ?, NOW())",
      [session.id, "change_password", `User ${session.username} changed their password`]
    )

    return NextResponse.json({ message: "Password changed successfully" })
  } catch (error) {
    console.error("Error changing password:", error)
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 })
  }
} 