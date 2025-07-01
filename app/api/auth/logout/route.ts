import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession, logAction } from "@/lib/auth"

export async function POST() {
  try {
    const session = await getSession()
    if (session) {
      await logAction(session.id, "logout", `User ${session.username} logged out`)
    }

    cookies().delete("token")
    return NextResponse.json({ message: "Logged out successfully" })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ error: "An error occurred during logout" }, { status: 500 })
  }
}

