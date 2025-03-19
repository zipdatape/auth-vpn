import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSession } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.max(1, Math.min(100, Number.parseInt(searchParams.get("limit") || "100", 10)))
    const offset = Math.max(0, Number.parseInt(searchParams.get("offset") || "0", 10))

    console.log(`Fetching audit logs with LIMIT ${limit} OFFSET ${offset}`)

    const logs = await query<{
      id: number
      user_id: number
      action: string
      details: string
      timestamp: string
      username: string
    }>(
      `
      SELECT al.*, u.username
      FROM audit_logs al
      JOIN users u ON al.user_id = u.id
      ORDER BY al.timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    )

    console.log(`Retrieved ${logs.length} audit log entries`)

    return NextResponse.json({ logs })
  } catch (error) {
    console.error("Error fetching audit logs:", error)
    return NextResponse.json(
      { error: "Failed to fetch audit logs", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

