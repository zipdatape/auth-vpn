import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSession, logAction } from "@/lib/auth"

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = Number.parseInt(params.id)

    // Get user info before deletion for audit log
    const users = await query<{ username: string }>("SELECT username FROM users WHERE id = ?", [userId])

    if (users.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Don't allow deleting the admin user
    if (users[0].username === "admin") {
      return NextResponse.json({ error: "Cannot delete admin user" }, { status: 403 })
    }

    await query("DELETE FROM users WHERE id = ?", [userId])

    await logAction(session.id, "delete_user", `Admin ${session.username} deleted user ${users[0].username}`)

    return NextResponse.json({ message: "User deleted successfully" })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}

