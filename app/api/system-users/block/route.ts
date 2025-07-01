import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSession, logAction } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { userId, action, reason } = await request.json()

    if (!userId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (action !== "block" && action !== "unblock") {
      return NextResponse.json({ error: "Invalid action. Must be 'block' or 'unblock'" }, { status: 400 })
    }

    // Verificar que el usuario existe
    const existingUsers = await query<{ id: number; username: string; is_blocked: boolean }>(
      "SELECT id, username, is_blocked FROM users WHERE id = ?",
      [userId]
    )

    if (existingUsers.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const user = existingUsers[0]

    // No permitir bloquear al usuario admin
    if (user.username === "admin") {
      return NextResponse.json({ error: "Cannot block admin user" }, { status: 403 })
    }

    if (action === "block") {
      // Verificar que el usuario no esté ya bloqueado
      if (user.is_blocked) {
        return NextResponse.json({ error: "User is already blocked" }, { status: 400 })
      }

      // Bloquear el usuario
      await query(
        `UPDATE users 
         SET is_blocked = TRUE, 
             blocked_at = NOW(), 
             blocked_by = ?, 
             blocked_reason = ?
         WHERE id = ?`,
        [session.username, reason || "No reason provided", userId]
      )

      // Log the action
      await logAction(
        session.id,
        "block_system_user",
        `Admin ${session.username} blocked system user ${user.username} (ID: ${userId}). Reason: ${reason || "No reason provided"}`
      )

      return NextResponse.json({
        success: true,
        message: `User ${user.username} has been blocked successfully`,
        action: "blocked"
      })

    } else if (action === "unblock") {
      // Verificar que el usuario esté bloqueado
      if (!user.is_blocked) {
        return NextResponse.json({ error: "User is not blocked" }, { status: 400 })
      }

      // Desbloquear el usuario
      await query(
        `UPDATE users 
         SET is_blocked = FALSE, 
             blocked_at = NULL, 
             blocked_by = NULL, 
             blocked_reason = NULL
         WHERE id = ?`,
        [userId]
      )

      // Log the action
      await logAction(
        session.id,
        "unblock_system_user",
        `Admin ${session.username} unblocked system user ${user.username} (ID: ${userId})`
      )

      return NextResponse.json({
        success: true,
        message: `User ${user.username} has been unblocked successfully`,
        action: "unblocked"
      })
    }
  } catch (error) {
    console.error("❌ API: Error blocking/unblocking system user:", error)
    return NextResponse.json({ error: "Failed to update user status" }, { status: 500 })
  }
} 